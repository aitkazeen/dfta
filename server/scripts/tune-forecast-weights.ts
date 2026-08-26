/**
 * Этап 4 роадмапа (§9: "подбор весов"), продолжение calibration work
 * (2026-08-23, backtest-forecast.ts). Тот бэктест ответил "насколько мы
 * можем доверять сырому |blendedScore|" — этот скрипт отвечает на вопрос
 * до него: "а какой набор весов сигналов вообще дать этому score".
 *
 * Подход: считаем по каждому дню истории (walk-forward, как в
 * backtest-forecast.ts) не итоговый technicalScore, а отдельные
 * нормализованные под-сигналы (trend, rsi, stoch, macd), затем прогоняем
 * набор весовых конфигураций (включая leave-one-out на каждый сигнал —
 * diagnostics) и сравниваем directional accuracy.
 *
 * Train/test split по времени (75/25 на каждую пару) — не только средняя
 * точность на всей истории, а ещё и на отложенном хвосте: 2 года и 3 пары
 * дают мало по-настоящему независимых наблюдений (горизонт 7д означает
 * пересекающиеся окна), поэтому конфиг, который просто подогнан под шум
 * тренировочного участка, должен быть виден как хуже на test.
 *
 * Запуск: npm run forecast:tune-weights   (из server/)
 * Ничего не пишет — только печатает таблицы. Итоговые веса переносятся в
 * config.ts руками, после чего calibration-data.ts перегенерируется
 * npm run forecast:backtest (он использует уже обновлённый config.ts).
 */

import { PrismaClient } from "@prisma/client";
import { computeIndicators } from "../src/modules/indicators/compute.js";
import {
  difference,
  centered100,
  atrRelative,
  weightedAverage,
} from "../src/modules/forecast/compute.js";
import { forecastConfig } from "../src/modules/forecast/config.js";
import type { IndicatorSnapshot } from "../src/modules/forecast/types.js";

const HORIZONS = { "24h": 1, "7d": 7 } as const;
const TRAIN_FRACTION = 0.75;
// Эффективный порог по |technicalScore| — тот же самый, что видит
// RulesForecastEngine (flatThreshold делится на merge.technicalWeight,
// т.к. без новостей blendedScore = technicalScore * technicalWeight).
const EFFECTIVE_THRESHOLD =
  forecastConfig.decision.flatThreshold / forecastConfig.merge.technicalWeight;

type SubSignals = {
  trend: number | null;
  rsi: number | null;
  stoch: number | null;
  macd: number | null;
};

type Sample = {
  pairId: string;
  ts: number;
  signals: SubSignals;
  // pctChange[h] = (close[i+h] - close[i]) / close[i], по каждому горизонту
  pctChange: Record<keyof typeof HORIZONS, number | undefined>;
};

async function loadSamples(db: PrismaClient): Promise<Sample[]> {
  const pairs = await db.currencyPair.findMany({ where: { isActive: true } });
  const samples: Sample[] = [];

  for (const pair of pairs) {
    const candles = await db.candle.findMany({
      where: { pairId: pair.id, timeframe: "1d" },
      orderBy: { ts: "asc" },
    });
    if (candles.length < 30) continue;

    const closes = candles.map((c) => Number(c.close));
    const indicatorPoints = computeIndicators(
      candles.map((c) => ({
        ts: c.ts,
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
      })),
    );
    const byTs = new Map<number, IndicatorSnapshot>();
    for (const p of indicatorPoints) {
      const key = p.ts.getTime();
      const snap = byTs.get(key) ?? {};
      (snap as Record<string, number>)[p.name] = p.value;
      byTs.set(key, snap);
    }

    for (let i = 0; i < candles.length; i++) {
      const ind = byTs.get(candles[i].ts.getTime()) ?? {};
      if (ind.atr14 === undefined) continue; // тот же guard, что в rules-engine.ts

      const { emaStack } = forecastConfig;
      const trend = weightedAverage([
        {
          score: difference(closes[i], ind.ema20, emaStack.emaDeviation),
          weight: 1,
        },
        {
          score: difference(ind.ema20, ind.ema50, emaStack.emaDeviation),
          weight: 1,
        },
        {
          score: difference(ind.ema50, ind.ema200, emaStack.emaDeviation),
          weight: 1,
        },
      ]);

      const pctChange = {} as Record<keyof typeof HORIZONS, number | undefined>;
      for (const [h, days] of Object.entries(HORIZONS) as [
        keyof typeof HORIZONS,
        number,
      ][]) {
        const future = closes[i + days];
        pctChange[h] =
          future === undefined ? undefined : (future - closes[i]) / closes[i];
      }

      samples.push({
        pairId: pair.id,
        ts: candles[i].ts.getTime(),
        signals: {
          trend,
          rsi: centered100(ind.rsi14),
          stoch: centered100(ind.stoch_k),
          macd: atrRelative(ind.macd, ind.atr14),
        },
        pctChange,
      });
    }
  }
  return samples;
}

