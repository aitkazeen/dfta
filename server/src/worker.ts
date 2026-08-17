import { PrismaClient, Prisma } from "@prisma/client";
import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { createQuoteProvider } from "./modules/market/quote-provider.factory.js";
import type { Quote } from "./modules/market/types.js";
import { computeIndicators } from "./modules/indicators/compute.js";
import { getLatestIndicators } from "./modules/indicators/repository";
import { RulesForecastEngine } from "./modules/forecast/rules-engine.js";
import { resolveForecastOutcome } from "./modules/forecast/outcomes.js";
import { forecastConfig } from "./modules/forecast/config.js";
import { createExplainer } from "./modules/forecast/explainer.factory.js";
import type { Direction } from "./modules/forecast/types.js";

const QUEUE_NAME = "quotes";
// НБ РК публикует один фиксинг в сутки (см. nbk.ts) — курс внутри дня не
// меняется, поэтому частый опрос не даёт доп. точности high/low/close.
// 6 часов — компромисс между задержкой подхвата нового фиксинга (макс. 6ч)
// и числом запросов к nationalbank.kz.
const POLL_INTERVAL_MS = 6 * 60 * 60 * 1000;

const HORIZON_MS: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

const db = new PrismaClient();
const quoteProvider = createQuoteProvider();
const forecastEngine = new RulesForecastEngine();

// Worker использует блокирующие Redis-команды — maxRetriesPerRequest: null
// обязателен, без него BullMQ падает на старте (требование библиотеки, не наш выбор).
const connection = new IORedis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
  },
);
const explainer = createExplainer(connection);

const queue = new Queue(QUEUE_NAME, { connection });

async function pollAllPairs(): Promise<void> {
  const pairs = await db.currencyPair.findMany({ where: { isActive: true } });

  for (const pair of pairs) {
    try {
      const quote = await quoteProvider.getQuote(pair.baseCode, pair.quoteCode);
      await upsertDailyCandle(pair.id, quote);
      await recomputeIndicators(pair.id);
      await maybeGenerateForecast(pair, quote.rate);
      console.log(`[worker] ${pair.id}: ${quote.rate} (${quote.source})`);
    } catch (err) {
      // Одна упавшая пара не должна останавливать обход остальных.
      console.error(`[worker] ${pair.id} failed:`, (err as Error).message);
    }
  }

  await resolvePendingOutcomes();
}

// Правило 5 (CLAUDE.md): forecast_outcome пишется всегда, для каждого
// прогноза, у которого истёк горизонт. Не пара за парой, а один проход по
// всем нерезолвленным прогнозам сразу — резолв не привязан к текущему
// опросу конкретной пары.
async function resolvePendingOutcomes(): Promise<void> {
  const pending = await db.forecast.findMany({ where: { outcome: null } });

  for (const forecast of pending) {
    try {
      const horizonMs = HORIZON_MS[forecast.horizon];
      if (!horizonMs) continue; // неизвестный horizon — не должно случиться, но не роняем остальные

      const resolutionDay = startOfUtcDay(
        new Date(forecast.createdAt.getTime() + horizonMs),
      );
      if (resolutionDay.getTime() > startOfUtcDay(new Date()).getTime())
        continue; // горизонт ещё не истёк

      // Свечи дневные (см. upsertDailyCandle) — резолвим по свече ровно
      // того дня, на который выпал конец горизонта. Если её ещё нет
      // (воркер не успел опросить эту пару в этот день) — пробуем на
      // следующем прогоне, а не подставляем ближайшую по времени.
      const candle = await db.candle.findUnique({
        where: {
          pairId_timeframe_ts: {
            pairId: forecast.pairId,
            timeframe: "1d",
            ts: resolutionDay,
          },
        },
      });
      if (!candle) continue;

      const features = forecast.features as { close?: number };
      if (typeof features.close !== "number") continue; // прогнозы без сохранённого close не резолвим (не должно случаться)

      const actualClose = candle.close.toNumber();
      const { wasCorrect, absError } = resolveForecastOutcome({
        direction: forecast.direction as Direction,
        originalClose: features.close,
        targetLow: forecast.targetLow.toNumber(),
        targetHigh: forecast.targetHigh.toNumber(),
        actualClose,
        deadZonePct:
          forecastConfig.decision.flatThreshold *
          forecastConfig.decision.maxMovePct,
      });

      await db.forecastOutcome.create({
        data: {
          forecastId: forecast.id,
          resolvedAt: new Date(),
          actualClose,
          wasCorrect,
          absError,
        },
      });
      console.log(
        `[worker] forecast ${forecast.id} resolved: wasCorrect=${wasCorrect}`,
      );
    } catch (err) {
      console.error(
        `[worker] forecast ${forecast.id} outcome resolution failed:`,
        (err as Error).message,
      );
    }
  }
}

