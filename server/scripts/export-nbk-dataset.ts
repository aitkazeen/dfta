/**
 * Этап 0 роадмапа (§0, §11): "Собрать датасет: 2+ года дневных свечей
 * по 3 парам (USD/KZT, EUR/KZT, RUB/KZT) — понадобится для калибровки".
 *
 * НБ РК выбран единственным источником исторических данных (решение
 * 2026-08-08, docs/architecture-roadmap.md §3.1): живой прогон
 * scripts/compare-fx-providers.ts показал, что ForexRateAPI на free-тире
 * отдаёт историю только за последние ~30 дней (statusCode 209, "Querying
 * older than 30 days requires a paid plan"), а UniRateAPI вообще не имеет
 * подтверждённого исторического эндпоинта. НБ РК бесплатен, без ключа и
 * не ограничен по глубине истории — платные провайдеры остаются только
 * источником текущего курса (см. IQuoteProvider на этапе 1), не датасета.
 *
 * Тянет по одному запросу в день (все 3 валюты сразу — get_rates.cfm
 * отдаёт полный дневной срез, незачем дёргать его трижды на дату),
 * пишет CSV с колонками date,usd_kzt,eur_kzt,rub_kzt в server/data/.
 *
 * Запуск: npm run fx:export-dataset   (из server/)
 * ~730 последовательных запросов с задержкой 250ms — уходит порядка
 * 3-4 минут. Это разовый сбор датасета для калибровки (§5.4), не то,
 * что должно гоняться в фоне регулярно — для этого будет IQuoteProvider.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const RANGE_DAYS = Number(process.env.FX_RANGE_DAYS ?? 730);
const REQUEST_DELAY_MS = Number(process.env.FX_NBK_DELAY_MS ?? 250); // вежливость к чужому серверу без API
const FETCH_TIMEOUT_MS = 10_000;
const FETCH_RETRIES = 2;
const CURRENCIES = ["USD", "EUR", "RUB"] as const;
const OUT_PATH = path.resolve(import.meta.dirname, "../data/nbk-rates-2y.csv");

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

function toRuDate(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${date.getUTCFullYear()}`; // DD.MM.YYYY — НБ РК
}

// --- HTTP с таймаутом и ретраем (архитектурное правило 8) -----------------

async function fetchWithRetry(
  url: string,
  retries = FETCH_RETRIES,
): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await res.text();
    } catch (err) {
      clearTimeout(timeout);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw new Error("unreachable");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Курс KZT за 1 единицу валюты из уже загруженного дневного XML НБ РК. */
function extractRate(xml: string, currency: string): number | null {
  // <item> перед <title> ещё содержит <fullname>...</fullname> — поэтому
  // между <item> и <title> допускаем что угодно, а не только пробелы.
  const re = new RegExp(
    `<item>[\\s\\S]*?<title>${currency}<\\/title>[\\s\\S]*?<description>([\\d.]+)<\\/description>\\s*<quant>(\\d+)<\\/quant>`,
  );
  const m = xml.match(re);
  if (!m) return null;
  const [, description, quant] = m;
  return parseFloat(description) / Number(quant);
}

async function main() {
  const now = new Date();
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const start = addDays(end, -RANGE_DAYS);

  console.log(
    `Собираю дневной датасет НБ РК за ${toIso(start)} … ${toIso(end)} (${RANGE_DAYS} дней)`,
  );

  const rows: string[] = ["date,usd_kzt,eur_kzt,rub_kzt"];
  let cursor = start;
  let ok = 0;
  let failed = 0;

  while (cursor <= end) {
    const iso = toIso(cursor);
    try {
      const xml = await fetchWithRetry(
        `https://nationalbank.kz/rss/get_rates.cfm?fdate=${toRuDate(cursor)}`,
      );
      const rates = CURRENCIES.map((c) => extractRate(xml, c));
      if (rates.every((r) => r != null)) {
        rows.push(`${iso},${rates[0]},${rates[1]},${rates[2]}`);
        ok++;
      } else {
        const missing = CURRENCIES.filter((_, i) => rates[i] == null);
        console.warn(`  ${iso}: не нашлись в ответе — ${missing.join(", ")}`);
        failed++;
      }
    } catch (err) {
      console.warn(`  ${iso}: ${(err as Error).message}`);
      failed++;
    }
    await sleep(REQUEST_DELAY_MS);
    cursor = addDays(cursor, 1);
  }

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, rows.join("\n") + "\n", "utf-8");

  console.log(
    `\nГотово: ${ok} дней собрано, ${failed} пропущено (выходные/праздники — НБ РК не публикует курс).`,
  );
  console.log(`Записано в ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
