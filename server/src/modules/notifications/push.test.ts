import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { sendPush, type PushJob } from "./push.js";

// Мини-фейк Prisma: пишем в массивы, чтобы проверить, что и с каким статусом
// осело в notification_log, не поднимая настоящую БД.
function fakeDb() {
  const created: { id: string; status: string }[] = [];
  const deletedTokens: string[] = [];
  let seq = 0;
  const db = {
    notificationLog: {
      create: vi.fn(async ({ data }: { data: { status: string } }) => {
        const row = { id: `log${++seq}`, status: data.status };
        created.push(row);
        return row;
      }),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { status: string };
        }) => {
          const row = created.find((r) => r.id === where.id);
          if (row) row.status = data.status;
        },
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: { in: string[] } };
          data: { status: string };
        }) => {
          for (const row of created)
            if (where.id.in.includes(row.id)) row.status = data.status;
        },
      ),
    },
    deviceToken: {
      deleteMany: vi.fn(async ({ where }: { where: { token: string } }) => {
        deletedTokens.push(where.token);
      }),
    },
  };
  return { db: db as unknown as PrismaClient, created, deletedTokens };
}

const job = (token: string): PushJob => ({
  userId: "u1",
  ruleId: "r1",
  deviceToken: token,
  payload: { title: "t", body: "b", data: { pairId: "USD-KZT" } },
});

afterEach(() => vi.unstubAllGlobals());

describe("sendPush", () => {
  it("кладёт logId в data пуша и оставляет status=sent при ok", async () => {
    let sentBody: unknown;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        sentBody = JSON.parse(init.body);
        return { ok: true, json: async () => ({ data: [{ status: "ok" }] }) };
      }),
    );

    const { db, created } = fakeDb();
    await sendPush(db, [job("ExponentPushToken[a]")]);

    expect(created[0].status).toBe("sent");
    expect((sentBody as { data: { logId: string } }[])[0].data.logId).toBe(
      created[0].id,
    );
  });

  it("понижает до failed и чистит мёртвый токен при DeviceNotRegistered", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [
            { status: "error", details: { error: "DeviceNotRegistered" } },
          ],
        }),
      })),
    );

    const { db, created, deletedTokens } = fakeDb();
    await sendPush(db, [job("ExponentPushToken[dead]")]);

    expect(created[0].status).toBe("failed");
    expect(deletedTokens).toEqual(["ExponentPushToken[dead]"]);
  });

  it("понижает всю пачку до failed, если Expo недоступен", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    const { db, created } = fakeDb();
    await sendPush(db, [job("ExponentPushToken[a]")]);

    expect(created[0].status).toBe("failed");
  });
});
