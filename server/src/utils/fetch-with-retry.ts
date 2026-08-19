// Архитектурное правило 8 (CLAUDE.md): каждый внешний вызов — с таймаутом
// и ретраем. Общий для всех модулей (market/, news/, forecast/explainers) —
// возвращает Response, а не text()/json() заранее, чтобы обслуживать и
// GET-запросы, возвращающие текст (RSS, XML-курсы), и POST с JSON-телом
// (LLM API), одной сигнатурой.
export type FetchRetryOptions = { timeoutMs: number; retries: number };

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: FetchRetryOptions,
): Promise<Response> {
  for (let attempt = 0; attempt <= options.retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return res;
    } catch (err) {
      clearTimeout(timeout);
      if (attempt === options.retries) throw err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw new Error("unreachable");
}
