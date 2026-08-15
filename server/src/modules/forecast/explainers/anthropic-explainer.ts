import type { Explainer, ExplainInput, ExplainResult } from '../types.js'
import { SYSTEM_PROMPT, buildUserPrompt, parseExplainResponse } from './prompt.js'

const API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
// Haiku-класс модели — то же обоснование, что в architecture-roadmap.md §5.3:
// ~20 пар × 1 вызов/сутки не оправдывает более дорогую модель.
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'

// Правило 8 (CLAUDE.md): внешний вызов — с таймаутом и ретраем. Паттерн тот
// же, что в market/fetch-with-retry.ts, но не переиспользован напрямую —
// там сигнатура GET-only, здесь нужен POST с телом и заголовками.
const FETCH_TIMEOUT_MS = 15_000
const FETCH_RETRIES = 1

/**
 * Реализация Explainer на Claude (Anthropic Messages API). Платная — нужен
 * баланс на аккаунте (не триальный лимит). Для бесплатного варианта см.
 * gemini-explainer.ts; выбор между ними — в explainer.factory.ts.
 */
export class AnthropicExplainer implements Explainer {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = DEFAULT_MODEL,
  ) {}

  async explain(input: ExplainInput): Promise<ExplainResult | null> {
    const body = JSON.stringify({
      model: this.model,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(input) }],
    })

    for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'x-api-key': this.apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
            'content-type': 'application/json',
          },
          body,
          signal: controller.signal,
        })
        clearTimeout(timeout)
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)

        const data = (await res.json()) as { content?: { type: string; text?: string }[] }
        const text = data.content?.find((c) => c.type === 'text')?.text
        if (!text) return null
        return parseExplainResponse(text)
      } catch (err) {
        clearTimeout(timeout)
        if (attempt === FETCH_RETRIES) {
          console.error('[explainer] anthropic вызов не удался:', (err as Error).message)
          return null
        }
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
      }
    }
    return null
  }
}
