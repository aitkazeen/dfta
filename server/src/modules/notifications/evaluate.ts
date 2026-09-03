import type {
  AlertRule,
  AppUser,
  Candle,
  CurrencyPair,
  PrismaClient,
} from "@prisma/client";
import { sendPush, type PushJob } from "./push.js";
import {
  isWithinQuietHours,
  localTimeParts,
  type QuietHours,
} from "./quiet-hours.js";
import { notificationsConfig } from "./config.js";
import { getLatestIndicators } from "../indicators/repository.js";

type RuleWithRelations = AlertRule & { user: AppUser; pair: CurrencyPair };

// "Сегодня" — по календарной дате в tz юзера, не в UTC сервера. Берём
// YYYY-MM-DD через Intl (тот же приём, что localTimeParts в quiet-hours.ts)
// и парсим как UTC-полночь этого дня — точность до дня, больше не нужно.
function startOfLocalDay(now: Date, tz: string): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return new Date(`${ymd}T00:00:00.000Z`);
}

function latestCandles(
  db: PrismaClient,
  pairId: string,
  take: number,
): Promise<Candle[]> {
  return db.candle.findMany({
    where: { pairId, timeframe: "1d" },
    orderBy: { ts: "desc" },
    take,
  });
}

async function checkDailyTrigger(
  now: Date,
  db: PrismaClient,
  rule: RuleWithRelations,
): Promise<boolean> {
  const { hour } = localTimeParts(now, rule.user.tz);
  const inWindow =
    hour >= notificationsConfig.daily.windowStartHour &&
    hour < notificationsConfig.daily.windowEndHour;
  if (!inWindow) return false;

  const alreadySentToday = await db.notificationLog.findFirst({
    where: {
      ruleId: rule.id,
      sentAt: { gte: startOfLocalDay(now, rule.user.tz) },
    },
  });
  return alreadySentToday === null;
}

async function checkThresholdTrigger(
  db: PrismaClient,
  rule: RuleWithRelations,
): Promise<boolean> {
  const params = rule.params as {
    value?: number;
    direction?: "above" | "below";
  };
  if (
    typeof params.value !== "number" ||
    (params.direction !== "above" && params.direction !== "below")
  ) {
    return false; // правило сохранено некорректно — не роняем evaluator целиком
  }

  const [latest] = await latestCandles(db, rule.pairId, 1);
  if (!latest) return false;

  const close = latest.close.toNumber();
  return params.direction === "above"
    ? close > params.value
    : close < params.value;
}

async function checkMovementTrigger(
  db: PrismaClient,
  rule: RuleWithRelations,
): Promise<boolean> {
  const [today, prevDay] = await latestCandles(db, rule.pairId, 2);
  if (!today || !prevDay) return false; // меньше двух свечей — не с чем сравнивать

  const indicators = await getLatestIndicators(db, rule.pairId);
  if (indicators.atr14 === undefined || indicators.atr14 <= 0) return false; // вырожденный ATR (см. compute.ts) — сигнал не определён

  const params = rule.params as { atrMultiplier?: number };
  const multiplier =
    params.atrMultiplier ?? notificationsConfig.movement.defaultAtrMultiplier;

  const delta = Math.abs(today.close.toNumber() - prevDay.close.toNumber());
  return delta > indicators.atr14 * multiplier;
}

// Не переиспользует getNewsScore (news/repository.ts) — та функция отдаёт
// средневзвешенный сентимент за 24ч для прогноза, а триггеру нужен другой
// вопрос: "только что вышла ОДНА важная новость", безотносительно среднего
// настроения за сутки. Поэтому читаем news_pair_link напрямую.
async function checkNewsTrigger(
  db: PrismaClient,
  rule: RuleWithRelations,
): Promise<boolean> {
  const params = rule.params as { minImpactScore?: number };
  if (typeof params.minImpactScore !== "number") return false;

  const since = new Date(
    Date.now() - notificationsConfig.news.lookbackHours * 60 * 60 * 1000,
  );
  const importantLink = await db.newsPairLink.findFirst({
    where: {
      pairId: rule.pairId,
      impactScore: { gte: params.minImpactScore },
      article: { publishedAt: { gte: since } },
    },
  });
  return importantLink !== null;
}

