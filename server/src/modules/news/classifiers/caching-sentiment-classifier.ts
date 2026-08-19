import { createHash } from "node:crypto";
import type Redis from "ioredis";
import type {
  SentimentClassifier,
  SentimentClassifierInput,
} from "../types.js";

// Кэш по статье (заголовок+текст), не по батчу целиком — тот же батч больше
// никогда не повторится один в один, а отдельная статья вполне может
// попасть в разные батчи между циклами воркера. Тот же принцип, что у
// CachingExplainer (forecast/explainers/caching-explainer.ts), но гранулярность
// другая: там кэш на весь вход целиком, здесь — на каждый элемент батча.
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 дней
const CACHE_KEY_PREFIX = "llm:sentiment:v1:";

function hashArticle(a: SentimentClassifierInput): string {
  const stable = JSON.stringify({ title: a.title, summary: a.summary ?? "" });
  return createHash("sha256").update(stable).digest("hex");
}

export class CachingSentimentClassifier implements SentimentClassifier {
  constructor(
    private readonly inner: SentimentClassifier,
    private readonly redis: Pick<Redis, "get" | "set">,
  ) {}

  async classify(
    articles: SentimentClassifierInput[],
  ): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    const uncached: SentimentClassifierInput[] = [];
    const cacheKeyById = new Map<string, string>();

    for (const article of articles) {
      const key = CACHE_KEY_PREFIX + hashArticle(article);
      cacheKeyById.set(article.id, key);

      const cached = await this.redis.get(key);
      if (cached !== null) {
        const sentiment = Number(cached);
        if (!Number.isNaN(sentiment)) {
          result[article.id] = sentiment;
          continue;
        }
        // Битый кэш — не роняем классификацию, считаем промахом.
      }
      uncached.push(article);
    }

    if (uncached.length > 0) {
      const fresh = await this.inner.classify(uncached);
      for (const [id, sentiment] of Object.entries(fresh)) {
        result[id] = sentiment;
        const key = cacheKeyById.get(id);
        if (key) {
          await this.redis.set(key, String(sentiment), "EX", CACHE_TTL_SECONDS);
        }
      }
    }

    return result;
  }
}
