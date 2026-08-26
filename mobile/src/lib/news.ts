import type { ApiNewsArticle, ApiPair } from "../api";
import type { IndicatorTone, NewsArticle } from "../types";

// |sentiment| ниже порога — считаем нейтральной, не "слабо позитивной"/
// "слабо негативной". Тот же порядок величины, что forecastConfig.decision.
// flatThreshold на бэкенде (0.1) — не совпадает намеренно: sentiment и
// technicalScore/blendedScore разные шкалы, отдельная константа.
const NEUTRAL_SENTIMENT_THRESHOLD = 0.15;

/** null — сентимент недоступен (LLM не classified статью или ключ не задан,
 *  см. CLAUDE.md 2026-08-23) — это не ошибка, просто нейтральный бейдж. */
export function sentimentTone(sentiment: number | null): IndicatorTone {
  if (sentiment === null) return "neutral";
  if (sentiment > NEUTRAL_SENTIMENT_THRESHOLD) return "up";
  if (sentiment < -NEUTRAL_SENTIMENT_THRESHOLD) return "down";
  return "neutral";
}

/** "28.07, 09:12" — тот же формат, что quoteTime в pairs/[id].tsx. */
export function formatNewsTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
  const time = d.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date}, ${time}`;
}

export type FeedArticle = NewsArticle & {
  url: string;
  publishedAt: string; // ISO — для сортировки по свежести
  pairIds: string[]; // какие пары из watchlist релевантны этой статье
};

type PairNews = { pair: ApiPair; articles: ApiNewsArticle[] };

/**
 * Сводит новости нескольких пар в одну ленту. Бэкенд отдаёт новости только
 * по одной паре за раз (GET /v1/pairs/:id/news, агрегированного эндпоинта
 * нет) — экран новостей дёргает его по каждой паре watchlist и мёрджит
 * здесь.
 *
 * Одна и та же статья может прийти для нескольких пар сразу (например,
 * новость НБ РК релевантна и USD/KZT, и EUR/KZT) — дедуп по url, тег
 * показывает все релевантные тикеры.
 */
export function mergeNews(byPair: PairNews[]): FeedArticle[] {
  const tickerById = new Map(
    byPair.map(({ pair }) => [pair.id, `${pair.base}/${pair.quote}`]),
  );
  const byUrl = new Map<
    string,
    { article: ApiNewsArticle; pairIds: string[] }
  >();

  for (const { pair, articles } of byPair) {
    for (const article of articles) {
      const entry = byUrl.get(article.url);
      if (entry) {
        if (!entry.pairIds.includes(pair.id)) entry.pairIds.push(pair.id);
      } else {
        byUrl.set(article.url, { article, pairIds: [pair.id] });
      }
    }
  }

  return Array.from(byUrl.values())
    .map(({ article, pairIds }): FeedArticle => ({
      source: article.source,
      time: formatNewsTime(article.publishedAt),
      title: article.title,
      tag: pairIds
        .map((id) => tickerById.get(id))
        .filter((t): t is string => t !== undefined)
        .join(", "),
      tone: sentimentTone(article.sentiment),
      url: article.url,
      publishedAt: article.publishedAt,
      pairIds,
    }))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
