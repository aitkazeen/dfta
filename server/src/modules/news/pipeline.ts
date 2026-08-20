import type { PrismaClient } from "@prisma/client";
import type {
  INewsSource,
  RawNewsArticle,
  SentimentClassifier,
} from "./types.js";
import { findRelevantPairs } from "./relevance.js";
import { freshnessDecay, computeImpactScore } from "./scoring.js";
import { newsConfig } from "./config.js";
import { toMarketauxSymbol } from "./sources/marketaux-source.js";
import { clusterDuplicates } from "./dedup.js";

type Pair = { id: string; baseCode: string; quoteCode: string };

// Marketaux уже сам сопоставляет статью с валютной сущностью (entities,
// см. marketaux-source.ts) — для таких статей релевантность пар определяем
// по entities, не повторным поиском ключевых слов в тексте. RSS-источники
// entities не заполняют (см. nbk-rss-source.ts), для них остаётся только
// текстовый поиск. Единственный источник с entities сегодня — Marketaux,
// отсюда прямая зависимость от его формата символа; появится второй такой
// источник — стоит обобщить.
function relevantPairsForArticle(
  article: RawNewsArticle,
  pairs: Pair[],
): string[] {
  const currencySymbols = new Set(
    article.entities.filter((e) => e.type === "currency").map((e) => e.value),
  );
  if (currencySymbols.size > 0) {
    return pairs
      .filter((p) => currencySymbols.has(toMarketauxSymbol(p.id)))
      .map((p) => p.id);
  }
  return findRelevantPairs(`${article.title} ${article.summary ?? ""}`, pairs);
}

export async function runNewsPipeline(deps: {
  db: PrismaClient;
  sources: INewsSource[];
  sentimentClassifier: SentimentClassifier;
  pairs: Pair[];
}): Promise<void> {
  const { db, sources, sentimentClassifier, pairs } = deps;

  const allArticles: RawNewsArticle[] = [];
  for (const source of sources) {
    try {
      const articles = await source.fetchLatest();
      allArticles.push(...articles);
      console.log(`[news] ${source.id}: ${articles.length} статей`);
    } catch (err) {
      // Один упавший источник не должен останавливать остальные —
      // тот же принцип, что per-pair try/catch в worker.ts:pollAllPairs.
      console.error(`[news] ${source.id} failed:`, (err as Error).message);
    }
  }

  const relevantByArticle = new Map<string, string[]>();
  for (const article of allArticles) {
    relevantByArticle.set(
      article.externalId,
      relevantPairsForArticle(article, pairs),
    );
  }

  // Одна и та же новость часто приходит от НБ РК и от Marketaux с разными
  // заголовками/URL — без этого newsScore считал бы такую историю дважды.
  // Каждой статье сопоставляется id "канонической" — той, что реально
  // участвует в скоринге (dedup.ts: выше sourceWeight, при равенстве —
  // раньше опубликована).
  const canonicalByExternalId = clusterDuplicates(
    allArticles.map((a) => ({
      externalId: a.externalId,
      title: a.title,
      publishedAt: a.publishedAt,
      source: a.source,
    })),
  );
  const isCanonical = (externalId: string) =>
    canonicalByExternalId.get(externalId) === externalId;

  // RSS-статьи без готового сентимента батчим на LLM разом — дешевле, чем
  // по одной, и не тратим вызовы на статьи, которые всё равно ни к одной
  // паре не относятся. Дубли (не канонические) сюда не попадают — их вклад
  // в newsScore не учитывается вовсе, платить LLM за их классификацию смысла нет.
  const needsClassification = allArticles.filter(
    (a) =>
      isCanonical(a.externalId) &&
      a.rawSentiment === undefined &&
      (relevantByArticle.get(a.externalId)?.length ?? 0) > 0,
  );
  const classified = await sentimentClassifier.classify(
    needsClassification.map((a) => ({
      id: a.externalId,
      title: a.title,
      summary: a.summary,
    })),
  );

  const now = new Date();

  for (const article of allArticles) {
    const relevantPairIds = relevantByArticle.get(article.externalId) ?? [];
    if (relevantPairIds.length === 0) continue;

    const sentiment = article.rawSentiment ?? classified[article.externalId];
    if (sentiment === undefined) continue; // не удалось получить сентимент — не учитываем статью

    const stored = await db.newsArticle.upsert({
      where: { externalId: article.externalId },
      create: {
        externalId: article.externalId,
        source: article.source,
        url: article.url,
        title: article.title,
        summary: article.summary,
        publishedAt: article.publishedAt,
        lang: article.lang,
        rawSentiment: article.rawSentiment,
        ourSentiment:
          article.rawSentiment === undefined ? sentiment : undefined,
      },
      // Статью уже видели в прошлом цикле — данные не переписываем, только
      // связи с парами ниже (impactScore зависит от свежести и должен обновляться).
      update: {},
    });

    for (const entity of article.entities) {
      await db.newsEntity.upsert({
        where: {
          articleId_entityType_entityValue: {
            articleId: stored.id,
            entityType: entity.type,
            entityValue: entity.value,
          },
        },
        create: {
          articleId: stored.id,
          entityType: entity.type,
          entityValue: entity.value,
        },
        update: {},
      });
    }

    // Дубль той же истории (canonicalByExternalId) не получает newsPairLink:
    // вклад истории в newsScore уже учтён через канонический экземпляр,
    // второй раз считать её не нужно. Сама статья выше всё равно попадает в
    // newsArticle/newsEntity, если для неё нашёлся sentiment — дубли не
    // классифицируются (needsClassification), но обычно это Marketaux-статьи
    // с готовым rawSentiment, так что до этой строки они всё же доходят.
    if (!isCanonical(article.externalId)) continue;

    const sourceWeight = newsConfig.sourceWeight[article.source] ?? 0.5;
    const freshness = freshnessDecay(
      article.publishedAt,
      now,
      newsConfig.halfLifeHours,
    );
    const impactScore = computeImpactScore(sourceWeight, freshness, 1);

    for (const pairId of relevantPairIds) {
      await db.newsPairLink.upsert({
        where: { articleId_pairId: { articleId: stored.id, pairId } },
        create: { articleId: stored.id, pairId, relevance: 1, impactScore },
        update: { impactScore }, // свежесть падает со временем — обновляем при каждом повторном виде статьи
      });
    }
  }
}
