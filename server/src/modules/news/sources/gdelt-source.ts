import { createHash } from "node:crypto";
import { httpConfig } from "../../../config.js";
import { newsConfig } from "../config.js";
import type { INewsSource, RawNewsArticle } from "../types.js";
import { fetchWithRetry } from "../../../utils/fetch-with-retry.js";

// GDELT 2.0 DOC API artlist-запись (format=json). Per-article tone поле НЕ
// отдаётся (проверено живьём 2026-10-07) — поэтому rawSentiment здесь всегда
// undefined, и статьи уходят в тот же Gemini-классификатор, что и НБ РК RSS
// (pipeline.ts). GDELT нужен не ради готового сентимента, а ради покрытия
// казахстанских/русских источников, которых нет у Marketaux (CLAUDE.md
// 2026-09-30). Исторический tone для калибровки берётся отдельно —
// timelinetone-эндпоинтом в scripts/export-gdelt-dataset.ts.
type GdeltArticle = {
  url: string;
  title: string;
  seendate: string; // "20260729T100000Z"
  language: string; // "Russian" | "English" | ...
  domain: string;
};

type GdeltArtListResponse = { articles?: GdeltArticle[] };

// GDELT seendate — компактный ISO без разделителей: 20260729T100000Z.
function parseSeenDate(s: string): Date {
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return new Date(s); // на всякий — пусть Date сам попробует
  const [, y, mo, d, h, mi, se] = m;
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${se}Z`);
}

// Запрос строится из тех же relevanceKeywords (config.ts, правило 4): должен
// упоминаться тенге/KZT И хотя бы одна из иностранных валют скоупа. Пару
// конкретную дальше назначит findRelevantPairs в pipeline.ts по тексту —
// GdeltSource не знает про пары, только про валютные ключевые слова.
export function buildGdeltQuery(
  keywords: Record<string, string[]> = newsConfig.relevanceKeywords,
): string {
  const uniq = (xs: string[]) => [...new Set(xs.map((k) => k.toLowerCase()))];
  const kzt = uniq(keywords.KZT ?? []);
  const others = uniq(
    Object.entries(keywords)
      .filter(([code]) => code !== "KZT")
      .flatMap(([, kws]) => kws),
  );
  const orGroup = (terms: string[]) => `(${terms.join(" OR ")})`;
  // space = AND в синтаксисе GDELT.
  return `${orGroup(kzt)} ${orGroup(others)}`;
}

export class GdeltSource implements INewsSource {
  public id = "gdelt";

  constructor(
    private readonly query: string = buildGdeltQuery(),
    private readonly cfg = newsConfig.gdelt,
  ) {}

  async fetchLatest(): Promise<RawNewsArticle[]> {
    const url =
      `${this.cfg.docApiUrl}?query=${encodeURIComponent(this.query)}` +
      `&mode=artlist&format=json&sort=datedesc&maxrecords=${this.cfg.maxRecords}`;

    const res = await fetchWithRetry(url, {}, httpConfig.news);
    const text = await res.text();
    // GDELT при превышении rate-limit отдаёт 200 с текстовым сообщением,
    // а не JSON — не роняем пайплайн, просто нет статей в этом цикле.
    let json: GdeltArtListResponse;
    try {
      json = JSON.parse(text) as GdeltArtListResponse;
    } catch {
      throw new Error(
        `GDELT: не JSON (вероятно rate-limit): ${text.slice(0, 120)}`,
      );
    }

    return (json.articles ?? [])
      .filter((a) => a.url && a.title)
      .map((a) => ({
        externalId: createHash("sha256").update(a.url).digest("hex"),
        source: this.id,
        url: a.url,
        title: a.title.trim(),
        publishedAt: parseSeenDate(a.seendate),
        lang: a.language?.slice(0, 2).toLowerCase() || "en",
        entities: [], // релевантность пар — по тексту (findRelevantPairs)
        // rawSentiment намеренно не задан: artlist tone не отдаёт → LLM
      }));
  }
}
