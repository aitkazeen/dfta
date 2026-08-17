import type { ExplainInput, ExplainResult, DriverCategory } from "../types.js";

const ALLOWED_CATEGORIES = new Set<DriverCategory>([
  "technical",
  "news",
  "regulator",
  "global",
]);
const MAX_DRIVERS = 3;

const INDICATOR_LABELS: Record<string, string> = {
  ema20: "EMA20",
  ema50: "EMA50",
  ema200: "EMA200",
  rsi14: "RSI(14)",
  stoch_k: "Stochastic %K",
  macd: "MACD",
  atr14: "ATR(14)",
};

// Общий для всех реализаций Explainer промпт и парсер ответа — провайдеры
// (Anthropic, Gemini, ...) отличаются только транспортом (URL/заголовки/форма
// запроса-ответа), но не тем, что и как у модели просят.
export const SYSTEM_PROMPT = `Ты — аналитик валютного приложения KursWise. По уже посчитанным техническим
показателям пары ты пишешь короткое объяснение прогноза для пользователя.

Жёсткие правила:
- Ты НЕ придумываешь прогноз — направление, диапазон и уверенность уже посчитаны алгоритмом и даны тебе как вход. Твоя задача — только объяснить их словами.
- Никогда не используй формулировки "покупайте", "продавайте", "стоит войти" и подобные. Используй "вероятное направление", "аналитический сигнал".
- Не давай персональных инвестиционных советов.
- Не придумывай новости, решения регуляторов или события, которых нет во входных данных — тебе даны только технические индикаторы, комментируй только их. Если для категории "news"/"regulator"/"global" нет данных — не используй эти категории.
- Отвечай ТОЛЬКО валидным JSON без markdown-разметки и пояснений вне JSON, строго по схеме:
{"explanation": "2-3 предложения на русском", "drivers": [{"category": "technical", "text": "короткая причина"}]}
- Не больше 3 элементов в drivers.`;

export function buildUserPrompt(input: ExplainInput): string {
  const indicatorLines = Object.entries(input.indicators)
    .filter(([, value]) => value !== undefined)
    .map(
      ([name, value]) =>
        `${INDICATOR_LABELS[name] ?? name}: ${value!.toFixed(4)}`,
    )
    .join("\n");

  return `Пара: ${input.base}/${input.quote}
Текущий курс: ${input.close}
Направление прогноза: ${input.direction}
Целевой диапазон: ${input.targetLow.toFixed(2)} – ${input.targetHigh.toFixed(2)}
Технический скор (от -1 до 1): ${input.technicalScore.toFixed(4)}
Индикаторы:
${indicatorLines}`;
}

export function parseExplainResponse(text: string): ExplainResult | null {
  // Модель иногда всё равно оборачивает JSON в ```-фенсы вопреки инструкции —
  // снимаем их перед парсингом, а не рассчитываем на дисциплину промпта.
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.explanation !== "string" || obj.explanation.trim() === "")
    return null;
  if (!Array.isArray(obj.drivers)) return null;

  const drivers = obj.drivers
    .filter(
      (d): d is { category: unknown; text: unknown } =>
        typeof d === "object" &&
        d !== null &&
        typeof (d as Record<string, unknown>).text === "string",
    )
    .slice(0, MAX_DRIVERS)
    .map((d) => ({
      // Некатегоризируемый или невалидный category не отбрасывает драйвер —
      // просто относим к 'technical', единственной категории, которую
      // Explainer сегодня может обосновать данными.
      category: ALLOWED_CATEGORIES.has(d.category as DriverCategory)
        ? (d.category as DriverCategory)
        : "technical",
      text: d.text as string,
    }));

  return { explanation: obj.explanation, drivers };
}
