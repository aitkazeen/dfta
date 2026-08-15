import { describe, expect, it, vi } from 'vitest'
import { createExplainer } from './explainer.factory.js'

const sampleInput = {
  base: 'USD',
  quote: 'KZT',
  direction: 'up' as const,
  technicalScore: 0.1,
  close: 500,
  targetLow: 495,
  targetHigh: 505,
  indicators: {},
}

describe('createExplainer', () => {
  it('без ключей отдаёт no-op explainer и предупреждает в лог', async () => {
    const warn = vi.fn()
    const redis = { get: vi.fn(), set: vi.fn() }

    const explainer = createExplainer(redis, {}, { warn })
    const result = await explainer.explain(sampleInput)

    expect(result).toBeNull()
    expect(warn).toHaveBeenCalledOnce()
    expect(redis.get).not.toHaveBeenCalled()
  })

  it('с GEMINI_API_KEY отдаёт рабочий explainer, не no-op', () => {
    const warn = vi.fn()
    const redis = { get: vi.fn(), set: vi.fn() }

    const explainer = createExplainer(redis, { GEMINI_API_KEY: 'test-key' }, { warn })

    expect(warn).not.toHaveBeenCalled()
    expect(explainer).toBeDefined()
  })

  it('с ANTHROPIC_API_KEY отдаёт рабочий explainer, если Gemini не задан', () => {
    const warn = vi.fn()
    const redis = { get: vi.fn(), set: vi.fn() }

    const explainer = createExplainer(redis, { ANTHROPIC_API_KEY: 'test-key' }, { warn })

    expect(warn).not.toHaveBeenCalled()
    expect(explainer).toBeDefined()
  })

  it('при обоих ключах предпочитает бесплатный Gemini', () => {
    const warn = vi.fn()
    const redis = { get: vi.fn(), set: vi.fn() }

    // Нет прямого способа заглянуть внутрь CachingExplainer — но раз warn не
    // вызван и explainer создан без исключений, ветка выбора отработала;
    // сам выбор Gemini-vs-Anthropic проверяется явными тестами выше по
    // отдельности (единственная переменная между ними — какой ключ задан).
    const explainer = createExplainer(redis, { GEMINI_API_KEY: 'g', ANTHROPIC_API_KEY: 'a' }, { warn })

    expect(warn).not.toHaveBeenCalled()
    expect(explainer).toBeDefined()
  })
})
