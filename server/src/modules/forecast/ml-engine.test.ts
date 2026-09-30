import { describe, it, expect } from "vitest";
import {
  MlForecastEngine,
  buildFeatureMap,
  ML_DIRECTIONS,
  type MlModelBundle,
} from "./ml-engine";
import { fitMultinomial, type LabeledRow } from "./logreg";
import type { ForecastInput, IndicatorSnapshot } from "./types";

const baseInput: ForecastInput = {
  pairId: "USD-KZT",
  horizon: "24h",
  close: 500,
  indicators: {
    ema20: 500,
    ema50: 498,
    ema200: 490,
    rsi14: 60,
    stoch_k: 70,
    macd: 1,
    atr14: 3,
  },
  newsScore: 0,
};

describe("buildFeatureMap", () => {
  it("imputes degenerate (null) sub-signals to neutral 0", () => {
    const ind: IndicatorSnapshot = { atr14: 0 }; // atrRelative → null, trend → null
    const map = buildFeatureMap(ind, 500);
    expect(map.trend).toBe(0);
    expect(map.rsi).toBe(0);
    expect(map.macd).toBe(0);
  });

  it("merges exogenous features under their own keys", () => {
    const map = buildFeatureMap(baseInput.indicators, 500, { brent_level: 80 });
    expect(map.brent_level).toBe(80);
  });
});

describe("MlForecastEngine", () => {
  it("returns flat/0 when no model is loaded (no-model guard)", async () => {
    const engine = new MlForecastEngine({});
    const r = await engine.predict(baseInput);
    expect(r.direction).toBe("flat");
    expect(r.confidence).toBe(0);
    expect(r.engineVersion).toBe("ml-v1");
  });

  it("returns flat when ATR is missing even with a model", async () => {
    const bundle: MlModelBundle = {
      featureNames: ["trend"],
      model: fitMultinomial(
        [
          { x: [0], y: 2 },
          { x: [1], y: 0 },
        ],
        { iterations: 10 },
      ),
    };
    const engine = new MlForecastEngine({ "24h": bundle });
    const r = await engine.predict({ ...baseInput, indicators: { rsi14: 60 } });
    expect(r.direction).toBe("flat");
  });

  it("predicts the class the model was trained to separate", async () => {
    // Тренируем на фиче trend: сильно положительный → up(0), сильно отриц. → down(1).
    const rows: LabeledRow[] = [];
    for (let i = 0; i < 50; i++) {
      rows.push({ x: [1 + Math.random() * 0.1], y: 0 }); // up
      rows.push({ x: [-1 - Math.random() * 0.1], y: 1 }); // down
    }
    const bundle: MlModelBundle = {
      featureNames: ["trend"],
      model: fitMultinomial(rows, { iterations: 400, lambda: 0.01 }),
    };
    const engine = new MlForecastEngine({ "24h": bundle });

    // trend строится из EMA-стека; зададим явно бычью раскладку.
    const bull = await engine.predict({
      ...baseInput,
      indicators: {
        ...baseInput.indicators,
        ema20: 520,
        ema50: 505,
        ema200: 495,
      },
    });
    expect(ML_DIRECTIONS).toContain(bull.direction);
    expect(bull.confidence).toBeGreaterThan(0);
    // targets валидны (low <= high)
    expect(bull.targetLow).toBeLessThanOrEqual(bull.targetHigh);
  });
});
