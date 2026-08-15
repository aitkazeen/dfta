import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import type { IQuoteProvider } from './types.js'
type MarketRoutesDeps = {
  db: PrismaClient
  quoteProvider: IQuoteProvider
}

export function marketRoutes(deps: MarketRoutesDeps) {
  return async function (app: FastifyInstance) {
    app.get('/v1/pairs', async () => {
      const pairs = await deps.db.currencyPair.findMany({
        where: { isActive: true },
        orderBy: { priority: 'desc' },
      })
      return pairs.map((p) => ({
        id: p.id,
        base: p.baseCode,
        quote: p.quoteCode,
        displayName: p.displayName,
      }))
    })

    app.get('/v1/pairs/:id/candles', async (req, reply) => {
      const { id } = req.params as { id: string }
      const { limit } = req.query as { limit?: string }

      const pair = await deps.db.currencyPair.findUnique({ where: { id } })
      if (!pair) {
        return reply.code(404).send({ error: 'pair not found' })
      }

      // Пока только "1d" (см. worker.ts) — таймфреймы из query добавятся
      // вместе с внутридневными свечами на этапе 2.
      const take = Math.min(Math.max(Number(limit) || 30, 1), 90)
      const rows = await deps.db.candle.findMany({
        where: { pairId: id, timeframe: '1d' },
        orderBy: { ts: 'desc' },
        take,
      })

      return rows.reverse().map((c) => ({
        ts: c.ts.toISOString(),
        o: c.open.toNumber(),
        h: c.high.toNumber(),
        l: c.low.toNumber(),
        c: c.close.toNumber(),
      }))
    })

    app.get('/v1/pairs/:id/quote', async (req, reply) => {
      const { id } = req.params as { id: string }

      const pair = await deps.db.currencyPair.findUnique({ where: { id } })
      if (!pair) {
        return reply.code(404).send({ error: 'pair not found' })
      }

      try {
        const q = await deps.quoteProvider.getQuote(pair.baseCode, pair.quoteCode)
        return {
          id: pair.id,
          base: pair.baseCode,
          quote: pair.quoteCode,
          rate: q.rate,
          asOf: q.asOf.toISOString(),
          source: q.source,
        }
      } catch (err) {
        req.log.error(err)
        return reply.code(502).send({ error: 'quote provider unavailable' })
      }
    })

    app.get('/v1/pairs/:id/indicators', async (req, reply) => {
      const { id } = req.params as { id: string }

      const pair = await deps.db.currencyPair.findUnique({ where: { id } })

      if (!pair) {
        return reply.code(404).send({error: "pair not found"})
      }

      const rows = await deps.db.indicatorValue.findMany({
        where: { pairId: id, timeframe: '1d' },
        orderBy: { ts: "desc"},
        distinct: ["name"]
      })

      return Object.fromEntries(
          rows.map((r) => [r.name, { value: r.value.toNumber(), ts: r.ts.toISOString()}])
      )
    })
  }
}
