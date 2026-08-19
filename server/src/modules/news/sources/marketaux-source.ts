import { createHash } from "node:crypto";
import { httpConfig } from "../../../config.js";
import type { INewsSource, NewsEntity, RawNewsArticle } from "../types.js";
import { fetchWithRetry } from "../../../utils/fetch-with-retry.js";

// Экспортирован — pipeline.ts использует ту же функцию в обратную сторону
// (сверяет entities статьи с парами), чтобы формат символа не разъехался
// в двух местах.
export function toMarketauxSymbol(pairId: string): string {
  return pairId.replace("-", ""); // подтверждено живым вызовом: "USD-KZT" -> "USDKZT"
}

type MarketauxHighlight = {
  sentiment: number | null;
  highlighted_in: string;
};

type MarketauxEntity = {
  symbol: string;
  type: string; // "currency" | "equity" | ...
  country: string;
  match_score: number;
  // sentiment_score почти всегда null на практике (живьём проверено) —
  // реальный сентимент лежит в highlights, не здесь.
  sentiment_score: number | null;
  highlights: MarketauxHighlight[];
};

type MarketauxArticle = {
  uuid: string;
  title: string;
  description: string;
  url: string;
  language: string;
  published_at: string;
  source: string;
  entities: MarketauxEntity[];
};

type MarketauxResponse = {
  data?: MarketauxArticle[];
  error?: { code: string; message: string };
};

/**
 * Marketaux — дополняет НБ РК, не заменяет (архитектурное правило 1
 * трактуется здесь иначе, чем для IQuoteProvider: источники новостей
 * складываются, а не подменяют друг друга — см. news/types.ts).
 *
 * match_score у сущности — собственная оценка Marketaux, насколько уверенно
 * упоминание валюты в тексте относится к делу, а не сентимент. Живьём
 * проверено: статья про подписку на ChatGPT получила валютную сущность
 * с match_score ~23 (случайное упоминание), а реально валютные статьи —
 * ~70+. Порог minMatchScore (config.ts) отсекает первое от второго —
 * без него prefilter по symbols/entity_types пропускает много шума.
 */
export class MarketauxSource implements INewsSource {
  public id = "marketaux";

  constructor(
    private readonly apiKey: string,
    private readonly pairIds: string[] = ["USD-KZT", "EUR-KZT", "RUB-KZT"],
  ) {}

  async fetchLatest(): Promise<RawNewsArticle[]> {
    const trackedSymbols = new Set(this.pairIds.map(toMarketauxSymbol));
    const url =
      `https://api.marketaux.com/v1/news/all?api_token=${this.apiKey}` +
      `&entity_types=currency&symbols=${[...trackedSymbols].join(",")}` +
      `&limit=${httpConfig.marketauxFilters.limit}`;

    const res = await fetchWithRetry(url, {}, httpConfig.marketaux);
    const json = (await res.json()) as MarketauxResponse;

    if (json.error) {
      throw new Error(`Marketaux: ${json.error.code} — ${json.error.message}`);
    }

    const articles: RawNewsArticle[] = [];

    for (const article of json.data ?? []) {
      if (!article.url) continue; // без url нечего хэшировать для дедупа

      const currencyEntities = article.entities.filter(
        (e) => e.type === "currency",
      );
      const relevantEntity = currencyEntities.find(
        (e) =>
          trackedSymbols.has(e.symbol) &&
          e.match_score >= httpConfig.marketauxFilters.minMatchScore,
      );
      if (!relevantEntity) continue; // ни одна сущность не прошла порог — не наша новость

      const entities: NewsEntity[] = currencyEntities.map((e) => ({
        type: e.type,
        value: e.symbol,
      }));

      articles.push({
        externalId: createHash("sha256").update(article.url).digest("hex"),
        source: this.id,
        url: article.url,
        title: article.title,
        summary: article.description || undefined,
        publishedAt: new Date(article.published_at),
        lang: article.language,
        entities,
        rawSentiment: relevantEntity.highlights[0]?.sentiment ?? undefined,
      });
    }

    return articles;
  }
}
