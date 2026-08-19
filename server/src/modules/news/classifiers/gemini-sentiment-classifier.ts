import type {
  SentimentClassifier,
  SentimentClassifierInput,
} from "../types.js";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  parseSentimentResponse,
} from "./prompt.js";
import { fetchWithRetry } from "../../../utils/fetch-with-retry.js";
import { httpConfig } from "../../../config.js";

const DEFAULT_MODEL = "gemini-flash-latest";

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
};

export class GeminiSentimentClassifier implements SentimentClassifier {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = DEFAULT_MODEL,
  ) {}

  async classify(
    articles: SentimentClassifierInput[],
  ): Promise<Record<string, number>> {
    if (articles.length === 0) return {};

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        { role: "user", parts: [{ text: buildUserPrompt(articles) }] },
      ],
      generationConfig: {
        maxOutputTokens: 800,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    try {
      const res = await fetchWithRetry(
        url,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        },
        httpConfig.llm,
      );
      const data = (await res.json()) as GeminiResponse;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return {};

      const parsed = parseSentimentResponse(text);
      if (!parsed) return {};
      return Object.fromEntries(parsed.map((p) => [p.id, p.sentiment]));
    } catch (err) {
      console.error(
        "[news] gemini sentiment classify вызов не удался:",
        (err as Error).message,
      );
      return {};
    }
  }
}
