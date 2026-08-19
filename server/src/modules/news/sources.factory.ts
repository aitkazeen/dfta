import { NbkRssSource } from "./sources/nbk-rss-source.js";
import { MarketauxSource } from "./sources/marketaux-source.js";
import type { INewsSource } from "./types.js";

type NewsSourcesEnv = { MARKETAUXAPI_KEY?: string };

// В отличие от createQuoteProvider (primary+fallback — взаимозаменяемые
// реализации одной и той же возможности), источники новостей дополняют
// друг друга — опрашиваются все каждый цикл, поэтому возвращается массив,
// а не одна реализация с внутренним переключением (см. news/types.ts).
export function createNewsSources(
  env: NewsSourcesEnv = process.env,
  logger: Pick<Console, "warn"> = console,
): INewsSource[] {
  const sources: INewsSource[] = [new NbkRssSource()];

  if (env.MARKETAUXAPI_KEY) {
    sources.push(new MarketauxSource(env.MARKETAUXAPI_KEY));
  } else {
    logger.warn(
      "[news] MARKETAUXAPI_KEY не задан — Marketaux пропущен, только НБ РК RSS",
    );
  }

  return sources;
}
