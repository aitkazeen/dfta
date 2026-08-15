import type { ApiForecast } from '../api'
import type { Direction, Driver, Forecast } from '../types'

export const DIRECTION_LABEL: Record<Direction, string> = {
  up: 'Рост',
  down: 'Падение',
  flat: 'Без изменений',
}

/**
 * Пока нет реального прогноза (свежедобавленная пара, воркер ещё не прогнал
 * сутки) — узкий диапазон вокруг текущего курса, а не абсолютные числа мока:
 * те в масштабе USD-KZT (~510) и ломают домен графика на других парах.
 */
export function fallbackTargetRange(rate: number): { targetLow: number; targetHigh: number } {
  return { targetLow: rate * 0.995, targetHigh: rate * 1.01 }
}

/**
 * RulesForecastEngine + Explainer (этап 4) считают все поля кроме
 * enginePairAccuracyPct/enginePairWindowDays — эти два берём из prev (мок),
 * т.к. на бэкенде ещё нет роута отдающего агрегированную точность по паре
 * (сами forecast_outcome уже пишутся воркером, эндпоинта для чтения нет).
 * explanation/drivers у ответа API бывают null — если ANTHROPIC_API_KEY не
 * задан на бэкенде или LLM-вызов не удался, подставляем пустые значения.
 */
export function mapForecast(api: ApiForecast, prev: Forecast): Forecast {
  return {
    direction: api.direction,
    directionLabel: DIRECTION_LABEL[api.direction],
    targetLow: api.targetLow,
    targetHigh: api.targetHigh,
    confidence: Math.round(api.confidence * 100),
    explanation: api.explanation ?? '',
    drivers: (api.drivers as Driver[] | null) ?? [],
    enginePairAccuracyPct: prev.enginePairAccuracyPct,
    enginePairWindowDays: prev.enginePairWindowDays,
  }
}
