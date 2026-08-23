/**
 * Этап 4 роадмапа (§5.4, §9): "Бэктест на историческом датасете, walk-forward"
 * + правило 6 (CLAUDE.md): "confidence берётся из калиброванной таблицы
 * «скор → фактическая частота попадания» на walk-forward бэктесте (2+ года),
 * не из формулы наугад".
 *
 * Прогоняет RulesForecastEngine по всей истории `candle` (уже забэкфиллена
 * из server/data/nbk-rates-2y.csv скриптом fx:backfill-dataset — см. там же),
 * день за днём, ровно так же, как это делает worker.ts (predict() —
 * чистая функция, не знает, откуда пришли indicators/close). Это и есть
 * walk-forward: на каждый день i модель видит только indicator-снэпшот,
 * посчитанный по свечам [0..i], и её "прогноз" сверяется с тем, что
 * реально произошло на close[i+horizon].
 *
 * Упрощение, которое стоит держать в голове: newsScore = 0 для всей истории.
 * Двухлетнего архива новостей не существует (новостной пайплайн запущен
 * только в 2026-08), поэтому калибруется фактически technicalScore *
 * technicalWeight (0.6) — блендинг с новостями в бэктесте не участвует.
 * Когда появится историческая новостная лента — пересчитать.
 *
 * Запуск: npm run forecast:backtest   (из server/)
 */

import { PrismaClient } from "@prisma/client";
import { computeIndicators } from "../src/modules/indicators/compute.js";
import { RulesForecastEngine } from "../src/modules/forecast/rules-engine.js";
import { resolveForecastOutcome } from "../src/modules/forecast/outcomes.js";
import { forecastConfig } from "../src/modules/forecast/config.js";
import type { IndicatorSnapshot } from "../src/modules/forecast/types.js";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const HORIZONS = { "24h": 1, "7d": 7 } as const;
// deadZonePct выведен из тех же чисел конфига, что и в outcomes.ts
// (см. комментарий там) — не отдельный произвольный порог.
const DEAD_ZONE_PCT =
  forecastConfig.decision.flatThreshold * forecastConfig.decision.maxMovePct;
const BUCKET_WIDTH = 0.1;
const OUT_PATH = path.resolve(
  import.meta.dirname,
  "../src/modules/forecast/calibration.ts",
);

const db = new PrismaClient();
const engine = new RulesForecastEngine();

type Sample = { rawConfidence: number; wasCorrect: boolean };

async function backtestPair(
  pairId: string,
  horizonDays: number,
): Promise<Sample[]> {
  const candles = await db.candle.findMany({
    where: { pairId, timeframe: "1d" },
    orderBy: { ts: "asc" },
  });
  if (candles.length < 30) return [];

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

  // computeIndicators отдаёт плоский список {ts, name, value} — собираем
  // обратно в снэпшот на каждый день, как это делает getLatestIndicators
  // в проде (indicators/repository.ts), только на всю историю сразу.
  const byTs = new Map<number, IndicatorSnapshot>();
  for (const p of indicatorPoints) {
    const key = p.ts.getTime();
    const snap = byTs.get(key) ?? {};
    (snap as Record<string, number>)[p.name] = p.value;
    byTs.set(key, snap);
  }

  const samples: Sample[] = [];

  for (let i = 0; i < candles.length - horizonDays; i++) {
    const indicators = byTs.get(candles[i].ts.getTime()) ?? {};
    if (indicators.atr14 === undefined) continue; // тот же guard, что в RulesForecastEngine.predict

    const result = await engine.predict({
      pairId,
      horizon: "24h", // не влияет на direction/targets — только на calibrateConfidence ниже
      close: closes[i],
      indicators,
      newsScore: 0, // историческая новостная лента отсутствует, см. комментарий выше
    });

    const actualClose = closes[i + horizonDays];
    const { wasCorrect } = resolveForecastOutcome({
      direction: result.direction,
      originalClose: closes[i],
      targetLow: result.targetLow,
      targetHigh: result.targetHigh,
      actualClose,
      deadZonePct: DEAD_ZONE_PCT,
    });

    // Важно: НЕ result.confidence — predict() сам зовёт calibrateConfidence
    // (см. rules-engine.ts), которая читает уже сгенерированный этим же
    // скриптом calibration.ts. Бэктест должен всегда мерить сырой
    // |blendedScore| независимо от того, что сейчас лежит в таблице —
    // иначе повторный запуск калибрует таблицу по самой себе.
    const rawConfidence = Math.abs(
      (result.features as { blendedScore: number }).blendedScore,
    );
    samples.push({ rawConfidence, wasCorrect });
  }

  return samples;
}

type Bucket = { min: number; max: number; n: number; hitRate: number | null };

function bucketize(samples: Sample[]): Bucket[] {
  const buckets: Bucket[] = [];
  for (let min = 0; min < 1; min += BUCKET_WIDTH) {
    const max = min + BUCKET_WIDTH;
    const inBucket = samples.filter(
      (s) =>
        s.rawConfidence >= min && (max >= 1 ? s.rawConfidence <= max : s.rawConfidence < max),
    );
    const hitRate =
      inBucket.length === 0
        ? null
        : inBucket.filter((s) => s.wasCorrect).length / inBucket.length;
    buckets.push({ min, max, n: inBucket.length, hitRate });
  }
  return buckets;
}

