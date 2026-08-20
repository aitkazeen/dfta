import { newsConfig } from "./config.js"
export type DedupCandidate = {
  externalId: string;
  title: string;
  publishedAt: Date;
  source: string;
};

// Groups articles that are likely the same underlying story reported by
// different outlets. Returns externalId -> canonical externalId for every
// input article (an article with no duplicates maps to itself).

function normalizeTitle(title: string) {
    const result = title.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "");
    return result.split(/\s+/).filter(Boolean);

}
function candidatePairsByTime(items: DedupCandidate[]): Array<[DedupCandidate, DedupCandidate]> {
    const sorted = [...items].sort(
        (a, b) => a.publishedAt.getTime() - b.publishedAt.getTime()
    );

    const pairs: Array<[DedupCandidate, DedupCandidate]> = [];

    for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
            const diff = sorted[j].publishedAt.getTime() - sorted[i].publishedAt.getTime();
            if (diff > newsConfig.deduplicated.period) break; // дальше все ещё дальше по времени — можно остановиться
            pairs.push([sorted[i], sorted[j]]);
        }
    }

    return pairs;
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(normalizeTitle(a));
  const setB = new Set(normalizeTitle(b));

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

function buildInitialParents(articles: DedupCandidate[]): Map<string, string> {
  const parent = new Map<string, string>();
  for (const article of articles) {
    parent.set(article.externalId, article.externalId);
  }
  return parent;
}

function find(parent: Map<string, string>, id: string): string {
  let root = id;
  while (parent.get(root) !== root) {
    root = parent.get(root)!;
  }
  return root;
}

function union(parent: Map<string, string>, a: string, b: string): void {
  const rootA = find(parent, a);
  const rootB = find(parent, b);
  if (rootA !== rootB) {
    parent.set(rootA, rootB);
  }
}

function pickCanonical(group: DedupCandidate[]): DedupCandidate {
  return group.reduce((best, current) => {
    const bestWeight = newsConfig.sourceWeight[best.source] ?? 0.5;
    const currentWeight = newsConfig.sourceWeight[current.source] ?? 0.5;
    if (currentWeight !== bestWeight)
      return currentWeight > bestWeight ? current : best;
    return current.publishedAt < best.publishedAt ? current : best;
  });
}

export function clusterDuplicates(
  articles: DedupCandidate[],
): Map<string, string> {
    const parent = buildInitialParents(articles);
    const candidatePairs = candidatePairsByTime(articles);

    for (const [a, b] of candidatePairs) {
      const similarity = jaccardSimilarity(a.title, b.title);
      if (similarity > newsConfig.deduplicated.similarityCoefficient) {
        union(parent, a.externalId, b.externalId);
      }
    }

    const groups = new Map<string, DedupCandidate[]>();
    for (const article of articles) {
      const root = find(parent, article.externalId);
      const group = groups.get(root) ?? [];
      group.push(article);
      groups.set(root, group);
    }

    const result = new Map<string, string>();
    for (const group of groups.values()) {
      const canonical = pickCanonical(group);
      for (const article of group) {
        result.set(article.externalId, canonical.externalId);
      }
    }
    return result;
};
