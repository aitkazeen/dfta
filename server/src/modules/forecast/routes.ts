import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { forecastConfig } from "./config";

type ForecastRoutesDeps = {
  db: PrismaClient;
};

export function forecastRoutes(deps: ForecastRoutesDeps) {
  return async function (app: FastifyInstance) {
    app.get("/v1/pairs/:id/forecast", async (req, reply) => {
      const { id } = req.params as { id: string };

      const pair = await deps.db.currencyPair.findUnique({ where: { id } });
      if (!pair) {
        return reply.code(404).send({ error: "pair not found" });
      }

      const forecast = await deps.db.forecast.findFirst({
        where: { pairId: id },
        orderBy: { createdAt: "desc" },
      });
      if (!forecast) {
        // Пара валидна, но воркер ещё не успел сгенерировать прогноз
        // (первый запуск / только что добавленная пара) — не то же самое,
        // что "пары не существует", поэтому отдельное сообщение.
        return reply.code(404).send({ error: "forecast not generated yet" });
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
      };
    });
    app.get("/v1/pairs/:id/forecast/history", async (req, reply) => {
      const { id } = req.params as { id: string };

      const pair = await deps.db.currencyPair.findUnique({ where: { id } });
      if (!pair) {
        return reply.code(404).send({ error: "pair not found" });
      }

      const forecasts = await deps.db.forecast.findMany({
        where: {
          pairId: id,
          horizon: "24h",
          createdAt: {
            gte: new Date(
              Date.now() - forecastConfig.historyWindowDays * 86_400_000,
            ),
          },
        },
        include: { outcome: true },
        orderBy: { createdAt: "asc" }, // старые -> новые, важно для outcomes/trend
      });

      if (forecasts.length === 0) {
        // Пара валидна, но воркер ещё не успел сгенерировать прогноз
        // (первый запуск / только что добавленная пара) — не то же самое,
        // что "пары не существует", поэтому отдельное сообщение.
        return reply.code(404).send({ error: "forecast not generated yet" });
      }

      const resolved = forecasts.filter((f) => f.outcome !== null);

      const total = resolved.length;
      const hits = resolved.filter((f) => f.outcome!.wasCorrect).length;
      const hitRatePct = total === 0 ? 0 : Math.round((100 * hits) / total);

      const RECENT_OUTCOMES = 20;
      const outcomes = resolved
        .slice(-RECENT_OUTCOMES)
        .map((f) => f.outcome!.wasCorrect);

      const RECENT_TREND = 11;
      const trendSlice = resolved.slice(-RECENT_TREND);
      const trend = {
        predicted: trendSlice.map(
          (f) => (f.targetLow.toNumber() + f.targetHigh.toNumber()) / 2,
        ),
        actual: trendSlice.map((f) => f.outcome!.actualClose.toNumber()),
      };

      return {
        pairId: id,
        horizon: "24h",
        windowDays: forecastConfig.historyWindowDays,
        total,
        hitRatePct,
        outcomes,
        trend,
      };
    });
  };
}