// Pool Adjacent Violators — калиброванная confidence обязана расти
// (или хотя бы не падать) вместе с сырым скором, иначе таблица противоречит
// сама себе ("выше уверенность модели — ниже реальная точность" быть не
// должно). Пустые бакеты (нет сэмплов в этом диапазоне скора) пропускаются,
// а не считаются нулём.
function isotonicNonDecreasing(
  points: { x: number; y: number; weight: number }[],
): number[] {
  const stack: { sumY: number; sumW: number; count: number }[] = [];
  for (const p of points) {
    let block = { sumY: p.y * p.weight, sumW: p.weight, count: 1 };
    while (
      stack.length > 0 &&
      stack[stack.length - 1].sumY / stack[stack.length - 1].sumW >
        block.sumY / block.sumW
    ) {
      const prev = stack.pop()!;
      block = {
        sumY: prev.sumY + block.sumY,
        sumW: prev.sumW + block.sumW,
        count: prev.count + block.count,
      };
    }
    stack.push(block);
  }
  const result: number[] = [];
  for (const block of stack) {
    const avg = block.sumY / block.sumW;
    for (let i = 0; i < block.count; i++) result.push(avg);
  }
  return result;
}

function calibrate(
  buckets: Bucket[],
): { minScore: number; confidence: number; n: number }[] {
  const present = buckets.filter((b) => b.hitRate !== null);
  const calibratedValues = isotonicNonDecreasing(
    present.map((b) => ({ x: b.min, y: b.hitRate!, weight: b.n })),
  );
  return present.map((b, i) => ({
    minScore: b.min,
    confidence: Math.round(calibratedValues[i] * 1000) / 1000,
    n: b.n,
  }));
}

function printTable(title: string, buckets: Bucket[]): void {
  console.log(`\n${title}`);
  console.log("score bucket    n     raw hit rate");
  for (const b of buckets) {
    const label = `[${b.min.toFixed(1)}, ${b.max.toFixed(1)}${b.max >= 1 ? "]" : ")"}`;
    const rate = b.hitRate === null ? "  n/a" : (b.hitRate * 100).toFixed(1) + "%";
    console.log(`${label.padEnd(16)}${String(b.n).padEnd(6)}${rate}`);
  }
}

async function main(): Promise<void> {
  const pairs = await db.currencyPair.findMany({ where: { isActive: true } });
  const calibrationByHorizon: Record<
    string,
    { minScore: number; confidence: number; n: number }[]
  > = {};

  for (const [horizon, days] of Object.entries(HORIZONS)) {
    let allSamples: Sample[] = [];
    for (const pair of pairs) {
      const samples = await backtestPair(pair.id, days);
      allSamples = allSamples.concat(samples);
    }
    const buckets = bucketize(allSamples);
    printTable(
      `Horizon ${horizon} — ${allSamples.length} samples across ${pairs.length} pairs`,
      buckets,
    );
    calibrationByHorizon[horizon] = calibrate(buckets);
  }

  const fileContent = `// СГЕНЕРИРОВАНО: npm run forecast:backtest (server/scripts/backtest-forecast.ts)
// ${new Date().toISOString().slice(0, 10)} — не редактировать руками, перегенерировать бэктестом.
//
// Правило 6 (CLAUDE.md): confidence берётся из этой таблицы "скор → факт.
// частота попадания", не из формулы наугад. Таблица монотонна по построению
// (isotonic regression поверх walk-forward бэктеста на 2-летнем датасете
// НБ РК) — выше сырой |blendedScore| гарантированно не даёт ниже confidence.
//
// Ограничение: бэктест использует newsScore = 0 для всей истории (архива
// новостей за 2 года нет) — калибровка отражает фактически только
// technicalScore-часть блендинга.

export type CalibrationBreakpoint = { minScore: number; confidence: number };

export const calibration: Record<string, CalibrationBreakpoint[]> = ${JSON.stringify(
    Object.fromEntries(
      Object.entries(calibrationByHorizon).map(([h, points]) => [
        h,
        points.map((p) => ({ minScore: p.minScore, confidence: p.confidence })),
      ]),
    ),
    null,
    2,
  )};

// Наименьший калиброванный score ниже самого нижнего бакета с данными —
// используем confidence самого нижнего доступного бакета (экстраполяция
// вниз не делается, это было бы гаданием за пределами данных).
export function calibrateConfidence(rawScore: number, horizon: string): number {
  const table = calibration[horizon] ?? calibration["24h"];
  if (!table || table.length === 0) return rawScore;
  let result = table[0].confidence;
  for (const bp of table) {
    if (rawScore >= bp.minScore) result = bp.confidence;
  }
  return result;
}
`;

  await writeFile(OUT_PATH, fileContent, "utf-8");
  console.log(`\nWrote calibration table to ${OUT_PATH}`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
