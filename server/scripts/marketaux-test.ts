/**
 * Этап 0 роадмапа (§3.2) — проверка Marketaux как источника новостного
 * сентимента. Не общий тест API (акции msft/fb тут не при чём), а прицельно
 * то, что важно для пайплайна §5.2: размечаются ли валютные сущности,
 * есть ли живые русскоязычные источники, и — главное — есть ли вообще
 * казахстанские источники в индексе.
 *
 * Запуск: npm run marketaux:test   (из server/, ключ — в server/.env)
 *
 * Результат уже проверен вживую 2026-08-07 (см. docs/architecture-roadmap.md
 * §3.2): entity_types=currency и language=ru работают, countries=kz даёт
 * 0 статей — казахстанских источников у Marketaux нет вообще. Этот скрипт
 * оставлен, чтобы можно было перепроверить, если Marketaux расширит покрытие,
 * или свериться при смене тарифа/ключа.
 */

const MARKETAUXAPI_KEY = process.env.MARKETAUXAPI_KEY
const FETCH_TIMEOUT_MS = 10_000
const FETCH_RETRIES = 2

type MarketauxEntity = {
  symbol: string
  type: string
  country: string
  sentiment_score: number
}

type MarketauxArticle = {
  title: string
  source: string
  language: string
  published_at: string
  entities: MarketauxEntity[]
}

type MarketauxResponse = {
  meta?: { found: number; returned: number; limit: number; page: number }
  warnings?: string[]
  data?: MarketauxArticle[]
  error?: { code: string; message: string }
}

// --- HTTP с таймаутом и ретраем (архитектурное правило 8) -----------------

async function fetchWithRetry(url: string, retries = FETCH_RETRIES): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timeout)
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
      return await res.text()
    } catch (err) {
      clearTimeout(timeout)
      if (attempt === retries) throw err
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
    }
  }
  throw new Error('unreachable')
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function marketauxQuery(params: Record<string, string>): Promise<MarketauxResponse> {
  const query = new URLSearchParams({ api_token: MARKETAUXAPI_KEY ?? '', ...params }).toString()
  const body = await fetchWithRetry(`https://api.marketaux.com/v1/news/all?${query}`)
  return JSON.parse(body)
}

function printSummary(label: string, res: MarketauxResponse) {
  console.log(`\n=== ${label} ===`)
  if (res.error) {
    console.error(`  Ошибка: ${res.error.code} — ${res.error.message}`)
    return
  }
  console.log(
    `  meta: найдено ${res.meta?.found}, отдано ${res.meta?.returned} (лимит по тарифу: ${res.meta?.limit})`,
  )
  if (res.warnings?.length) console.log(`  Предупреждения: ${res.warnings.join('; ')}`)
  if (!res.data?.length) {
    console.log('  Статей нет.')
    return
  }
  for (const a of res.data) {
    const types = [...new Set(a.entities.map((e) => e.type))].join(',') || '—'
    const countries = [...new Set(a.entities.map((e) => e.country))].join(',') || '—'
    const symbols = a.entities.map((e) => e.symbol).slice(0, 5).join(',') || '—'
    console.log(`  [${a.language}] ${a.source}: "${a.title.slice(0, 70)}"`)
    console.log(`    types=${types}  countries=${countries}  symbols=${symbols}`)
  }
}

async function main() {
  if (!MARKETAUXAPI_KEY) {
    console.error('MARKETAUXAPI_KEY не задан в server/.env — нечего проверять.')
    process.exit(1)
  }

  const checks: Array<{ label: string; params: Record<string, string> }> = [
    { label: 'entity_types=currency — размечаются ли валютные сущности?', params: { entity_types: 'currency' } },
    { label: 'language=ru — есть живые русскоязычные источники?', params: { language: 'ru' } },
    { label: 'countries=kz — есть казахстанские источники?', params: { countries: 'kz' } },
    { label: 'search=tenge — что находится про KZT глобально?', params: { search: 'tenge' } },
  ]

  for (const check of checks) {
    const res = await marketauxQuery({ ...check.params, limit: '3' })
    printSummary(check.label, res)
    await sleep(300) // не долбим их API впритык — бесплатный тариф и так на 100 запросов/сутки
  }

  console.log(
    '\nГотово. Если countries=kz вернул 0 — это ожидаемо: RSS-коллектор НБ РК/KASE ' +
      'обязателен по архитектуре (docs/architecture-roadmap.md §3.2), Marketaux его не заменяет.',
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
