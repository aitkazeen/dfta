/**
 * Этап 0 роадмапа (§0, §11): "прогнать каждый провайдер тестовым запросом
 * на USD/KZT, EUR/KZT и RUB/KZT и сверить исторические значения с НБ РК".
 *
 * KZT — центральная валюта продукта (изменено 2026-08-07, см. CLAUDE.md
 * и architecture-roadmap.md §1): все пары котируются против неё, поэтому
 * ЦБ РФ как источник котировок больше не нужен — НБ РК отдаёт USD, EUR
 * и RUB к KZT напрямую, один источник закрывает все три пары.
 *
 * Тянет дневные котировки USD/KZT, EUR/KZT, RUB/KZT у платных кандидатов
 * (ForexRateAPI, UniRateAPI) и сверяет их с официальным курсом НБ РК —
 * бесплатным и без ключа. Платные провайдеры — по ключу из .env.
 *
 * Запуск: npm run fx:compare   (из server/, ключи — в server/.env)
 * Без ключей провайдер просто пропускается — можно сверить хоть один.
 *
 * ВНИМАНИЕ про источники параметров:
 * - ForexRateAPI (/v1/timeframe) — подтверждено владельцем по списку
 *   эндпоинтов с их сайта + отдельно вытянутым примером полного запроса
 *   (api_key, base, currencies, start_date, end_date). На free-тире
 *   /timeframe отказывает по ширине диапазона (порог плавает: видели и
 *   "30 days", и "5 days" на разных запросах) — при первом отказе скрипт
 *   сам переключается на посуточные вызовы /v1/{date} (fetchForexRateApiSampled).
 * - UniRateAPI — подтверждён только один эндпоинт (/api/rates, реальный
 *   Swagger, см. историю чата): текущий курс, параметры from/to/amount,
 *   БЕЗ даты. Отдельного исторического/timeseries эндпоинта в свагере
 *   владелец пока не присылал — раньше я его угадал (/v1/timeseries) по
 *   маркетинговой статье, и это было неверно (не тот базовый путь и не та
 *   конвенция параметров). Поэтому fetchUniRateApiRange() ниже НЕ вызывает
 *   несуществующий эндпоинт — она явно падает с объяснением, что нужно
 *   свериться со Swagger-разделом истории/timeseries и дописать функцию.
 *   Раздел "rates" используется только для быстрой проверки, что ключ
 *   вообще рабочий (pingUniRateApi).
 * - НБ РК (get_rates.cfm) — публичный API без ключа, структура ответа
 *   подтверждена живым запросом (внутри <item> перед <title> есть ещё
 *   <fullname>, учтено в regex). Единственный источник истины теперь —
 *   ЦБ РФ из скрипта убран целиком (был не нужен даже до пивота на KZT:
 *   живой запрос из этого окружения ни разу не прошёл, ECONNRESET/AbortError).
 */

type DailyRates = Map<string, number> // "YYYY-MM-DD" -> курс

const RANGE_DAYS = Number(process.env.FX_RANGE_DAYS ?? 730) // ~2 года, бриф §0
const PROVIDER_CHUNK_DAYS = Number(process.env.FX_CHUNK_DAYS ?? 90) // на случай лимита диапазона за запрос
const NBK_SAMPLE_STEP_DAYS = Number(process.env.FX_NBK_SAMPLE_STEP_DAYS ?? 7) // НБ РК отдаёт только по одной дате за раз — сэмплируем, а не дёргаем все 730 дней
const FETCH_TIMEOUT_MS = 10_000
const FETCH_RETRIES = 2

const FOREXRATEAPI_KEY = process.env.FOREXRATEAPI_KEY
const UNIRATEAPI_KEY = process.env.UNIRATEAPI_KEY
const UNIRATEAPI_BASE = process.env.UNIRATEAPI_BASE ?? 'https://api.unirateapi.com/api'

// --- Даты -------------------------------------------------------------

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10) // YYYY-MM-DD
}

