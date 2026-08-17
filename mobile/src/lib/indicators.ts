import type { ApiIndicators } from "../api";
import type { Indicator, IndicatorTone } from "../types";

/**
 * Пороги ниже — чисто презентационная эвристика для UI (не веса
 * ForecastEngine, архитектурное правило 4 их не касается). Если позже
 * заведётся реальный движок прогноза — эти же числа не должны питать его.
 */
export function mapIndicators(
  raw: ApiIndicators,
  rate: number,
  symbol: string,
): Indicator[] {
  const rows: Indicator[] = [];

  const rsi = Number(raw.rsi14?.value);
  if (rsi != null) {
    const tone: IndicatorTone =
      rsi >= 70 ? "warn" : rsi <= 30 ? "warn" : "neutral";
    const interp =
      rsi >= 70 ? "Перекуплен" : rsi <= 30 ? "Перепродан" : "Нейтрально";
    rows.push({ name: "RSI (14)", value: rsi.toFixed(0), interp, tone });
  }

  const macd = Number(raw.macd?.value);
  if (macd != null) {
    const tone: IndicatorTone = macd > 0 ? "up" : macd < 0 ? "down" : "neutral";
    // Осторожно с формулировкой: бэкенд хранит только линию MACD, без
    // сигнальной линии/гистограммы — говорить "бычий крест" некорректно,
    // это не пересечение, а просто знак импульса.
    const interp =
      macd > 0
        ? "Восходящий импульс"
        : macd < 0
          ? "Нисходящий импульс"
          : "Нейтрально";
    rows.push({
      name: "MACD",
      value: `${macd > 0 ? "+" : ""}${macd.toFixed(2)}`,
      interp,
      tone,
    });
  }

  const atr = Number(raw.atr14?.value);
  if (atr != null) {
    const pctOfRate = rate > 0 ? (atr / rate) * 100 : 0;
    const tone: IndicatorTone = pctOfRate > 1 ? "warn" : "neutral";
    const interp =
      pctOfRate > 1 ? "Повышенная волатильность" : "Обычная волатильность";
    rows.push({
      name: "ATR (14)",
      value: `${atr.toFixed(2)} ${symbol}`,
      interp,
      tone,
    });
  }

  const ema50 = Number(raw.ema50?.value);
  if (ema50 != null && rate > 0) {
    const above = rate > ema50;
    rows.push({
      name: "EMA 50/200",
      value: above ? "Выше EMA50" : "Ниже EMA50",
      interp: above ? "Восходящий тренд" : "Нисходящий тренд",
      tone: above ? "up" : "down",
    });
  }

  return rows;
}
