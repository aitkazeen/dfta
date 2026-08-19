import { createHash } from "node:crypto";
import { httpConfig } from "../../../config.js";
import { parseRss } from "./nbk-rss-parser.js";
import type { INewsSource, RawNewsArticle } from "../types.js";
import { fetchWithRetry } from "../../../utils/fetch-with-retry.js";

export class NbkRssSource implements INewsSource {
  public id: string = "nbk-rss";

  constructor() {}

  async fetchLatest(): Promise<RawNewsArticle[]> {
    // Здесь будет логика получения RSS
    const res = await fetchWithRetry(
      "https://nationalbank.kz/rss_news_russian.xml",
      {},
      httpConfig.news,
    );

    const parsed = parseRss(await res.text());

    const mapped = parsed
      .filter(
        (a): a is { link: string; title: string; description: string } =>
          a.link !== null && a.title !== null && a.description !== null,
      )
      .map((article) => {
        return {
          externalId: createHash("sha256").update(article.link).digest("hex"),
          source: this.id,
          url: article.link,
          title: article.description,
          publishedAt: new Date(article.title),
          lang: "ru",
          entities: [],
        };
      });
    return mapped;
  }
}
