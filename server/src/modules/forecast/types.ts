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
  // Не опционально — воркер всегда считает его через news/repository.ts
  // getNewsScore (0, если новостей за окно не было), см. roadmap §5.3.
  newsScore: number;
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

// Категории драйверов синхронизированы с mobile/src/types.ts DriverCategory —
// 'news'/'regulator'/'global' зарезервированы под этапы 3+, когда появится
// новостной слой. Explainer сегодня видит только технические индикаторы,
// поэтому реально проставляет только 'technical'.
export type DriverCategory = "technical" | "news" | "regulator" | "global";

export type ExplainDriver = {
  category: DriverCategory;
  text: string;
};

export type ExplainInput = {
  base: string; // "USD"
  quote: string; // "KZT"
  direction: Direction;
  technicalScore: number;
  close: number;
  targetLow: number;
  targetHigh: number;
  indicators: IndicatorSnapshot;
};

export type ExplainResult = {
  explanation: string;
  drivers: ExplainDriver[];
};

// Правило 3 (CLAUDE.md): LLM только генерирует текст объяснения по уже
// посчитанным числам, никогда не участвует в расчёте самого прогноза.
// null — explainer недоступен или ответ не удалось получить/распарсить;
// это не должно ронять генерацию прогноза (см. worker.ts maybeGenerateForecast).
export interface Explainer {
  explain(input: ExplainInput): Promise<ExplainResult | null>;
}
