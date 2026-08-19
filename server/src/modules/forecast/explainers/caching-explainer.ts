import { createHash } from "node:crypto";
import type Redis from "ioredis";
import type { Explainer, ExplainInput, ExplainResult } from "../types.js";

// Правило 3 (CLAUDE.md): кэш по хэшу входа. TTL не привязан к суточному
// циклу воркера намеренно — тот же набор индикаторов может повториться
// (боковой рынок), тогда нет смысла платить за LLM-вызов повторно.
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 дней
const CACHE_KEY_PREFIX = "llm:explain:v1:";

// Округление гасит шум последнего знака float, не влияющий на смысл ответа —
// иначе одинаковые по сути входы почти никогда не совпадут по хэшу.
function stableInput(input: ExplainInput): string {
  const round = (n: number) => Math.round(n * 1e4) / 1e4;
  const indicators = Object.fromEntries(
    Object.entries(input.indicators)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, round(v!)]),
  );
  return JSON.stringify({
    base: input.base,
    quote: input.quote,
    direction: input.direction,
    technicalScore: round(input.technicalScore),
    close: round(input.close),
    targetLow: round(input.targetLow),
    targetHigh: round(input.targetHigh),
    indicators,
  });
}

function hashInput(input: ExplainInput): string {
  return createHash("sha256").update(stableInput(input)).digest("hex");
}

/** Декоратор над любым Explainer — кэширует успешный результат в Redis по хэшу входа. */
export class CachingExplainer implements Explainer {
  constructor(
    private readonly inner: Explainer,
    private readonly redis: Pick<Redis, "get" | "set">,
  ) {}

  async explain(input: ExplainInput): Promise<ExplainResult | null> {
    const key = CACHE_KEY_PREFIX + hashInput(input);

    const cached = await this.redis.get(key);
    if (cached) {
      try {
        return JSON.parse(cached) as ExplainResult;
      } catch {
        // Битый кэш не должен ронять генерацию — просто считаем его промахом.
      }
    }

    const result = await this.inner.explain(input);
    if (result) {
      await this.redis.set(
        key,
        JSON.stringify(result),
        "EX",
        CACHE_TTL_SECONDS,
      );
    }
    return result;
  }
}
