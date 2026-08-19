// Единое место для timeout/retry внешних вызовов (архитектурное правило 8,
// CLAUDE.md: "каждый внешний вызов — с таймаутом и ретраем"). Раньше эти
// числа были размазаны по market/fetch-with-retry.ts, news/config.ts и
// каждому LLM-explainer'у по отдельности, с несогласованными значениями —
// один файл на верхнем уровне вместо копии в каждом модуле.
export const httpConfig = {
  // НБ РК / ForexRateAPI — котировки (market/)
  fx: { timeoutMs: 10_000, retries: 2 },
  // RSS-фиды / Marketaux (news/) — Marketaux free-тир: 100 запросов/сутки,
  // при 15-минутном опросе (96 циклов/сутки) лишние ретраи съедают квоту.
  news: { timeoutMs: 10_000, retries: 2 },
  // Gemini / Anthropic — дороже и медленнее одного HTTP-вызова, ретраим
  // меньше, чем обычный REST-запрос.
  llm: { timeoutMs: 15_000, retries: 1 },
  marketauxFilters: {
    limit: 3,
    minMatchScore: 50,
  },
  marketaux: {
    timeoutMs: 10_000,
    retries: 1,
  },
} as const;
