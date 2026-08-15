import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'

type ForecastRoutesDeps = {
  db: PrismaClient
}

export function forecastRoutes(deps: ForecastRoutesDeps) {
  return async function (app: FastifyInstance) {
    app.get('/v1/pairs/:id/forecast', async (req, reply) => {
      const { id } = req.params as { id: string }

      const pair = await deps.db.currencyPair.findUnique({ where: { id } })
      if (!pair) {
        return reply.code(404).send({ error: 'pair not found' })
      }

      const forecast = await deps.db.forecast.findFirst({
        where: { pairId: id },
        orderBy: { createdAt: 'desc' },
      })
      if (!forecast) {
        // Пара валидна, но воркер ещё не успел сгенерировать прогноз
        // (первый запуск / только что добавленная пара) — не то же самое,
        // что "пары не существует", поэтому отдельное сообщение.
        return reply.code(404).send({ error: 'forecast not generated yet' })
      }

      return {
        pairId: forecast.pairId,
        horizon: forecast.horizon,
        direction: forecast.direction,
        confidence: forecast.confidence.toNumber(),
        targetLow: forecast.targetLow.toNumber(),
        targetHigh: forecast.targetHigh.toNumber(),
        engineVersion: forecast.engineVersion,
        createdAt: forecast.createdAt.toISOString(),
        explanation: forecast.explanation,
        drivers: forecast.drivers,
      }
    })
  }
}
