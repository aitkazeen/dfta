import { describe, expect, it, vi } from 'vitest'

const nbkGetQuote = vi.fn()
const forexrateapiGetQuote = vi.fn()

vi.mock('./providers/nbk.js', () => ({
  NbkQuoteProvider: vi.fn().mockImplementation(function () {
    return { id: 'nbk', getQuote: nbkGetQuote }
  }),
}))
vi.mock('./providers/forexrateapi.js', () => ({
  ForexRateApiQuoteProvider: vi.fn().mockImplementation(function () {
    return { id: 'forexrateapi', getQuote: forexrateapiGetQuote }
  }),
}))

const { createQuoteProvider } = await import('./quote-provider.factory.js')

const quote = { base: 'USD', quote: 'KZT', rate: 500, asOf: new Date(), source: 'nbk' }

describe('createQuoteProvider', () => {
  it('возвращает результат primary (НБ РК), когда он отвечает', async () => {
    nbkGetQuote.mockResolvedValueOnce(quote)
    const provider = createQuoteProvider({}, { warn: vi.fn() })

    const result = await provider.getQuote('USD', 'KZT')

    expect(result).toEqual(quote)
    expect(forexrateapiGetQuote).not.toHaveBeenCalled()
  })

  it('без ключа ForexRateAPI пробрасывает ошибку primary как есть', async () => {
    const err = new Error('nbk недоступен')
    nbkGetQuote.mockRejectedValueOnce(err)
    const provider = createQuoteProvider({}, { warn: vi.fn() })

    await expect(provider.getQuote('USD', 'KZT')).rejects.toThrow('nbk недоступен')
  })

  it('переключается на fallback, если primary падает и ключ есть', async () => {
    nbkGetQuote.mockRejectedValueOnce(new Error('nbk недоступен'))
    forexrateapiGetQuote.mockResolvedValueOnce({ ...quote, source: 'forexrateapi' })
    const warn = vi.fn()
    const provider = createQuoteProvider({ FOREXRATEAPI_KEY: 'test-key' }, { warn })

    const result = await provider.getQuote('USD', 'KZT')

    expect(result.source).toBe('forexrateapi')
    expect(warn).toHaveBeenCalledOnce()
  })
})
