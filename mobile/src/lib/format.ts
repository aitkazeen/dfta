/**
 * Форматирование чисел для интерфейса.
 *
 * ВНИМАНИЕ про локаль: бриф §8 требует для RU/KK запятую как десятичный
 * разделитель и пробел-разделитель тысяч («511,40 ₸»). Пока, на этапе
 * сверки с макетом, оставляем точку — ровно как в хендофф-файле («511.40 ₸»).
 * Когда дойдём до локализации — включаем правило §8 здесь, в одном месте,
 * и весь интерфейс подхватит его автоматически.
 *
 * Не используем Number.toLocaleString / Intl: в Hermes поддержка Intl
 * неполная и нестабильная между версиями — форматируем руками.
 */

/** Курс с фиксированным числом знаков: 511.4 → "511.40". */
export function formatRate(value: number, decimals = 2): string {
  return value.toFixed(decimals)
}

/** Целевой диапазон прогноза: (512, 515, "₸") → "512–515 ₸". */
export function formatRange(low: number, high: number, symbol: string, decimals = 0): string {
  return `${low.toFixed(decimals)}–${high.toFixed(decimals)} ${symbol}`
}

/** Дельта со знаком и процентом: 0.6 → "+0.6%", -1.8 → "−1.8%". */
export function formatSignedPct(value: number, decimals = 1): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${Math.abs(value).toFixed(decimals)}%`
}

/** Стрелка направления — дублирует цвет для дальтоников (бриф §3.1). */
export function directionArrow(direction: 'up' | 'down' | 'flat'): string {
  return direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→'
}
