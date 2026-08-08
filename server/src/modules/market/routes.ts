import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import type { IQuoteProvider } from './types.js'

type MarketRoutesDeps = {
  db: PrismaClient
  quoteProvider: IQuoteProvider
}

export function marketRoutes(deps: MarketRoutesDeps) {
  return async function (app: FastifyInstance) {
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
  }
}
