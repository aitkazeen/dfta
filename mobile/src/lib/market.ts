import type { ApiCandle } from '../api'
import type { Direction } from '../types'

const FLAG: Record<string, string> = {
  USD: '🇺🇸',
  EUR: '🇪🇺',
  RUB: '🇷🇺',
  KZT: '🇰🇿',
}

/** Флаги для пары X/KZT — квота всегда KZT в текущем скоупе (CLAUDE.md §1). */
export function pairFlags(base: string, quote: string): string {
  return `${FLAG[base] ?? '🏳️'}${FLAG[quote] ?? '🏳️'}`
}

/**
 * Направление и дельта за 24ч из дневных свечей (воркер пишет их раз в 6ч,
 * см. server/src/worker.ts). База сравнения — закрытие предыдущего дня;
 * если истории меньше суток (свежая БД), берём open сегодняшней свечи как
 * приближение к «началу дня». deltaPct — без знака, знак несёт direction
 * (см. комментарий у WatchlistPair.deltaPct в types.ts).
 */
export function deriveDelta(currentRate: number, candles: ApiCandle[]): { deltaPct: number; direction: Direction } {
  if (candles.length === 0) return { deltaPct: 0, direction: 'flat' }

  const last = candles[candles.length - 1]
  const baseline = candles.length >= 2 ? candles[candles.length - 2].c : last.o
  if (!baseline) return { deltaPct: 0, direction: 'flat' }

  const rawPct = ((currentRate - baseline) / baseline) * 100
  const direction: Direction = rawPct > 0.05 ? 'up' : rawPct < -0.05 ? 'down' : 'flat'
  return { deltaPct: Math.abs(rawPct), direction }
}

/** Sparkline делит на (length - 1) — при одной точке это деление на ноль. */
export function sparkPoints(candles: ApiCandle[]): number[] {
  const closes = candles.map((c) => c.c)
  return closes.length >= 2 ? closes : [...closes, ...closes]
}
