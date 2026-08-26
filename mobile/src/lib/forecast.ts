import type { ApiForecast, ApiForecastHistory } from "../api";
import type {
  Direction,
  Driver,
  DriverCategory,
  Forecast,
  FullForecastDriver,
} from "../types";

export const DIRECTION_LABEL: Record<Direction, string> = {
  up: "Рост",
  down: "Падение",
  flat: "Без изменений",
};

// Дублирует forecastConfig.historyWindowDays на бэкенде (server/src/modules/forecast/config.ts) —
// импортировать оттуда нельзя, мобильный код не видит серверный. Используется только как
// подпись окна, когда история ещё не пришла (см. mapForecast ниже); при обновлении держи в синхроне.
const DEFAULT_HISTORY_WINDOW_DAYS = 90;

/**
 * Пока нет реального прогноза (свежедобавленная пара, воркер ещё не прогнал
 * сутки) — узкий диапазон вокруг текущего курса, а не абсолютные числа мока:
 * те в масштабе USD-KZT (~510) и ломают домен графика на других парах.
 */
export function fallbackTargetRange(rate: number): {
  targetLow: number;
  targetHigh: number;
} {
  return { targetLow: rate * 0.995, targetHigh: rate * 1.01 };
}

/**
 * RulesForecastEngine + Explainer (этап 4) считают все поля кроме
 * enginePairAccuracyPct/enginePairWindowDays — эти два берём из prev (мок),
 * т.к. на бэкенде ещё нет роута отдающего агрегированную точность по паре
 * (сами forecast_outcome уже пишутся воркером, эндпоинта для чтения нет).
 * explanation/drivers у ответа API бывают null — если ANTHROPIC_API_KEY не
 * задан на бэкенде или LLM-вызов не удался, подставляем пустые значения.
 */
export function mapForecast(
  api: ApiForecast,
  history: ApiForecastHistory | null,
): Forecast {
  return {
    direction: api.direction,
    directionLabel: DIRECTION_LABEL[api.direction],
    targetLow: api.targetLow,
    targetHigh: api.targetHigh,
    confidence: Math.round(api.confidence * 100),
    explanation: api.explanation ?? "",
    drivers: (api.drivers as Driver[] | null) ?? [],
    enginePairAccuracyPct: history?.hitRatePct ?? 0,
    enginePairWindowDays: history?.windowDays ?? DEFAULT_HISTORY_WINDOW_DAYS, // хотя бы окно показать честно, даже без статистики
  };
}

const CATEGORY_SOURCE: Record<DriverCategory, string> = {
  technical: "Технический анализ",
  news: "Новостной анализ",
  regulator: "Регулятор",
  global: "Мировой рынок",
};

export function toFullDrivers(drivers: Driver[]): FullForecastDriver[] {
  return drivers.map((d) => ({
    category: d.category,
    what: d.text,
    impact: d.text, // короче показывать нечего — второго предложения LLM не отдаёт
    source: CATEGORY_SOURCE[d.category],
  }));
}
