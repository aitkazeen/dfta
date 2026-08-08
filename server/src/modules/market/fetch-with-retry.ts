// Архитектурное правило 8 (CLAUDE.md): каждый внешний вызов — с таймаутом
// и ретраем. Тот же паттерн, что уже обкатан в server/scripts/compare-fx-providers.ts.
const FETCH_TIMEOUT_MS = 10_000
const FETCH_RETRIES = 2

export async function fetchWithRetry(url: string, retries = FETCH_RETRIES): Promise<string> {
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