function splitTrainTest(samples: Sample[]): {
  train: Sample[];
  test: Sample[];
} {
  const byPair = new Map<string, Sample[]>();
  for (const s of samples) {
    const arr = byPair.get(s.pairId) ?? [];
    arr.push(s);
    byPair.set(s.pairId, arr);
  }
  const train: Sample[] = [];
  const test: Sample[] = [];
  for (const arr of byPair.values()) {
    arr.sort((a, b) => a.ts - b.ts);
    const cut = Math.floor(arr.length * TRAIN_FRACTION);
    train.push(...arr.slice(0, cut));
    test.push(...arr.slice(cut));
  }
  return { train, test };
}

type Weights = { trend: number; rsi: number; stoch: number; macd: number };

function blend(signals: SubSignals, w: Weights): number | null {
  return weightedAverage([
    { score: signals.trend, weight: w.trend },
    { score: signals.rsi, weight: w.rsi },
    { score: signals.stoch, weight: w.stoch },
    { score: signals.macd, weight: w.macd },
  ]);
}

type Metrics = {
  n: number;
  accuracy: number;
  coverage: number; // доля не-flat предсказаний
  baselineAccuracy: number; // всегда предсказывать самый частый actual-класс
};

function evaluate(
  samples: Sample[],
  w: Weights,
  horizon: keyof typeof HORIZONS,
  deadZonePct: number,
): Metrics | null {
  let correct = 0;
  let nonFlatPredicted = 0;
  let n = 0;
  const actualCounts = { up: 0, down: 0, flat: 0 };

  for (const s of samples) {
    const pct = s.pctChange[horizon];
    if (pct === undefined) continue;
    const score = blend(s.signals, w);
    if (score === null) continue;

    const predicted =
      score > EFFECTIVE_THRESHOLD
        ? "up"
        : score < -EFFECTIVE_THRESHOLD
          ? "down"
          : "flat";
    const actual =
      pct > deadZonePct ? "up" : pct < -deadZonePct ? "down" : "flat";

    n++;
    actualCounts[actual]++;
    if (predicted !== "flat") nonFlatPredicted++;
    if (predicted === actual) correct++;
  }

  if (n === 0) return null;
  const baselineAccuracy =
    Math.max(actualCounts.up, actualCounts.down, actualCounts.flat) / n;

  return {
    n,
    accuracy: correct / n,
    coverage: nonFlatPredicted / n,
    baselineAccuracy,
  };
}

function evaluateAtThreshold(
  samples: Sample[],
  w: Weights,
  horizon: keyof typeof HORIZONS,
  deadZonePct: number,
  threshold: number,
): Metrics | null {
  let correct = 0;
  let nonFlatPredicted = 0;
  let n = 0;
  const actualCounts = { up: 0, down: 0, flat: 0 };

  for (const s of samples) {
    const pct = s.pctChange[horizon];
    if (pct === undefined) continue;
    const score = blend(s.signals, w);
    if (score === null) continue;

    const predicted =
      score > threshold ? "up" : score < -threshold ? "down" : "flat";
    const actual =
      pct > deadZonePct ? "up" : pct < -deadZonePct ? "down" : "flat";

    n++;
    actualCounts[actual]++;
    if (predicted !== "flat") nonFlatPredicted++;
    if (predicted === actual) correct++;
  }

  if (n === 0) return null;
  const baselineAccuracy =
    Math.max(actualCounts.up, actualCounts.down, actualCounts.flat) / n;

  return {
    n,
    accuracy: correct / n,
    coverage: nonFlatPredicted / n,
    baselineAccuracy,
  };
}

