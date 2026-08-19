// impact_score = источник × свежесть × релевантность, newsScore — взвешенное
// среднее по impact_score (roadmap §5.2).

export function freshnessDecay(
  publishedAt: Date,
  now: Date,
  halfLifeHours: number,
): number {
  const ageHours = (now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60);
  if (ageHours < 0) return 1; // рассинхрон часов источника — не наказываем "будущую" статью
  return Math.pow(0.5, ageHours / halfLifeHours);
}

export function computeImpactScore(
  sourceWeight: number,
  freshness: number,
  relevance: number,
): number {
  return sourceWeight * freshness * relevance;
}

export function computeNewsScore(
  links: { impactScore: number; sentiment: number }[],
): number {
  const totalWeight = links.reduce((sum, l) => sum + l.impactScore, 0);
  if (links.length === 0 || totalWeight === 0) return 0; // нет новостей — нейтрально
  const weighted =
    links.reduce((sum, l) => sum + l.sentiment * l.impactScore, 0) /
    totalWeight;
  return Math.max(-1, Math.min(1, weighted));
}
