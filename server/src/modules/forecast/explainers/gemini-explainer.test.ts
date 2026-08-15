import { afterEach, describe, expect, it, vi } from 'vitest'
import { GeminiExplainer } from './gemini-explainer.js'
import type { ExplainInput } from '../types.js'

const input: ExplainInput = {
  base: 'USD',
  quote: 'KZT',
  direction: 'up',
  technicalScore: 0.42,
  close: 512.3,
  targetLow: 508,
  targetHigh: 516,
  indicators: { ema20: 510, rsi14: 63.2 },
}

function geminiResponse(text: string) {
  return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) }
}

describe('GeminiExplainer', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('парсит валидный JSON-ответ модели', async () => {
    const body = JSON.stringify({
      explanation: 'Пара вероятно продолжит рост.',
      drivers: [{ category: 'technical', text: 'RSI выше 60' }],
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiResponse(body)))

    const explainer = new GeminiExplainer('test-key')
    const result = await explainer.explain(input)

    expect(result).toEqual({
      explanation: 'Пара вероятно продолжит рост.',
      drivers: [{ category: 'technical', text: 'RSI выше 60' }],
    })
  })

  it('ключ передаётся в URL, не в теле/заголовках', async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse(JSON.stringify({ explanation: 'Текст.', drivers: [] })))
    vi.stubGlobal('fetch', fetchMock)

    const explainer = new GeminiExplainer('my-secret-key')
    await explainer.explain(input)

    const [url] = fetchMock.mock.calls[0]
    expect(url).toContain('key=my-secret-key')
  })

  it('пустой candidates — возвращает null, не бросает', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [] }) }))

    const explainer = new GeminiExplainer('test-key')
    await expect(explainer.explain(input)).resolves.toBeNull()
  })

  it('битый JSON в ответе — возвращает null, не бросает', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiResponse('не json вообще')))

    const explainer = new GeminiExplainer('test-key')
    const result = await explainer.explain(input)

    expect(result).toBeNull()
  })

  it('сетевая ошибка после ретрая — возвращает null, не бросает', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const explainer = new GeminiExplainer('test-key')
    await expect(explainer.explain(input)).resolves.toBeNull()
  })

  it('HTTP-ошибка от API — возвращает null, не бросает', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 429, statusText: 'Too Many Requests' }),
    )

    const explainer = new GeminiExplainer('test-key')
    await expect(explainer.explain(input)).resolves.toBeNull()
  })
})
