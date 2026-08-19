import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";

type NewsRoutesDeps = {
  db: PrismaClient;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export function newsRoutes(deps: NewsRoutesDeps) {
  return async function (app: FastifyInstance) {
    app.get("/v1/pairs/:id/news", async (req, reply) => {
      const { id } = req.params as { id: string };
      const { limit } = req.query as { limit?: string };

      const pair = await deps.db.currencyPair.findUnique({ where: { id } });
      if (!pair) {
        return reply.code(404).send({ error: "pair not found" });
      }

      const take = Math.min(Number(limit) || DEFAULT_LIMIT, MAX_LIMIT);

      const links = await deps.db.newsPairLink.findMany({
        where: { pairId: id },
        include: { article: true },
        orderBy: { article: { publishedAt: "desc" } },
        take,
      });

      return links.map((link) => ({
        title: link.article.title,
        url: link.article.url,
        source: link.article.source,
        publishedAt: link.article.publishedAt.toISOString(),
        sentiment:
          (
            link.article.rawSentiment ?? link.article.ourSentiment
          )?.toNumber() ?? null,
        impactScore: link.impactScore.toNumber(),
      }));
    });
  };
}
