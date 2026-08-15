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
 * RulesForecastEngine (этап 4) уже считает direction/confidence/targetLow/High —
 * explanation/drivers остаются null, пока не подключён LLM-шаг, поэтому
 * подставляем пустые значения, а не пытаемся угадать текст.
 * enginePairAccuracyPct/enginePairWindowDays берём из prev (мок) — это
 * требует forecast_outcome (задача #9), которого ещё нет.
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
