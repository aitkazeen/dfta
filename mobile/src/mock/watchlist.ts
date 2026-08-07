import type { TodaySummary, WatchlistPair } from '../types'

/**
 * Моковый watchlist для главного экрана (4.2) — значения из хендофф-макета
 * `docs/design/watchlist.dc.html`. Заглушка на этап 0; форма совпадает
 * с доменными типами, позже заменится ответом бэкенда.
 */

const today: TodaySummary = {
  pairId: 'USD-KZT',
  ticker: 'USD/KZT',
  direction: 'up',
  directionLabel: 'Рост',
  targetLow: 512,
  targetHigh: 515,
  symbol: '₸',
  summary: 'Тренд поддержан решением НБ РК по ставке — сигнал умеренный.',
}

const pairs: WatchlistPair[] = [
  { id: 'USD-KZT', flags: '🇺🇸🇰🇿', base: 'USD', quote: 'KZT', rate: 511.4, symbol: '₸', direction: 'up', deltaPct: 0.6, spark: [0, 2, 1, 4, 3, 6, 8] },
  { id: 'EUR-KZT', flags: '🇪🇺🇰🇿', base: 'EUR', quote: 'KZT', rate: 556.8, symbol: '₸', direction: 'down', deltaPct: 0.3, spark: [8, 6, 7, 4, 5, 2, 1] },
  { id: 'RUB-KZT', flags: '🇷🇺🇰🇿', base: 'RUB', quote: 'KZT', rate: 6.12, symbol: '₸', direction: 'flat', deltaPct: 0.1, spark: [3, 4, 3, 4, 3, 4, 3] },
  { id: 'GBP-KZT', flags: '🇬🇧🇰🇿', base: 'GBP', quote: 'KZT', rate: 648.2, symbol: '₸', direction: 'up', deltaPct: 0.9, spark: [1, 3, 2, 5, 6, 7, 9] },
  { id: 'CNY-KZT', flags: '🇨🇳🇰🇿', base: 'CNY', quote: 'KZT', rate: 70.85, symbol: '₸', direction: 'down', deltaPct: 0.2, spark: [7, 6, 6, 5, 4, 4, 3] },
]

export function getWatchlist(): { today: TodaySummary; pairs: WatchlistPair[] } {
  return { today, pairs }
}
