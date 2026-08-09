import { PrismaClient } from '@prisma/client'
import { Queue, Worker, type Job } from 'bullmq'
import IORedis from 'ioredis'
import { createQuoteProvider } from './modules/market/quote-provider.factory.js'
import type { Quote } from './modules/market/types.js'

const QUEUE_NAME = 'quotes'
// НБ РК публикует один фиксинг в сутки (см. nbk.ts) — курс внутри дня не
// меняется, поэтому частый опрос не даёт доп. точности high/low/close.
// 6 часов — компромисс между задержкой подхвата нового фиксинга (макс. 6ч)
// и числом запросов к nationalbank.kz.
const POLL_INTERVAL_MS = 6 * 60 * 60 * 1000

const db = new PrismaClient()
const quoteProvider = createQuoteProvider()

// Worker использует блокирующие Redis-команды — maxRetriesPerRequest: null
// обязателен, без него BullMQ падает на старте (требование библиотеки, не наш выбор).
const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

const queue = new Queue(QUEUE_NAME, { connection })

async function pollAllPairs(): Promise<void> {
  const pairs = await db.currencyPair.findMany({ where: { isActive: true } })

  for (const pair of pairs) {
    try {
      const quote = await quoteProvider.getQuote(pair.baseCode, pair.quoteCode)
      await upsertDailyCandle(pair.id, quote)
      console.log(`[worker] ${pair.id}: ${quote.rate} (${quote.source})`)
    } catch (err) {
      // Одна упавшая пара не должна останавливать обход остальных.
      console.error(`[worker] ${pair.id} failed:`, (err as Error).message)
    }
  }
}

// Собирает "1d"-свечу из повторных снятий курса за день: open фиксируется
// первым снятием и не трогается дальше, high/low/close обновляются на каждом.
async function upsertDailyCandle(pairId: string, quote: Quote): Promise<void> {
  const today = new Date(Date.UTC(quote.asOf.getUTCFullYear(), quote.asOf.getUTCMonth(), quote.asOf.getUTCDate()))

  const existing = await db.candle.findUnique({
    where: { pairId_timeframe_ts: { pairId, timeframe: '1d', ts: today } },
  })

  if (!existing) {
    await db.candle.create({
      data: {
        pairId,
        timeframe: '1d',
        ts: today,
        open: quote.rate,
        high: quote.rate,
        low: quote.rate,
        close: quote.rate,
        source: quote.source,
      },
    })
    return
  }

  await db.candle.update({
    where: { pairId_timeframe_ts: { pairId, timeframe: '1d', ts: today } },
    data: {
      high: Math.max(existing.high.toNumber(), quote.rate),
      low: Math.min(existing.low.toNumber(), quote.rate),
      close: quote.rate,
      source: quote.source,
    },
  })
}

const worker = new Worker(QUEUE_NAME, () => pollAllPairs(), { connection })

worker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`[worker] job ${job?.id} failed:`, err.message)
})

// Регистрируем повторяющуюся задачу при каждом старте — upsertJobScheduler
// сам обновляет существующий scheduler с тем же id, повторный вызов безопасен.
// (queue.add({ repeat }) — старый API, в BullMQ v6 удалён в пользу job schedulers.)
await queue.upsertJobScheduler('poll', { every: POLL_INTERVAL_MS })

console.log(`[worker] started, polling every ${POLL_INTERVAL_MS / 1000}s`)
