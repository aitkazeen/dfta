import { Prisma, type PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/middleware.js";

type NotificationRoutesDeps = {
  db: PrismaClient;
};

const ALERT_TYPES = ["daily", "threshold", "movement", "news"] as const;
type AlertType = (typeof ALERT_TYPES)[number];

function isAlertType(value: unknown): value is AlertType {
  return typeof value === "string" && (ALERT_TYPES as readonly string[]).includes(value);
}

export function notificationRoutes(deps: NotificationRoutesDeps) {
  return async function (app: FastifyInstance) {
    app.get("/v1/me/alerts", { preHandler: requireAuth }, async (req) => {
      const rules = await deps.db.alertRule.findMany({
        where: { userId: req.userId! },
        orderBy: { id: "asc" },
      });
      return rules;
    });

    app.post("/v1/me/alerts", { preHandler: requireAuth }, async (req, reply) => {
      const { pairId, type, params, quietHours } = req.body as {
        pairId?: string;
        type?: string;
        params?: Record<string, unknown>;
        quietHours?: { start: string; end: string } | null;
      };

      if (!pairId || !isAlertType(type) || typeof params !== "object" || params === null) {
        return reply.code(400).send({
          error: `pairId, type (one of ${ALERT_TYPES.join(", ")}) and params (object) are required`,
        });
      }

      const pair = await deps.db.currencyPair.findUnique({ where: { id: pairId } });
      if (!pair) {
        return reply.code(404).send({ error: "pair not found" });
      }

      const rule = await deps.db.alertRule.create({
        data: {
          userId: req.userId!,
          pairId,
          type,
          params: params as Prisma.InputJsonValue,
          quietHours: quietHours ? (quietHours as Prisma.InputJsonValue) : undefined,
        },
      });
      return reply.code(201).send(rule);
    });

    app.patch("/v1/me/alerts/:id", { preHandler: requireAuth }, async (req, reply) => {
      const { id } = req.params as { id: string };
      const { isActive, params, quietHours } = req.body as {
        isActive?: boolean;
        params?: Record<string, unknown>;
        quietHours?: { start: string; end: string } | null;
      };

      // Скоуп by userId прямо в where — если правило чужое, findFirst не
      // найдёт его, и мы честно вернём 404, а не 403 (не раскрываем чужие id).
      const existing = await deps.db.alertRule.findFirst({
        where: { id, userId: req.userId! },
      });
      if (!existing) {
        return reply.code(404).send({ error: "alert rule not found" });
      }

      const rule = await deps.db.alertRule.update({
        where: { id },
        data: {
          ...(isActive !== undefined ? { isActive } : {}),
          ...(params !== undefined ? { params: params as Prisma.InputJsonValue } : {}),
          ...(quietHours !== undefined
            ? { quietHours: quietHours === null ? Prisma.JsonNull : (quietHours as Prisma.InputJsonValue) }
            : {}),
        },
      });
      return rule;
    });

    app.delete("/v1/me/alerts/:id", { preHandler: requireAuth }, async (req, reply) => {
      const { id } = req.params as { id: string };

      const existing = await deps.db.alertRule.findFirst({
        where: { id, userId: req.userId! },
      });
      if (!existing) {
        return reply.code(404).send({ error: "alert rule not found" });
      }

      await deps.db.alertRule.delete({ where: { id } });
      return reply.code(204).send();
    });
  };
}