function fmt(m: Metrics | null): string {
  if (!m) return "n/a";
  return `acc=${(m.accuracy * 100).toFixed(1)}% (baseline=${(m.baselineAccuracy * 100).toFixed(1)}%, coverage=${(m.coverage * 100).toFixed(1)}%, n=${m.n})`;
}

async function main(): Promise<void> {
  const db = new PrismaClient();
  const samples = await loadSamples(db);
  await db.$disconnect();

  const { train, test } = splitTrainTest(samples);
  console.log(
    `Loaded ${samples.length} samples (train=${train.length}, test=${test.length})`,
  );

  const deadZonePct =
    forecastConfig.decision.flatThreshold * forecastConfig.decision.maxMovePct;

  const candidates: { name: string; w: Weights }[] = [
    {
      name: "current (trend+rsi+stoch+macd, equal)",
      w: { trend: 1, rsi: 1, stoch: 1, macd: 1 },
    },
    { name: "trend-only", w: { trend: 1, rsi: 0, stoch: 0, macd: 0 } },
    { name: "rsi-only", w: { trend: 0, rsi: 1, stoch: 0, macd: 0 } },
    { name: "stoch-only", w: { trend: 0, rsi: 0, stoch: 1, macd: 0 } },
    { name: "macd-only", w: { trend: 0, rsi: 0, stoch: 0, macd: 1 } },
    {
      name: "momentum-only (rsi+stoch+macd)",
      w: { trend: 0, rsi: 1, stoch: 1, macd: 1 },
    },
    {
      name: "drop stoch (trend+rsi+macd)",
      w: { trend: 1, rsi: 1, stoch: 0, macd: 1 },
    },
    {
      name: "drop macd (trend+rsi+stoch)",
      w: { trend: 1, rsi: 1, stoch: 1, macd: 0 },
    },
    {
      name: "drop rsi (trend+stoch+macd)",
      w: { trend: 1, rsi: 0, stoch: 1, macd: 1 },
    },
    { name: "trend-heavy 2:1:1:1", w: { trend: 2, rsi: 1, stoch: 1, macd: 1 } },
    {
      name: "trend x3, no momentum",
      w: { trend: 3, rsi: 0, stoch: 0, macd: 0 },
    },
  ];

  for (const horizon of Object.keys(HORIZONS) as (keyof typeof HORIZONS)[]) {
    console.log(`\n=== Horizon ${horizon} ===`);

    const dist = { up: 0, down: 0, flat: 0 };
    for (const s of samples) {
      const pct = s.pctChange[horizon];
      if (pct === undefined) continue;
      dist[pct > deadZonePct ? "up" : pct < -deadZonePct ? "down" : "flat"]++;
    }
    const total = dist.up + dist.down + dist.flat;
    console.log(
      `Actual class distribution: up=${((dist.up / total) * 100).toFixed(1)}% down=${((dist.down / total) * 100).toFixed(1)}% flat=${((dist.flat / total) * 100).toFixed(1)}% (n=${total})`,
    );

    console.log("config".padEnd(38) + "train".padEnd(52) + "test");
    for (const c of candidates) {
      const trainM = evaluate(train, c.w, horizon, deadZonePct);
      const testM = evaluate(test, c.w, horizon, deadZonePct);
      console.log(c.name.padEnd(38) + fmt(trainM).padEnd(52) + fmt(testM));
    }

    console.log("\nThreshold sweep (current equal weights):");
    console.log("threshold".padEnd(12) + "train".padEnd(52) + "test");
    const w: Weights = { trend: 1, rsi: 1, stoch: 1, macd: 1 };
    for (const t of [0.05, 0.1, 0.15, 0.1667, 0.2, 0.3, 0.4, 0.5]) {
      const trainM = evaluateAtThreshold(train, w, horizon, deadZonePct, t);
      const testM = evaluateAtThreshold(test, w, horizon, deadZonePct, t);
      console.log(
        t.toFixed(3).padEnd(12) + fmt(trainM).padEnd(52) + fmt(testM),
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
