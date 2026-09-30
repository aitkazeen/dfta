/**
 * Feature-matrix walk-forward бэктест MlForecastEngine (P0).
 *
 * Тот же честный протокол, что у backtest-forecast.ts / tune-forecast-weights.ts
 * (walk-forward, train/test split по времени 75/25 на каждую пару, наивный
 * baseline "самый частый класс"), но вместо перебора весов линейного скора —
 * обучение multinomial-логрега (forecast/logreg.ts) на матрице фич и ЧЕСТНАЯ
 * out-of-sample directional precision на held-out 25%.
 *
 * ЧЕМ ОТЛИЧАЕТСЯ от legacy-скриптов и почему: те читают candle из Postgres
 * (прод-путь калибровки при поднятом Docker). Этот читает
 * server/data/nbk-rates-2y.csv напрямую — тот же датасет, что fx:backfill-dataset
 * грузит в candle, но без зависимости от поднятой БД. Так бэктест
 * воспроизводим в CI и в этой сессии без Docker. Фичи строятся ЕДИНОЙ функцией
 * buildFeatureMap (forecast/ml-engine.ts) — той же, что использует инференс, →
 * train/serve skew невозможен.
 *
 * Метрика-гейт (для всех следующих шагов плана точности): OOS directional
 * precision модели против baselineAccuracy на test, по горизонтам. Если модель
 * не обгоняет baseline — направленного edge в этих фичах нет (roadmap §10).
 *
 * CSV захардкожен на 3 пары калибровочного датасета (USD/EUR/RUB-KZT). CNY/KZT
 * в датасете нет — см. CLAUDE.md 2026-09-30.
 *
 * Запуск: npm run forecast:backtest-ml   (из server/)
 * Пишет обученные на ВСЕЙ истории модели в forecast/ml-model-data.ts.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { computeIndicators } from "../src/modules/indicators/compute.js";
import {
  buildFeatureMap,
  ML_DIRECTIONS,
} from "../src/modules/forecast/ml-engine.js";
import {
  fitMultinomial,
  predictClass,
  type LabeledRow,
  type LogRegModel,
} from "../src/modules/forecast/logreg.js";
import { forecastConfig } from "../src/modules/forecast/config.js";
import type {
  IndicatorSnapshot,
  Direction,
} from "../src/modules/forecast/types.js";

const CSV_PATH = path.resolve(import.meta.dirname, "../data/nbk-rates-2y.csv");
const OUT_PATH = path.resolve(
  import.meta.dirname,
  "../src/modules/forecast/ml-model-data.ts",
);
const HORIZONS = { "24h": 1, "7d": 7 } as const;
const TRAIN_FRACTION = 0.75;
// Порядок фич P0 (технические под-сигналы). P1 добавит экзогенные (brent_*).
const FEATURE_NAMES = ["trend", "rsi", "stoch", "macd"] as const;

// Экзогенные фичи по (pairId, dateISO) — пусто в P0, заполняется в P1 (Brent).
type ExogenousLookup = (
  pairId: string,
  dateISO: string,
) => Record<string, number>;

type FeatureRow = {
  pairId: string;
  ts: number;
  features: number[];
  label: Record<keyof typeof HORIZONS, Direction | undefined>;
};

const PAIRS = [
  { pairId: "USD-KZT", col: 1 },
  { pairId: "EUR-KZT", col: 2 },
  { pairId: "RUB-KZT", col: 3 },
] as const;

function loadRows(exogenous?: ExogenousLookup): FeatureRow[] {
  const raw = readFileSync(CSV_PATH, "utf-8").trim();
  const [, ...lines] = raw.split("\n");
  const dates = lines.map((l) => l.split(",")[0]);
  const rows: FeatureRow[] = [];

  for (const { pairId, col } of PAIRS) {
    const rates = lines.map((l) => Number(l.split(",")[col]));
    const candles = rates.map((r, i) => ({
      ts: new Date(`${dates[i]}T00:00:00.000Z`),
      open: r,
      high: r,
      low: r,
      close: r,
    }));
    const indicatorPoints = computeIndicators(candles);
    const byTs = new Map<number, IndicatorSnapshot>();
    for (const p of indicatorPoints) {
      const key = p.ts.getTime();
      const snap = byTs.get(key) ?? {};
      (snap as Record<string, number>)[p.name] = p.value;
      byTs.set(key, snap);
    }

    for (let i = 0; i < candles.length; i++) {
      const ind = byTs.get(candles[i].ts.getTime()) ?? {};
      if (ind.atr14 === undefined) continue; // тот же guard, что в движках
      const map = buildFeatureMap(ind, rates[i], exogenous?.(pairId, dates[i]));
      const features = FEATURE_NAMES.map((n) => map[n] ?? 0);

      const label = {} as Record<keyof typeof HORIZONS, Direction | undefined>;
      for (const [h, days] of Object.entries(HORIZONS) as [
        keyof typeof HORIZONS,
        number,
      ][]) {
        const future = rates[i + days];
        if (future === undefined) {
          label[h] = undefined;
          continue;
        }
        // Мёртвая зона факта — как в проде (outcomes.ts / worker.ts).
        const flatBand =
          forecastConfig.decision.flatBandAtrMult *
          (ind.atr14 as number) *
          Math.sqrt(days);
        const move = future - rates[i];
        label[h] = move > flatBand ? "up" : move < -flatBand ? "down" : "flat";
      }
      rows.push({ pairId, ts: candles[i].ts.getTime(), features, label });
    }
  }
  return rows;
}

function splitTrainTest(rows: FeatureRow[]) {
  const byPair = new Map<string, FeatureRow[]>();
  for (const r of rows) {
    const arr = byPair.get(r.pairId) ?? [];
    arr.push(r);
    byPair.set(r.pairId, arr);
  }
  const train: FeatureRow[] = [];
  const test: FeatureRow[] = [];
  for (const arr of byPair.values()) {
    arr.sort((a, b) => a.ts - b.ts);
    const cut = Math.floor(arr.length * TRAIN_FRACTION);
    train.push(...arr.slice(0, cut));
    test.push(...arr.slice(cut));
  }
  return { train, test };
}

const dirIndex = (d: Direction) => ML_DIRECTIONS.indexOf(d);

function toLabeledRows(
  rows: FeatureRow[],
  horizon: keyof typeof HORIZONS,
): LabeledRow[] {
  return rows
    .filter((r) => r.label[horizon] !== undefined)
    .map((r) => ({
      x: r.features,
      y: dirIndex(r.label[horizon] as Direction),
    }));
}

type EvalResult = {
  n: number;
  overallAccuracy: number;
  directionalPrecision: number | null;
  coverage: number;
  baselineAccuracy: number;
  baselineClass: Direction;
};

function evaluate(
  model: LogRegModel,
  rows: FeatureRow[],
  horizon: keyof typeof HORIZONS,
): EvalResult | null {
  const counts = { up: 0, down: 0, flat: 0 };
  let n = 0;
  let overallCorrect = 0;
  let dirPredicted = 0;
  let dirCorrect = 0;

  for (const r of rows) {
    const actual = r.label[horizon];
    if (actual === undefined) continue;
    const predicted = ML_DIRECTIONS[predictClass(model, r.features)];
    n++;
    counts[actual]++;
    if (predicted === actual) overallCorrect++;
    if (predicted !== "flat") {
      dirPredicted++;
      if (predicted === actual) dirCorrect++;
    }
  }
  if (n === 0) return null;

  const baselineClass = Object.entries(counts).sort(
    (a, b) => b[1] - a[1],
  )[0][0] as Direction;
  return {
    n,
    overallAccuracy: overallCorrect / n,
    directionalPrecision: dirPredicted ? dirCorrect / dirPredicted : null,
    coverage: dirPredicted / n,
    baselineAccuracy: counts[baselineClass] / n,
    baselineClass,
  };
}

const pct = (x: number | null) =>
  x === null ? "n/a" : (x * 100).toFixed(1) + "%";

function main() {
  const rows = loadRows();
  const { train, test } = splitTrainTest(rows);
  console.log(
    `Loaded ${rows.length} feature rows across ${PAIRS.length} pairs (train=${train.length}, test=${test.length})`,
  );
  console.log(`Features: [${FEATURE_NAMES.join(", ")}]\n`);

  const finalModels: Record<
    string,
    { featureNames: string[]; model: LogRegModel }
  > = {};

  for (const horizon of Object.keys(HORIZONS) as (keyof typeof HORIZONS)[]) {
    const trainRows = toLabeledRows(train, horizon);
    const model = fitMultinomial(trainRows, {
      lambda: 1.0,
      lr: 0.5,
      iterations: 500,
    });
    const trainEval = evaluate(model, train, horizon);
    const testEval = evaluate(model, test, horizon);

    console.log(`=== Horizon ${horizon} ===`);
    if (trainEval)
      console.log(
        `  train: acc=${pct(trainEval.overallAccuracy)} dir.precision=${pct(
          trainEval.directionalPrecision,
        )} coverage=${pct(trainEval.coverage)} baseline=${pct(
          trainEval.baselineAccuracy,
        )} (${trainEval.baselineClass}) n=${trainEval.n}`,
      );
    if (testEval) {
      const edge =
        testEval.directionalPrecision === null
          ? null
          : testEval.directionalPrecision - testEval.baselineAccuracy;
      console.log(
        `  TEST:  acc=${pct(testEval.overallAccuracy)} dir.precision=${pct(
          testEval.directionalPrecision,
        )} coverage=${pct(testEval.coverage)} baseline=${pct(
          testEval.baselineAccuracy,
        )} (${testEval.baselineClass}) n=${testEval.n}`,
      );
      console.log(
        `  >> OOS edge (dir.precision - baseline): ${
          edge === null
            ? "n/a"
            : (edge >= 0 ? "+" : "") + (edge * 100).toFixed(1) + "pp"
        }${edge !== null && edge <= 0 ? "  → нет направленного преимущества" : ""}\n`,
      );
    }

    // Финальная модель для прода — обучена на ВСЕЙ истории (train+test).
    finalModels[horizon] = {
      featureNames: [...FEATURE_NAMES],
      model: fitMultinomial(toLabeledRows(rows, horizon), {
        lambda: 1.0,
        lr: 0.5,
        iterations: 500,
      }),
    };
  }

  const content = `// СГЕНЕРИРОВАНО: npm run forecast:backtest-ml (server/scripts/backtest-ml.ts)
// ${new Date().toISOString().slice(0, 10)} — не редактировать руками, перегенерировать бэктестом.
//
// Multinomial-логрег (forecast/logreg.ts), обучен walk-forward на 2-летнем
// датасете НБ РК (USD/EUR/RUB-KZT). Классы: ${JSON.stringify(ML_DIRECTIONS)}.
// Ограничение: newsScore/экзогенные фичи в P0 не участвуют — только технические
// под-сигналы. OOS directional precision см. в выводе backtest-ml.
import type { MlModelBundle } from "./ml-engine.js";

export const mlModels: Record<string, MlModelBundle> = ${JSON.stringify(
    finalModels,
    null,
    2,
  )};
`;
  writeFileSync(OUT_PATH, content, "utf-8");
  console.log(`Wrote trained models to ${OUT_PATH}`);
}

main();
