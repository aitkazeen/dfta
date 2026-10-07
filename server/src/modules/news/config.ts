// Веса и пороги новостного слоя — архитектурное правило 4 (CLAUDE.md):
// в конфиге, не в коде.
export const newsConfig = {
  // НБ РК — официальный источник истины (roadmap §3.1), весим выше глобального
  // агрегатора. Источник без записи здесь получает дефолт 0.5 в pipeline.ts.
  sourceWeight: {
    "nbk-rss": 1.0,
    marketaux: 0.7,
    // GDELT — глобальный агрегатор, как Marketaux, но покрывает казахстанские
    // источники, которых у Marketaux нет (CLAUDE.md 2026-09-30). Тот же вес.
    gdelt: 0.7,
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
    // Казахское написание "юань" совпадает с русским (как теңге/рубль).
    CNY: ["юань", "cny", "юань"],
  } as Record<string, string[]>,
  deduplicated: {
    period: 4 * 60 * 60 * 1000,
    similarityCoefficient: 0.8,
  },
  // GDELT 2.0 DOC API — бесплатно, без ключа (CLAUDE.md 2026-09-30, кандидат P4).
  gdelt: {
    docApiUrl: "https://api.gdeltproject.org/api/v2/doc/doc",
    // tone у GDELT примерно в [-10,10] (на практике редко за ±5); делим на это
    // число и клампим в [-1,1] → наша шкала sentiment. Это калибровочный
    // «knob»: GDELT tone не FX-калиброван, множитель подбираемый (правило 4).
    toneScale: 10,
    // Живой артлист-запрос за один цикл (все пары разом) — см. gdelt-source.ts.
    // >250 статей за запрос free-тир не отдаёт; нам хватает свежих.
    maxRecords: 75,
  },
};
