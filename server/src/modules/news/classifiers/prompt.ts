import type { SentimentClassifierInput } from "../types.js";

const MAX_ARTICLES = 20;

export const SYSTEM_PROMPT = `Ты — классификатор тональности финансовых новостей для валютного приложения KursWise.
Тебе дают список статей (заголовок и, если есть, краткое содержание). Для каждой оцени
тональность по отношению к перспективам упомянутой валюты: число от -1 (сильно негативно)
до +1 (сильно позитивно), 0 — нейтрально.

Жёсткие правила:
- Ты НЕ придумываешь факты, которых нет в тексте — только оцениваешь тональность данного текста.
- Отвечай ТОЛЬКО валидным JSON-массивом без markdown-разметки и пояснений вне JSON, строго по схеме:
[{"id": "<id статьи>", "sentiment": <число от -1 до 1>}]
- Верни ровно один объект на каждую статью из входа, с тем же id.`;

export function buildUserPrompt(articles: SentimentClassifierInput[]): string {
  return articles
    .slice(0, MAX_ARTICLES)
    .map(
      (a) =>
        `id: ${a.id}\nЗаголовок: ${a.title}${a.summary ? `\nТекст: ${a.summary}` : ""}`,
    )
    .join("\n---\n");
}

export type SentimentClassifyResult = { id: string; sentiment: number }[];

export function parseSentimentResponse(
  text: string,
): SentimentClassifyResult | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  return parsed
    .filter(
      (d): d is { id: unknown; sentiment: unknown } =>
        typeof d === "object" &&
        d !== null &&
        typeof (d as Record<string, unknown>).id === "string" &&
        typeof (d as Record<string, unknown>).sentiment === "number",
    )
    .map((d) => ({
      id: d.id as string,
      sentiment: Math.max(-1, Math.min(1, d.sentiment as number)),
    }));
}
