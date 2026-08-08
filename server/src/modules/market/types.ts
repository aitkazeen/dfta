export type Quote = {
  base: string // "USD"
  quote: string // "KZT"
  rate: number // KZT per 1 unit of base
  asOf: Date // момент, на который действителен курс (не момент запроса)
  source: string // "nbk" | "forexrateapi"
}

// Архитектурное правило 1 (CLAUDE.md): бизнес-логика и роуты знают только
// про этот интерфейс, никогда не зовут конкретного провайдера напрямую.
export interface IQuoteProvider {
  readonly id: string
  getQuote(base: string, quote: string): Promise<Quote>
}

export class QuoteProviderError extends Error {}
