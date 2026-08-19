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
          newsScore: input.newsScore,
          close: input.close,
          indicators: input.indicators,
          reason: "no-atr",
        },
      };
    }

    const { flatThreshold, maxMovePct, technicalWeight, newsWeight } = {
      ...forecastConfig.decision,
      ...forecastConfig.merge,
    };
    // Слияние технического и новостного сигналов (roadmap §5.3):
    // technicalScore * 0.6 + newsScore * 0.4.
    const blendedScore =
      technicalScore * technicalWeight + input.newsScore * newsWeight;

    const direction =
      blendedScore > flatThreshold
        ? "up"
        : blendedScore < -flatThreshold
          ? "down"
          : "flat";
    const confidence = Math.abs(blendedScore);

    const mid = input.close * (1 + blendedScore * maxMovePct);
    const band = input.indicators.atr14 / 2;

    return {
      direction,
      confidence,
      targetLow: mid - band,
      targetHigh: mid + band,
      engineVersion: this.version,
      features: {
        technicalScore,
        newsScore: input.newsScore,
        blendedScore,
        close: input.close,
        indicators: input.indicators,
      },
    };
  }
}