function toRuDate(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${date.getUTCFullYear()}` // DD.MM.YYYY — НБ РК
}

/** Разбивает диапазон на чанки по chunkDays — на случай лимита провайдера на охват одного запроса. */
function chunkRange(start: Date, end: Date, chunkDays: number): Array<{ from: Date; to: Date }> {
  const chunks: Array<{ from: Date; to: Date }> = []
  let cursor = start
  while (cursor < end) {
    const chunkEnd = addDays(cursor, chunkDays) < end ? addDays(cursor, chunkDays) : end
    chunks.push({ from: cursor, to: chunkEnd })
    cursor = addDays(chunkEnd, 1)
  }
  return chunks
}

// --- HTTP с таймаутом и ретраем (архитектурное правило 8) -------------

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

// --- ForexRateAPI -------------------------------------------------------

function isToday(date: Date): boolean {
  const now = new Date()
  return toIso(date) === toIso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())))
}

/** Один день через /v1/{date} — обходит ограничение free-тира на ширину /timeframe.
 *  За сегодня исторический эндпоинт отказывает ("Did you mean /yesterday?") — берём /latest. */
async function fetchForexRateApiSingleDate(base: string, quote: string, date: Date): Promise<number | null> {
  const path = isToday(date) ? 'latest' : toIso(date)
  const url = `https://api.forexrateapi.com/v1/${path}?api_key=${FOREXRATEAPI_KEY}&base=${base}&currencies=${quote}`
  const body = await fetchWithRetry(url)
  const json = JSON.parse(body)
  if (!json.success) throw new Error(`ForexRateAPI: ${JSON.stringify(json.error ?? json)}`)
  return typeof json.rates?.[quote] === 'number' ? json.rates[quote] : null
}

/** Сэмплирует посуточно — медленнее, но укладывается в лимит запросов free-тира. */
async function fetchForexRateApiSampled(base: string, quote: string, start: Date, end: Date): Promise<DailyRates> {
  const out: DailyRates = new Map()
  let cursor = start
  while (cursor <= end) {
    try {
      const rate = await fetchForexRateApiSingleDate(base, quote, cursor)
      if (rate != null) out.set(toIso(cursor), rate)
    } catch (err) {
      console.warn(`  ForexRateAPI ${base}/${quote} ${toIso(cursor)}: ${(err as Error).message}`)
    }
    await sleep(200)
    cursor = addDays(cursor, NBK_SAMPLE_STEP_DAYS)
  }
  return out
}

/**
 * На платном плане — один запрос /timeframe на чанк. На free-тире
 * /timeframe отвечает "N days require a paid plan" (порог плавает —
 * видели и "30 days", и "5 days" на разных диапазонах) — при первом же
 * таком отказе переключаемся на посуточный сэмплинг вместо того, чтобы
 * просто падать.
 */
async function fetchForexRateApiRange(base: string, quote: string, start: Date, end: Date): Promise<DailyRates> {
  const out: DailyRates = new Map()
  for (const { from, to } of chunkRange(start, end, PROVIDER_CHUNK_DAYS)) {
    const url =
      `https://api.forexrateapi.com/v1/timeframe?api_key=${FOREXRATEAPI_KEY}` +
      `&base=${base}&currencies=${quote}&start_date=${toIso(from)}&end_date=${toIso(to)}`
    const body = await fetchWithRetry(url)
    const json = JSON.parse(body)
    if (!json.success) {
      const message = JSON.stringify(json.error ?? json)
      if (message.includes('paid plan')) {
        console.log(
          '  ForexRateAPI: /timeframe недоступен на free-тире для такого диапазона — ' +
            'переключаюсь на посуточные запросы (медленнее, но укладывается в лимит).',
        )
        return fetchForexRateApiSampled(base, quote, start, end)
      }
      throw new Error(`ForexRateAPI: ${message}`)
    }
    for (const [date, rates] of Object.entries<Record<string, number>>(json.rates)) {
      if (typeof rates[quote] === 'number') out.set(date, rates[quote])
    }
  }
  return out
}

// --- UniRateAPI -----------------------------------------------------------

/**
 * Подтверждённый эндпоинт (реальный Swagger): GET /api/rates?api_key&from&to&amount.
 * Отдаёт только ТЕКУЩИЙ курс — используется как проверка, что ключ живой,
 * прежде чем ругаться на отсутствие исторического эндпоинта.
 */
