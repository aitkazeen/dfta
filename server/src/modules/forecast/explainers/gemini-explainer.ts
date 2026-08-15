import type { Explainer, ExplainInput, ExplainResult } from '../types.js'
import { SYSTEM_PROMPT, buildUserPrompt, parseExplainResponse } from './prompt.js'

// Алиас, а не конкретная версия — Google периодически снимает старые версии
// с поддержки для новых ключей (так и произошло с gemini-2.5-flash, живьём
// проверено 2026-08-16: 404 "no longer available to new users"). latest сам
// переезжает на актуальную модель без правки кода.
const DEFAULT_MODEL = 'gemini-flash-latest'
// Правило 8 (CLAUDE.md): внешний вызов — с таймаутом и ретраем.
const FETCH_TIMEOUT_MS = 15_000
const FETCH_RETRIES = 1

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[]
}

/**
 * Реализация Explainer на Gemini (Google AI Studio). У Gemini API есть
 * постоянный бесплатный тариф на Flash-моделях (в отличие от Anthropic —
 * там только $5 разового триал-кредита), поэтому это дефолт в
 * explainer.factory.ts, а Anthropic — платная альтернатива.
 */
export class GeminiExplainer implements Explainer {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = DEFAULT_MODEL,
  ) {}

  async explain(input: ExplainInput): Promise<ExplainResult | null> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: buildUserPrompt(input) }] }],
      // thinkingBudget: 0 — без него модель тратит generationConfig.maxOutputTokens
      // на невидимые "мысли" ещё до первого символа ответа (живьём проверено:
      // 64 thinking-токена на "hi") и может обрезать JSON, не дописав его.
      // Для короткого структурированного вывода reasoning не нужен.
      generationConfig: {
        maxOutputTokens: 800,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    })

    for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          signal: controller.signal,
        })
        clearTimeout(timeout)
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)

        const data = (await res.json()) as GeminiResponse
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (!text) return null
        return parseExplainResponse(text)
      } catch (err) {
        clearTimeout(timeout)
        if (attempt === FETCH_RETRIES) {
          console.error('[explainer] gemini вызов не удался:', (err as Error).message)
          return null
        }
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
      }
    }
    return null
  }
}