async function checkTrigger(
  now: Date,
  db: PrismaClient,
  rule: RuleWithRelations,
): Promise<boolean> {
  switch (rule.type) {
    case "daily":
      return checkDailyTrigger(now, db, rule);
    case "threshold":
      return checkThresholdTrigger(db, rule);
    case "movement":
      return checkMovementTrigger(db, rule);
    case "news":
      return checkNewsTrigger(db, rule);
    default:
      return false; // неизвестный type — не должно случаться, но не роняем прогон
  }
}

// Дедуп — roadmap §7: "не более N уведомлений в сутки на пару". Считаем
// только реально доставленные ('sent'), 'failed'-попытки не должны съедать
// лимит. У notification_log своего pairId нет — фильтруем через relation
// на alert_rule (Prisma сам собирает JOIN, см. объяснение выше в диалоге).
async function countSentToday(
  db: PrismaClient,
  now: Date,
  rule: RuleWithRelations,
): Promise<number> {
  return db.notificationLog.count({
    where: {
      userId: rule.userId,
      status: "sent",
      rule: { pairId: rule.pairId },
      sentAt: { gte: startOfLocalDay(now, rule.user.tz) },
    },
  });
}

async function buildPayload(
  db: PrismaClient,
  rule: RuleWithRelations,
): Promise<PushJob["payload"] | null> {
  switch (rule.type) {
    case "daily": {
      const forecast = await db.forecast.findFirst({
        where: { pairId: rule.pairId },
        orderBy: { createdAt: "desc" },
      });
      if (!forecast) return null;

      const directionText =
        forecast.direction === "up"
          ? "вероятен рост"
          : forecast.direction === "down"
            ? "вероятно снижение"
            : "вероятно без изменений";
      const low = forecast.targetLow.toNumber().toFixed(2);
      const high = forecast.targetHigh.toNumber().toFixed(2);
      const confidencePct = Math.round(forecast.confidence.toNumber() * 100);

      return {
        title: rule.pair.displayName,
        body: `${directionText} к ${low}–${high} (уверенность ${confidencePct}%)`,
        data: { pairId: rule.pairId, type: "daily" },
      };
    }
    case "threshold": {
      const [latest] = await latestCandles(db, rule.pairId, 1);
      if (!latest) return null;
      return {
        title: rule.pair.displayName,
        body: `Курс достиг ${latest.close.toNumber().toFixed(2)}`,
        data: { pairId: rule.pairId, type: "threshold" },
      };
    }
    case "movement": {
      const [today, prevDay] = await latestCandles(db, rule.pairId, 2);
      if (!today || !prevDay) return null;
      const pctChange =
        ((today.close.toNumber() - prevDay.close.toNumber()) /
          prevDay.close.toNumber()) *
        100;
      const sign = pctChange >= 0 ? "+" : "";
      return {
        title: rule.pair.displayName,
        body: `Аномальное движение ${sign}${pctChange.toFixed(1)}% за сутки`,
        data: { pairId: rule.pairId, type: "movement" },
      };
    }
    case "news": {
      return {
        title: rule.pair.displayName,
        body: `Вышла важная новость по ${rule.pair.displayName}`,
        data: { pairId: rule.pairId, type: "news" },
      };
    }
    default:
      return null;
  }
}

export async function evaluateAlerts(db: PrismaClient): Promise<void> {
  const now = new Date();
  const rules = await db.alertRule.findMany({
    where: { isActive: true },
    include: { user: true, pair: true },
  });

  const jobs: PushJob[] = [];

  for (const rule of rules) {
    try {
      const triggered = await checkTrigger(now, db, rule);
      if (!triggered) continue;

      if (
        isWithinQuietHours(
          now,
          rule.user.tz,
          rule.quietHours as QuietHours | null,
        )
      )
        continue;

      const sentToday = await countSentToday(db, now, rule);
      if (sentToday >= notificationsConfig.maxPerPairPerDay) continue;

      const devices = await db.deviceToken.findMany({
        where: { userId: rule.userId },
      });
      if (devices.length === 0) continue;

      const payload = await buildPayload(db, rule);
      if (!payload) continue;

      for (const device of devices) {
        jobs.push({
          userId: rule.userId,
          ruleId: rule.id,
          deviceToken: device.token,
          payload,
        });
      }
    } catch (err) {
      // Одно сломанное правило не должно останавливать обход остальных
      // (тот же принцип, что в pollAllPairs/worker.ts).
      console.error(
        `[notifications] rule ${rule.id} failed:`,
        (err as Error).message,
      );
    }
  }

  if (jobs.length > 0) {
    await sendPush(db, jobs);
  }
}