// Собирает "1d"-свечу из повторных снятий курса за день: open фиксируется
// первым снятием и не трогается дальше, high/low/close обновляются на каждом.
async function upsertDailyCandle(pairId: string, quote: Quote): Promise<void> {
  const today = new Date(
    Date.UTC(
      quote.asOf.getUTCFullYear(),
      quote.asOf.getUTCMonth(),
      quote.asOf.getUTCDate(),
    ),
  );

  const existing = await db.candle.findUnique({
    where: { pairId_timeframe_ts: { pairId, timeframe: "1d", ts: today } },
  });

  if (!existing) {
    await db.candle.create({
      data: {
        pairId,
        timeframe: "1d",
        ts: today,
        open: quote.rate,
        high: quote.rate,
        low: quote.rate,
        close: quote.rate,
        source: quote.source,
      },
    });
    return;
  }

  await db.candle.update({
    where: { pairId_timeframe_ts: { pairId, timeframe: "1d", ts: today } },
    data: {
      high: Math.max(existing.high.toNumber(), quote.rate),
      low: Math.min(existing.low.toNumber(), quote.rate),
      close: quote.rate,
      source: quote.source,
    },
  });
}

async function recomputeIndicators(pairId: string): Promise<void> {
  const candles = await db.candle.findMany({
    where: { pairId, timeframe: "1d" },
    orderBy: { ts: "asc" },
  });
  const points = computeIndicators(
    candles.map((c) => ({
      ts: c.ts,
      open: c.open.toNumber(),
      high: c.high.toNumber(),
      low: c.low.toNumber(),
      close: c.close.toNumber(),
    })),
  );
  for (const p of points) {
    await db.indicatorValue.upsert({
      where: {
        pairId_timeframe_ts_name: {
          pairId,
          timeframe: "1d",
          ts: p.ts,
          name: p.name,
        },
      },
      create: {
        pairId,
        timeframe: "1d",
        ts: p.ts,
        name: p.name,
        value: p.value,
      },
      update: { value: p.value },
    });
  }
}
function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

async function shouldGenerateForecast(
  pairId: string,
  today: string | Date,
): Promise<boolean> {
  const existing = await db.forecast.findFirst({
    where: { pairId, createdAt: { gte: today } },
  });
  return existing === null;
}

async function maybeGenerateForecast(
  pair: { id: string; baseCode: string; quoteCode: string },
  close: number,
): Promise<void> {
  const today = startOfUtcDay(new Date());
  if (!(await shouldGenerateForecast(pair.id, today))) return;

  const indicators = await getLatestIndicators(db, pair.id);
  const result = await forecastEngine.predict({
    pairId: pair.id,
    horizon: "24h",
    close,
    indicators,
  });

  // Без ATR прогноз вырожденный (flat/0, см. RulesForecastEngine) — объяснять
  // там нечего, и не стоит платить за LLM-вызов ради "нет данных".
  const explained =
    indicators.atr14 === undefined
      ? null
      : await explainer
          .explain({
            base: pair.baseCode,
            quote: pair.quoteCode,
            direction: result.direction,
            technicalScore: (result.features as { technicalScore: number })
              .technicalScore,
            close,
            targetLow: result.targetLow,
            targetHigh: result.targetHigh,
            indicators,
          })
          .catch((err: Error) => {
            console.error(
              `[worker] explainer для ${pair.id} упал:`,
              err.message,
            );
            return null;
          });

  await db.forecast.create({
    data: {
      pairId: pair.id,
      horizon: "24h",
      direction: result.direction,
      confidence: result.confidence,
      targetLow: result.targetLow,
      targetHigh: result.targetHigh,
      engineVersion: result.engineVersion,
      // Prisma не принимает Record<string, unknown> напрямую как JSON-инпут —
      // ForecastResult.features сознательно типизирован без зависимости на
      // Prisma (ForecastEngine не должен знать о хранилище), поэтому приводим
      // тип здесь, на границе записи в БД, а не в domain-типе.
      features: result.features as Prisma.InputJsonValue,
      explanation: explained?.explanation,
      ...(explained
        ? { drivers: explained.drivers as Prisma.InputJsonValue }
        : {}),
    },
  });
}

const worker = new Worker(QUEUE_NAME, () => pollAllPairs(), { connection });

worker.on("failed", (job: Job | undefined, err: Error) => {
  console.error(`[worker] job ${job?.id} failed:`, err.message);
});

// Регистрируем повторяющуюся задачу при каждом старте — upsertJobScheduler
// сам обновляет существующий scheduler с тем же id, повторный вызов безопасен.
// (queue.add({ repeat }) — старый API, в BullMQ v6 удалён в пользу job schedulers.)
// immediately: true — без этого первый прогон ждёт полный интервал (6ч),
// и candle остаётся пустым до тех пор.
await queue.upsertJobScheduler("poll", {
  every: POLL_INTERVAL_MS,
  immediately: true,
});

console.log(`[worker] started, polling every ${POLL_INTERVAL_MS / 1000}s`);
