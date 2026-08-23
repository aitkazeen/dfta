// Веса и пороги новостного слоя — архитектурное правило 4 (CLAUDE.md):
// в конфиге, не в коде.
export const newsConfig = {
  // НБ РК — официальный источник истины (roadmap §3.1), весим выше глобального
  // агрегатора. Источник без записи здесь получает дефолт 0.5 в pipeline.ts.
  sourceWeight: {
    "nbk-rss": 1.0,
    marketaux: 0.7,
  } as Record<string, number>,
  // Новости устаревают быстрее дневных свечей — половина веса каждые 12ч.
  halfLifeHours: 12,
  // Окно, за которое считается newsScore для прогноза (roadmap §5.2: 24ч).
  windowHours: 24,
  // Ключевые слова для RSS-источников без готовых entities (Marketaux их
  // даёт сам — см. relevantPairsForArticle в pipeline.ts).
  relevanceKeywords: {
    KZT: ["тенге", "kzt", "теңге"],
    USD: ["доллар", "usd"],
    EUR: ["евро", "еуро", "eur"],
    RUB: ["рубль", "рубл", "rub"],
  } as Record<string, string[]>,
  deduplicated: {
    period: 4 * 60 * 60 * 1000,
    similarityCoefficient: 0.8,
  },
};
