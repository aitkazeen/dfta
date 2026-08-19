export type NewsEntity = {
  type: string; // "currency" | "country" | "institution"
  value: string;
};

export type RawNewsArticle = {
  externalId: string; // sha256(url) — дедуп-ключ на уровне news_article.external_id
  source: string; // "nbk-rss" | "marketaux"
  url: string;
  title: string;
  summary?: string;
  publishedAt: Date;
  lang: string;
  entities: NewsEntity[];
  // Заполняет только источник, у которого сентимент уже есть на входе
  // (Marketaux — по сущности). RSS-источники оставляют undefined, сентимент
  // считает LLM-классификатор ниже по пайплайну.
  rawSentiment?: number;
};

// Архитектурное правило 1 (CLAUDE.md): бизнес-логика знает только интерфейс.
// В отличие от IQuoteProvider (primary+fallback — взаимозаменяемые источники
// одного типа данных), источники новостей дополняют друг друга, а не
// подменяют — фабрика возвращает массив, опрашиваются все каждый цикл.
export interface INewsSource {
  readonly id: string;
  fetchLatest(): Promise<RawNewsArticle[]>;
}

export class NewsSourceError extends Error {}

export type SentimentClassifierInput = {
  id: string;
  title: string;
  summary?: string;
};

// Правило 3 (CLAUDE.md): LLM только классифицирует тональность уже
// собранного текста, не решает, о чём писать. Пустой Record — не ошибка,
// просто ни для одной статьи из батча не удалось получить сентимент
// (нет ключа / упал вызов / битый ответ) — вызывающий код (pipeline.ts)
// просто не учитывает такие статьи в newsScore, как и с null у Explainer.
export interface SentimentClassifier {
  classify(
    articles: SentimentClassifierInput[],
  ): Promise<Record<string, number>>;
}