async function pingUniRateApi(base: string, quote: string): Promise<number> {
  const url = `${UNIRATEAPI_BASE}/rates?api_key=${UNIRATEAPI_KEY}&from=${base}&to=${quote}`
  const body = await fetchWithRetry(url)
  const json = JSON.parse(body)
  const rate = json.rate ?? json.result ?? json[quote]
  if (typeof rate !== 'number') throw new Error(`UniRateAPI: не нашёл курс в ответе — ${body.slice(0, 300)}`)
  return rate
}

/**
 * НЕ РЕАЛИЗОВАНО: в реальном Swagger UniRateAPI подтверждён пока только
 * /api/rates (текущий курс, без даты). Исторический/timeseries эндпоинт
 * ни разу не подтверждён живой документацией — угадывать путь второй раз
 * подряд смысла нет (в прошлый раз угадали неверно). Найди в Swagger
 * раздел вроде "Historical" / "Timeseries" (обычно ниже "Currency" в том
 * же личном кабинете) и пришли сюда пример запроса — допишу по нему.
 */
async function fetchUniRateApiRange(_base: string, _quote: string, _start: Date, _end: Date): Promise<DailyRates> {
  throw new Error(
    'Исторический эндпоинт UniRateAPI не подтверждён (см. комментарий у функции). ' +
      'Открой Swagger в личном кабинете, найди раздел с историческими/timeseries данными и пришли пример запроса.',
  )
}

// --- НБ РК — единственный источник истины (USD/KZT, EUR/KZT, RUB/KZT) -----

/** Курс KZT за 1 единицу валюты по данным НБ РК на конкретную дату (один запрос = один день). */
async function fetchNbkOneDate(currency: string, date: Date): Promise<number | null> {
  const url = `https://nationalbank.kz/rss/get_rates.cfm?fdate=${toRuDate(date)}`
  const xml = await fetchWithRetry(url)
  // <item> перед <title> ещё содержит <fullname>...</fullname> (в отличие от rates_all.xml) —
  // поэтому между <item> и <title> допускаем что угодно, а не только пробелы.
  const re = new RegExp(
    `<item>[\\s\\S]*?<title>${currency}<\\/title>[\\s\\S]*?<description>([\\d.]+)<\\/description>\\s*<quant>(\\d+)<\\/quant>`,
  )
  const m = xml.match(re)
  if (!m) return null
  const [, description, quant] = m
  return parseFloat(description) / Number(quant)
}

/** Сэмплирует НБ РК раз в NBK_SAMPLE_STEP_DAYS дней — а не все 730, из вежливости к чужому серверу без API. */
async function fetchNbkSampledRange(currency: string, start: Date, end: Date): Promise<DailyRates> {
  const out: DailyRates = new Map()
  let cursor = start
  while (cursor <= end) {
    try {
      const rate = await fetchNbkOneDate(currency, cursor)
      if (rate != null) out.set(toIso(cursor), rate)
    } catch (err) {
      console.warn(`  НБ РК ${currency} ${toIso(cursor)}: ${(err as Error).message}`)
    }
    await sleep(200) // не долбим чужой сервер без API впритык
    cursor = addDays(cursor, NBK_SAMPLE_STEP_DAYS)
  }
  return out
}

// --- Сравнение ------------------------------------------------------------

type Comparison = {
  matchedDays: number
  meanAbsPct: number
  maxAbsPct: number
  worst: Array<{ date: string; provider: number; official: number; diffPct: number }>
}

function compare(provider: DailyRates, official: DailyRates): Comparison {
  const diffs: Array<{ date: string; provider: number; official: number; diffPct: number }> = []
  for (const [date, officialRate] of official) {
    const providerRate = provider.get(date)
    if (providerRate == null) continue
    const diffPct = (Math.abs(providerRate - officialRate) / officialRate) * 100
    diffs.push({ date, provider: providerRate, official: officialRate, diffPct })
  }
  const matchedDays = diffs.length
  const meanAbsPct = matchedDays ? diffs.reduce((s, d) => s + d.diffPct, 0) / matchedDays : NaN
  const maxAbsPct = matchedDays ? Math.max(...diffs.map((d) => d.diffPct)) : NaN
  const worst = [...diffs].sort((a, b) => b.diffPct - a.diffPct).slice(0, 5)
  return { matchedDays, meanAbsPct, maxAbsPct, worst }
}

