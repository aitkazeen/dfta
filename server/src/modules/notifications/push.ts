import type { Prisma, PrismaClient } from "@prisma/client";
import { fetchWithRetry } from "../../utils/fetch-with-retry.js";
import { httpConfig } from "../../config.js";

export type PushJob = {
  userId: string;
  ruleId: string | null; // AlertRule.id — null для системных, см. модель
  deviceToken: string; // DeviceToken.token, "ExponentPushToken[...]"
  payload: { title: string; body: string; data?: Record<string, unknown> };
};

type ExpoPushTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

// Expo принимает максимум httpConfig.push.limit сообщений за один POST —
// нарезаем всегда, а не только когда jobs длиннее лимита.
export async function sendPush(
  db: PrismaClient,
  jobs: PushJob[],
): Promise<void> {
  for (let i = 0; i < jobs.length; i += httpConfig.push.limit) {
    const chunk = jobs.slice(i, i + httpConfig.push.limit);

    let tickets: ExpoPushTicket[];
    try {
      const response = await fetchWithRetry(
        "https://exp.host/--/api/v2/push/send",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify(
            chunk.map((job) => ({
              to: job.deviceToken,
              title: job.payload.title,
              body: job.payload.body,
              data: job.payload.data,
              sound: "default",
            })),
          ),
        },
        httpConfig.push,
      );
      const parsed = (await response.json()) as { data: ExpoPushTicket[] };
      tickets = parsed.data;
    } catch (err) {
      // Expo недоступен после всех ретраев — вся пачка не долетела.
      // Не глушим молча: логируем и пишем failed для каждого job'а, чтобы
      // notification_log отражал реальность, а не тишину.
      console.error(`[push] chunk of ${chunk.length} failed:`, (err as Error).message);
      for (const job of chunk) {
        await db.notificationLog.create({
          data: {
            userId: job.userId,
            ruleId: job.ruleId,
            payload: job.payload as Prisma.InputJsonValue,
            status: "failed",
          },
        });
      }
      continue;
    }

    for (let j = 0; j < chunk.length; j++) {
      const job = chunk[j];
      const ticket = tickets[j];

      await db.notificationLog.create({
        data: {
          userId: job.userId,
          ruleId: job.ruleId,
          payload: job.payload as Prisma.InputJsonValue,
          status: ticket?.status === "ok" ? "sent" : "failed",
        },
      });

      if (ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
        // Мёртвый токен — Expo больше не сможет в него доставить, чистим,
        // чтобы не слать вхолостую на каждом следующем прогоне.
        await db.deviceToken.deleteMany({ where: { token: job.deviceToken } });
      }
    }
  }
}
