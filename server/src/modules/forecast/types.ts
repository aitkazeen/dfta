export type IndicatorSnapshot = Partial<{
  ema20: number;
  ema50: number;
  ema200: number;
  rsi14: number;
  stoch_k: number;
  macd: number;
  atr14: number;
}>;

export type Direction = "up" | "down" | "flat";

export type ForecastInput = {
  pairId: string;
  horizon: "24h" | "7d";
  close: number;
  indicators: IndicatorSnapshot;
};

export type ForecastResult = {
  direction: Direction;
  confidence: number; // 0..1, пока — задача #5, заглушка
  targetLow: number;
  targetHigh: number;
  engineVersion: string;
  features: Record<string, unknown>; // снимок входов для аудита, пишется в forecast.features
};

export interface ForecastEngine {
  predict(input: ForecastInput): Promise<ForecastResult>;
  readonly version: string;
}
