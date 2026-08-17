import { fetchWithRetry } from "../fetch-with-retry.js";
import {
  QuoteProviderError,
  type IQuoteProvider,
  type Quote,
} from "../types.js";

type ForexRateApiResponse = {
  success: boolean;
  rates?: Record<string, number>;
  error?: unknown;
};

/**
 * Fallback (архитектурное правило 1) — платный, но у нас есть ключ.
 * Только текущий курс: /latest не упирается в ограничение free-тира на
 * историю старше ~30 дней (см. решение в docs/architecture-roadmap.md §3.1),
 * а этому провайдеру история и не нужна — он всегда спрашивает "сейчас".
 */
export class ForexRateApiQuoteProvider implements IQuoteProvider {
  readonly id = "forexrateapi";

  constructor(private readonly apiKey: string) {}

  async getQuote(base: string, quote: string): Promise<Quote> {
    const url = `https://api.forexrateapi.com/v1/latest?api_key=${this.apiKey}&base=${base}&currencies=${quote}`;
    const body = await fetchWithRetry(url);
    const json = JSON.parse(body) as ForexRateApiResponse;

    if (!json.success) {
      throw new QuoteProviderError(
        `ForexRateAPI: ${JSON.stringify(json.error ?? json)}`,
      );
    }
    const rate = json.rates?.[quote];
    if (typeof rate !== "number") {
      throw new QuoteProviderError(
        `ForexRateAPI: курс ${quote} не найден в ответе`,
      );
    }

    return { base, quote, rate, asOf: new Date(), source: this.id };
  }
}
