import { newsConfig } from "./config.js";

type PairLike = { id: string; baseCode: string; quoteCode: string };

export function findMentionedCurrencies(text: string): Set<string> {
  const lower = text.toLowerCase();
  const mentioned = new Set<string>();
  for (const [code, keywords] of Object.entries(newsConfig.relevanceKeywords)) {
    if (keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      mentioned.add(code);
    }
  }
  return mentioned;
}

// Пара X-KZT релевантна, если текст упоминает X ИЛИ KZT — KZT общая для всех
// пар валюта, поэтому даже без упоминания X новость о тенге затрагивает пару.
export function findRelevantPairs(text: string, pairs: PairLike[]): string[] {
  const mentioned = findMentionedCurrencies(text);
  return pairs
    .filter((p) => mentioned.has(p.baseCode) || mentioned.has(p.quoteCode))
    .map((p) => p.id);
}
