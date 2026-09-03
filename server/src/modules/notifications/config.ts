export const notificationsConfig = {
  // Roadmap §7: "не более N уведомлений в сутки на пару" — общий лимит per
  // user+pair, независимо от того, сколько правил на неё навешано.
  maxPerPairPerDay: 3,
  // 'movement': roadmap описывает триггер как "|Δ| > 2×ATR за час", но у нас
  // нет часовых свечей — НБ РК даёт один дневной фиксинг (см. CLAUDE.md,
  // worker.ts). Адаптация: сравниваем day-over-day |Δclose| с ATR14 дневных
  // свечей вместо внутричасового движения.
  movement: {
    defaultAtrMultiplier: 2,
  },
  // 'news': roadmap описывает триггер как "impact_score > порога" на СВЕЖУЮ
  // новость — не путать с newsConfig.windowHours (24ч, окно агрегации
  // newsScore для прогноза). Здесь окно узкое: важна только что вышедшая
  // новость, а не любая релевантная за сутки.
  news: {
    lookbackHours: 6,
  },
  // 'daily': окно доставки утреннего прогноза в локальном tz пользователя
  // (roadmap §7 — "утро в TZ пользователя"). Полуоткрытый интервал [start, end).
  daily: {
    windowStartHour: 7,
    windowEndHour: 10,
  },
} as const;
