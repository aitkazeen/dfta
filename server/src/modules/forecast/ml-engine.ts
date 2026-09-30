import {
  ForecastEngine,
  ForecastInput,
  ForecastResult,
  IndicatorSnapshot,
  Direction,
} from "./types.js";
import {
  difference,
  centered100,
  atrRelative,
  weightedAverage,
} from "./compute.js";
import { forecastConfig } from "./config.js";
import { predictProba, type LogRegModel } from "./logreg.js";
import { mlModels } from "./ml-model-data.js";

// v2-движок за тем же интерфейсом ForecastEngine (правило 2 CLAUDE.md):
// замена RulesForecastEngine на этот не должна трогать приложение. Модель —
// multinomial logreg, обученная скриптом forecast:backtest-ml на walk-forward
// train-части, коэффициенты лежат в сгенерированном ml-model-data.ts.
//
// Порядок классов ФИКСИРОВАН и общий у обучения (harness) и инференса — иначе
// argmax укажет не на то направление.
export const ML_DIRECTIONS: Direction[] = ["up", "down", "flat"];

export type MlModelBundle = {
  featureNames: string[]; // порядок фич в векторе, общий у train и inference
  model: LogRegModel;
};

// Единственный источник правды по фичам: и обучение, и инференс строят вектор
// отсюда, чтобы train/serve skew был невозможен. null-сигналы (вырожденные
// индикаторы на single-fix свечах, см. compute.ts) импутируются нейтральным 0.
export function buildFeatureMap(
  indicators: IndicatorSnapshot,
  close: number,
  exogenous?: Record<string, number>,
): Record<string, number> {
  const { emaStack } = forecastConfig;
  const { ema20, ema50, ema200, rsi14, stoch_k, macd, atr14 } = indicators;
  const trend = weightedAverage([
    { score: difference(close, ema20, emaStack.emaDeviation), weight: 1 },
    { score: difference(ema20, ema50, emaStack.emaDeviation), weight: 1 },
    { score: difference(ema50, ema200, emaStack.emaDeviation), weight: 1 },
  ]);
  const map: Record<string, number> = {
    trend: trend ?? 0,
    rsi: centered100(rsi14) ?? 0,
    stoch: centered100(stoch_k) ?? 0,
    macd: atrRelative(macd, atr14) ?? 0,
  };
  if (exogenous) for (const [k, v] of Object.entries(exogenous)) map[k] = v;
  return map;
}

function flatResult(input: ForecastInput, reason: string): ForecastResult {
  return {
    direction: "flat",
    confidence: 0,
    targetLow: input.close,
    targetHigh: input.close,
    engineVersion: "ml-v1",
    features: { reason, close: input.close, indicators: input.indicators },
  };
}

export class MlForecastEngine implements ForecastEngine {
  readonly version = "ml-v1";
  private readonly models: Record<string, MlModelBundle>;

  // По умолчанию читает сгенерированные коэффициенты; в тестах/бэктесте можно
  // передать свежеобученные модели напрямую.
  constructor(models: Record<string, MlModelBundle> = mlModels) {
    this.models = models;
  }

  async predict(input: ForecastInput): Promise<ForecastResult> {
    const bundle = this.models[input.horizon];
    // Нет обученной модели или нет ATR (тот же guard, что в RulesForecastEngine)
    // → честный flat с confidence 0, а не выдуманное направление.
    if (!bundle || input.indicators.atr14 === undefined) {
      return flatResult(input, bundle ? "no-atr" : "no-model");
    }

    const map = buildFeatureMap(input.indicators, input.close, input.exogenous);
    const x = bundle.featureNames.map((n) => map[n] ?? 0);
    const proba = predictProba(bundle.model, x);

    let idx = 0;
    for (let k = 1; k < proba.length; k++) if (proba[k] > proba[idx]) idx = k;
    const direction = ML_DIRECTIONS[idx];
    const confidence = proba[idx];

    // Направленный прокси-скор для диапазона: P(up) - P(down). Диапазон/полоса —
    // как в RulesForecastEngine (ATR/2), чтобы клиент рисовал одинаково.
    const scoreProxy = proba[0] - proba[1];
    const mid =
      input.close * (1 + scoreProxy * forecastConfig.decision.maxMovePct);
    const band = input.indicators.atr14 / 2;

    return {
      direction,
      confidence,
      targetLow: mid - band,
      targetHigh: mid + band,
      engineVersion: this.version,
      features: {
        proba: { up: proba[0], down: proba[1], flat: proba[2] },
        scoreProxy,
        newsScore: input.newsScore,
        close: input.close,
        indicators: input.indicators,
        exogenous: input.exogenous ?? null,
      },
    };
  }
}
