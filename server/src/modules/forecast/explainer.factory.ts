import type Redis from 'ioredis'
import { AnthropicExplainer } from './explainers/anthropic-explainer.js'
import { GeminiExplainer } from './explainers/gemini-explainer.js'
import { CachingExplainer } from './explainers/caching-explainer.js'
import type { Explainer } from './types.js'

const nullExplainer: Explainer = {
  explain: async () => null,
}

type ExplainerEnv = { GEMINI_API_KEY?: string; ANTHROPIC_API_KEY?: string }

/**
 * Фабрика, как и createQuoteProvider (архитектурное правило 1) — без ключей
 * возвращает no-op реализацию, а не падает: explanation/drivers у Forecast
 * nullable именно для этого случая (локальная разработка без ключей).
 *
 * Gemini — по умолчанию: у Google AI Studio есть постоянный бесплатный тариф
 * на Flash-моделях, у Anthropic — только разовый триал-кредит, после него
 * нужен баланс. ANTHROPIC_API_KEY остаётся как явная платная альтернатива,
 * если он задан, а GEMINI_API_KEY — нет.
 */
export function createExplainer(
  redis: Pick<Redis, 'get' | 'set'>,
  env: ExplainerEnv = process.env,
  logger: Pick<Console, 'warn'> = console,
): Explainer {
  if (env.GEMINI_API_KEY) {
    return new CachingExplainer(new GeminiExplainer(env.GEMINI_API_KEY), redis)
  }
  if (env.ANTHROPIC_API_KEY) {
    return new CachingExplainer(new AnthropicExplainer(env.ANTHROPIC_API_KEY), redis)
  }
  logger.warn('[explainer] ни GEMINI_API_KEY, ни ANTHROPIC_API_KEY не заданы — прогнозы будут без LLM-объяснения')
  return nullExplainer
}