function printComparison(label: string, c: Comparison) {
  console.log(`\n  ${label}`)
  if (c.matchedDays === 0) {
    console.log('    Нет пересекающихся дат — нечего сравнивать.')
    return
  }
  console.log(`    Совпавших дат: ${c.matchedDays}`)
  console.log(`    Среднее расхождение: ${c.meanAbsPct.toFixed(3)}%`)
  console.log(`    Максимальное расхождение: ${c.maxAbsPct.toFixed(3)}%`)
  if (c.maxAbsPct > 1) {
    console.log('    Худшие дни:')
    for (const w of c.worst) {
      console.log(
        `      ${w.date}  провайдер=${w.provider.toFixed(4)}  официально=${w.official.toFixed(4)}  Δ=${w.diffPct.toFixed(2)}%`,
      )
    }
  }
}

// --- Основной сценарий ------------------------------------------------

type Pair = { base: string; quote: string; label: string; official: (start: Date, end: Date) => Promise<DailyRates> }

async function main() {
  const now = new Date()
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const start = addDays(end, -RANGE_DAYS)

  console.log(`Сверка провайдеров за ${toIso(start)} … ${toIso(end)} (${RANGE_DAYS} дней)`)

  if (!FOREXRATEAPI_KEY && !UNIRATEAPI_KEY) {
    console.error(
      '\nНи FOREXRATEAPI_KEY, ни UNIRATEAPI_KEY не заданы в server/.env — нечего сверять.\n' +
        'Зарегистрируй бесплатный ключ хотя бы у одного провайдера (см. docs/architecture-roadmap.md §3.1) и добавь его в server/.env.',
    )
    process.exit(1)
  }

  if (UNIRATEAPI_KEY) {
    console.log('\nПроверяю ключ UniRateAPI (единственный подтверждённый эндпоинт — текущий курс)...')
    try {
      const rate = await pingUniRateApi('USD', 'KZT')
      console.log(`  Ключ рабочий. Текущий USD/KZT по UniRateAPI: ${rate}`)
    } catch (err) {
      console.error(`  UniRateAPI: ключ не проверен — ${(err as Error).message}`)
    }
    console.log(
      '  Исторический эндпоинт не подтверждён — сравнение по датам для UniRateAPI ниже пропускается ' +
        '(см. комментарий у fetchUniRateApiRange в скрипте).',
    )
  }

  const pairs: Pair[] = [
    { base: 'USD', quote: 'KZT', label: 'USD/KZT vs НБ РК', official: (s, e) => fetchNbkSampledRange('USD', s, e) },
    { base: 'EUR', quote: 'KZT', label: 'EUR/KZT vs НБ РК', official: (s, e) => fetchNbkSampledRange('EUR', s, e) },
    { base: 'RUB', quote: 'KZT', label: 'RUB/KZT vs НБ РК', official: (s, e) => fetchNbkSampledRange('RUB', s, e) },
  ]

  for (const pair of pairs) {
    console.log(`\n=== ${pair.base}/${pair.quote} ===`)
    console.log('Тяну официальный курс...')
    let official: DailyRates = new Map()
    try {
      official = await pair.official(start, end)
      console.log(`  Получено ${official.size} официальных точек.`)
    } catch (err) {
      console.error(`  Официальный источник недоступен: ${(err as Error).message}`)
      console.error('  Пропускаю сверку по этой паре, иду дальше.')
      continue
    }

    if (FOREXRATEAPI_KEY) {
      console.log('Тяну ForexRateAPI...')
      try {
        const provider = await fetchForexRateApiRange(pair.base, pair.quote, start, end)
        printComparison(`ForexRateAPI — ${pair.label}`, compare(provider, official))
      } catch (err) {
        console.error(`  ForexRateAPI упал: ${(err as Error).message}`)
      }
    }

    // UniRateAPI: исторический эндпоинт не подтверждён (см. предупреждение
    // в начале запуска и комментарий у fetchUniRateApiRange) — пропускаем,
    // пока не появится реальный пример запроса из их Swagger.
  }

  console.log('\nГотово. Небольшое расхождение (доли процента) — норма: провайдер и НБ РК фиксируют курс в разные моменты дня.')
  console.log('Расхождение в разы или систематический сдвиг — повод присмотреться к провайдеру внимательнее.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
