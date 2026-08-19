import type Redis from "ioredis";
import { GeminiSentimentClassifier } from "./classifiers/gemini-sentiment-classifier.js";
import { AnthropicSentimentClassifier } from "./classifiers/anthropic-sentiment-classifier.js";
import { CachingSentimentClassifier } from "./classifiers/caching-sentiment-classifier.js";
import type { SentimentClassifier } from "./types.js";

const nullClassifier: SentimentClassifier = {
  classify: async () => ({}),
};

type ClassifierEnv = { GEMINI_API_KEY?: string; ANTHROPIC_API_KEY?: string };

// Тот же выбор и та же причина, что в forecast/explainer.factory.ts: Gemini
// по умолчанию (постоянный бесплатный тариф), Anthropic — платная альтернатива,
// no-op без обоих ключей — RSS-статьи просто останутся без ourSentiment,
// pipeline.ts их не учитывает в newsScore, но пайплайн не падает.
export function createSentimentClassifier(
  redis: Pick<Redis, "get" | "set">,
  env: ClassifierEnv = process.env,
  logger: Pick<Console, "warn"> = console,
): SentimentClassifier {
  if (env.GEMINI_API_KEY) {
    return new CachingSentimentClassifier(
      new GeminiSentimentClassifier(env.GEMINI_API_KEY),
      redis,
    );
  }
  if (env.ANTHROPIC_API_KEY) {
    return new CachingSentimentClassifier(
      new AnthropicSentimentClassifier(env.ANTHROPIC_API_KEY),
      redis,
    );
  }
  logger.warn(
    "[news] ни GEMINI_API_KEY, ни ANTHROPIC_API_KEY не заданы — RSS-статьи останутся без сентимента",
  );
  return nullClassifier;
}
