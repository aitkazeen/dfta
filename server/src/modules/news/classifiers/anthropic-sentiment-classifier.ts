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

const API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export class AnthropicSentimentClassifier implements SentimentClassifier {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = DEFAULT_MODEL,
  ) {}

  async classify(
    articles: SentimentClassifierInput[],
  ): Promise<Record<string, number>> {
    if (articles.length === 0) return {};

    const body = JSON.stringify({
      model: this.model,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(articles) }],
    });

    try {
      const res = await fetchWithRetry(
        API_URL,
        {
          method: "POST",
          headers: {
            "x-api-key": this.apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
            "content-type": "application/json",
          },
          body,
        },
        httpConfig.llm,
      );
      const data = (await res.json()) as {
        content?: { type: string; text?: string }[];
      };
      const text = data.content?.find((c) => c.type === "text")?.text;
      if (!text) return {};

      const parsed = parseSentimentResponse(text);
      if (!parsed) return {};
      return Object.fromEntries(parsed.map((p) => [p.id, p.sentiment]));
    } catch (err) {
      console.error(
        "[news] anthropic sentiment classify вызов не удался:",
        (err as Error).message,
      );
      return {};
    }
  }
}
