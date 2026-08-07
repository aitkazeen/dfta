/**
 * Доменные типы фронтенда. Пока их наполняют моки (src/mock),
 * позже — ответ бэкенда /v1/pairs/snapshot. Форма намеренно близка
 * к тому, что отдаст сервер, чтобы замена мока на fetch не ломала экраны.
 */

export type Direction = 'up' | 'down' | 'flat'

/** Одна свеча: open/high/low/close. */
export type Candle = {
  o: number
  h: number
  l: number
  c: number
}

/** Цветовой код интерпретации индикатора. */
export type IndicatorTone = 'up' | 'down' | 'warn' | 'neutral'

export type Indicator = {
  name: string // "RSI (14)"
  value: string // "68" — строка, т.к. бывает "3.8 ₸" / "Выше EMA50"
  interp: string // "Перекуплен"
  tone: IndicatorTone
}

/** Категория драйвера прогноза → определяет иконку чипа. */
export type DriverCategory = 'technical' | 'news' | 'regulator' | 'global'

export type Driver = {
  category: DriverCategory
  text: string // "Техника: цена выше EMA50"
}

/** Развёрнутый драйвер прогноза для экрана 4.4 — то же деление по категориям,
 *  что и у компактного Driver, но с заголовком, объяснением влияния и источником. */
export type FullForecastDriver = {
  category: DriverCategory
  what: string // "НБ РК повысил базовую ставку до 15.75%"
  impact: string // "Более высокая ставка обычно поддерживает нацвалюту..."
  source: string // "НБ РК, пресс-релиз"
}

/** Горизонт полного прогноза (4.4). Пока переключатель визуальный —
 *  как таймфрейм на 4.3, данные под него не перезапрашиваются (см. TODO в экране). */
export type ForecastHorizon = '24ч' | '7д'

/** Ряды «предсказано vs. факт» за 30 дней для графика точности на 4.4. */
export type AccuracyTrend = {
  predicted: number[]
  actual: number[]
}

/**
 * Полный прогноз для экрана 4.4 — детализация ForecastCard с 4.3:
 * объяснение уверенности, текст от LLM, развёрнутые драйверы с источниками,
 * честная статистика с графиком предсказано/факт (правило 5 и 6 CLAUDE.md).
 */
export type FullForecast = {
  pairId: string // "USD-KZT"
  ticker: string // "USD/KZT"
  direction: Direction
  directionLabel: string // "Рост"
  targetLow: number
  targetHigh: number
  symbol: string
  currentRate: number
  confidence: number // 0..100
  confidenceExplanation: string
  aiExplanation: string // текст от LLM по уже посчитанным числам (правило 3)
  drivers: FullForecastDriver[]
  accuracy: { total: number; windowDays: number; hitRatePct: number }
  trend: AccuracyTrend
}

export type NewsArticle = {
  source: string // "НБ РК"
  time: string // "28.07, 09:12"
  title: string
  tag: string // "Влияет на USD/KZT"
}

export type Forecast = {
  direction: Direction
  directionLabel: string // "Рост"
  targetLow: number
  targetHigh: number
  confidence: number // 0..100, из калиброванной таблицы (бриф, правило 6)
  explanation: string // текст от LLM по уже посчитанным числам
  drivers: Driver[]
  /** Реальная точность движка по этой паре — не маркетинговая (правило 5). */
  enginePairAccuracyPct: number // 61
  enginePairWindowDays: number // 90
}

/** История попаданий прогнозов для блока «Точность прогнозов». */
export type AccuracyStats = {
  hitRatePct: number // 61
  total: number // 148
  windowDays: number // 90
  outcomes: boolean[] // последние N резолвов: true = совпало
}

/**
 * Полный снимок пары для экрана 4.3. В проде отдаётся из кэша
 * (архитектурное правило 7) одним запросом, без N обращений.
 */
export type PairSnapshot = {
  id: string // "USD-KZT" — используется в роуте /pairs/[id]
  base: string // "USD"
  quote: string // "KZT"
  symbol: string // "₸" — символ котируемой валюты
  rate: number // 511.4
  deltaPct: number // +0.6 за 24ч
  direction: Direction
  quoteTime: string // "11:32"
  officialLine: string // "НБ РК: 511.2 ₸ на 28.07"
  candles: Candle[]
  forecast: Forecast
  indicators: Indicator[]
  news: NewsArticle[]
  accuracy: AccuracyStats
}

export type Timeframe = '1Ч' | '1Д' | '1Н' | '1М' | '1Г'

/** Строка watchlist (главный экран 4.2, §3.4 PairRow). */
export type WatchlistPair = {
  id: string // "USD-KZT" — роут /pairs/[id]
  flags: string // "🇺🇸🇰🇿"
  base: string // "USD"
  quote: string // "KZT"
  rate: number // 511.4
  symbol: string // "₸"
  direction: Direction
  deltaPct: number // 0.6 за 24ч (знак берём из direction, не из значения)
  spark: number[] // ~7 точек микро-спарклайна
}

/** Верхняя карточка «Сегодня» на watchlist — сокращённый прогноз по паре №1. */
export type TodaySummary = {
  pairId: string
  ticker: string // "USD/KZT"
  direction: Direction
  directionLabel: string // "Рост"
  targetLow: number
  targetHigh: number
  symbol: string
  summary: string // одна строка объяснения
}
