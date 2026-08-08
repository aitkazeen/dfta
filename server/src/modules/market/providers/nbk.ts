import { fetchWithRetry } from '../fetch-with-retry.js'
import { QuoteProviderError, type IQuoteProvider, type Quote } from '../types.js'

const SUPPORTED_BASES = new Set(['USD', 'EUR', 'RUB'])

function toRuDate(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${date.getUTCFullYear()}` // DD.MM.YYYY — НБ РК
}

/** Курс KZT за 1 единицу валюты из дневного XML НБ РК. */
function extractRate(xml: string, currency: string): number | null {
  // <item> перед <title> ещё содержит <fullname>...</fullname> — поэтому
  // между <item> и <title> допускаем что угодно, а не только пробелы.
  const re = new RegExp(
    `<item>[\\s\\S]*?<title>${currency}<\\/title>[\\s\\S]*?<description>([\\d.]+)<\\/description>\\s*<quant>(\\d+)<\\/quant>`,
  )
  const m = xml.match(re)
  if (!m) return null
  const [, description, quant] = m
  return parseFloat(description) / Number(quant)
}

/**
 * Официальный курс НБ РК — primary (архитектурное правило 1). Бесплатен,
 * без ключа, но отдаёт только сегодняшний фиксинг: на выходных/праздниках,
 * когда НБ РК ничего не публиковал, кидает ошибку — переключение на
 * fallback делает factory, не эта функция (см. quote-provider.factory.ts).
 */
export class NbkQuoteProvider implements IQuoteProvider {
  readonly id = 'nbk'

  async getQuote(base: string, quote: string): Promise<Quote> {
    if (quote !== 'KZT' || !SUPPORTED_BASES.has(base)) {
      throw new QuoteProviderError(`НБ РК: пара ${base}/${quote} не поддерживается (только X/KZT)`)
    }

    const now = new Date()
    const xml = await fetchWithRetry(`https://nationalbank.kz/rss/get_rates.cfm?fdate=${toRuDate(now)}`)
    const rate = extractRate(xml, base)
    if (rate == null) {
      throw new QuoteProviderError(`НБ РК: курс ${base} не найден в ответе за ${toRuDate(now)}`)
    }

    return { base, quote, rate, asOf: now, source: this.id }
  }
}
