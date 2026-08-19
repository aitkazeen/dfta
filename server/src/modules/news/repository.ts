import type { PrismaClient } from "@prisma/client";
import { newsConfig } from "./config.js";
import { computeNewsScore } from "./scoring.js";

// Читает newsScore на лету из news_pair_link/news_article — отдельной
// таблицы под сам newsScore нет (как и indicator_value не хранит
// technicalScore целиком, только сырые значения — снимок считается по запросу).
export async function getNewsScore(
  db: PrismaClient,
  pairId: string,
  windowHours: number = newsConfig.windowHours,
): Promise<number> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const links = await db.newsPairLink.findMany({
    where: { pairId, article: { publishedAt: { gte: since } } },
    include: { article: true },
  });

  const scored = links
    .map((link) => {
      const sentiment = link.article.rawSentiment ?? link.article.ourSentiment;
      if (sentiment === null || sentiment === undefined) return null;
      return {
        impactScore: link.impactScore.toNumber(),
        sentiment: sentiment.toNumber(),
      };
    })
    .filter((x): x is { impactScore: number; sentiment: number } => x !== null);

  return computeNewsScore(scored);
}
