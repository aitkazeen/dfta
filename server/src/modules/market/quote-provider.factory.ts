import type { FastifyBaseLogger } from 'fastify'
import { ForexRateApiQuoteProvider } from './providers/forexrateapi.js'
import { NbkQuoteProvider } from './providers/nbk.js'
import type { IQuoteProvider } from './types.js'

/**
 * Фабрика вместо DI-контейнера (принятое решение в CLAUDE.md — Fastify без
 * Nest). Primary + fallback, переключение при отказе (архитектурное правило 1):
 * простой try/catch, без стейт-машины circuit breaker — для этого этапа
 * достаточно.
 */
export function createQuoteProvider(
  env: { FOREXRATEAPI_KEY?: string } = process.env,
  logger: Pick<FastifyBaseLogger, 'warn'> = console,
): IQuoteProvider {
  const primary = new NbkQuoteProvider()
  const fallback = env.FOREXRATEAPI_KEY ? new ForexRateApiQuoteProvider(env.FOREXRATEAPI_KEY) : undefined

  return {
    id: 'nbk+forexrateapi-fallback',
    async getQuote(base, quote) {
      try {
        return await primary.getQuote(base, quote)
      } catch (err) {
        if (!fallback) throw err
        logger.warn(`nbk недоступен (${(err as Error).message}), переключаюсь на forexrateapi`)
        return await fallback.getQuote(base, quote)
      }
    },
  }
}
