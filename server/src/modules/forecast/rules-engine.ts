import { ForecastEngine, ForecastInput, ForecastResult } from "./types";
import { computeTechnicalScore } from "./compute";
import { forecastConfig } from "./config";

export class RulesForecastEngine implements ForecastEngine {
  readonly version = "rules-v1";

  async predict(input: ForecastInput): Promise<ForecastResult> {
    const technicalScore = computeTechnicalScore(input.indicators, input.close);

    if (input.indicators.atr14 === undefined) {
      return {
        direction: "flat",
        confidence: 0,
        targetLow: input.close,
        targetHigh: input.close,
        engineVersion: this.version,
        features: {
          technicalScore,
          close: input.close,
          indicators: input.indicators,
          reason: "no-atr",
        },
      };
    }

    const { flatThreshold, maxMovePct } = forecastConfig.decision;
    const direction =
      technicalScore > flatThreshold
        ? "up"
        : technicalScore < -flatThreshold
          ? "down"
          : "flat";
    const confidence = Math.abs(technicalScore);

    const mid = input.close * (1 + technicalScore * maxMovePct);
    const band = input.indicators.atr14 / 2;

    return {
      direction,
      confidence,
      targetLow: mid - band,
      targetHigh: mid + band,
      engineVersion: this.version,
      features: {
        technicalScore,
        close: input.close,
        indicators: input.indicators,
      },
    };
  }
}
