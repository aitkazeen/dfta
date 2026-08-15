import { forecastConfig } from "./config";
import { IndicatorSnapshot } from "./types"


function clamp(x: number, min: number, max: number) {
  return Math.max(min, Math.min(max, x));
}

// Относительная разница first/second (например close vs ema20), нормализованная
// порогом deviation. null — если хотя бы одно значение ещё не посчитано.
function difference(
  first: number | undefined,
  second: number | undefined,
  deviation: number,
): number | null {
  if (first === undefined || second === undefined) return null;
  return clamp((first - second) / second / deviation, -1, 1);
}

// RSI/Stochastic %K уже 0..100 — просто центрируем на 50, клэмп на всякий
// случай (Stochastic формально может чуть выйти за 0..100 на кривых данных).
function centered100(value: number | undefined): number | null {
  if (value === undefined) return null;
  return clamp((value - 50) / 50, -1, 1);
}

// MACD не заперт в диапазон — делим на ATR той же свечи, чтобы получить
// сопоставимую величину между парами с разным порядком цены.
function atrRelative(value: number | undefined, atr: number | undefined): number | null {
  if (value === undefined || atr === undefined) return null;
  return clamp(value / atr, -1, 1);
}

// Взвешенное среднее по не-null сигналам. Отсутствующий сигнал исключается
// целиком (и из числителя, и из знаменателя) — не считается нейтральным нулём.
function weightedAverage(entries: { score: number | null; weight: number }[]): number | null {
  const present = entries.filter(
    (e): e is { score: number; weight: number } => e.score !== null,
  );
  const totalWeight = present.reduce((sum, e) => sum + e.weight, 0);
  if (present.length === 0 || totalWeight === 0) return null;
  return present.reduce((sum, e) => sum + e.score * e.weight, 0) / totalWeight;
}

export function computeTechnicalScore(indicators: IndicatorSnapshot, close: number): number {
  const { ema20, ema50, ema200, rsi14, stoch_k, macd, atr14 } = indicators;
  const { emaStack, signals, categoryWeight } = forecastConfig;

  // Сравнения внутри EMA-стека не сконфигурированы по отдельности —
  // trend-категория целиком описывается одним сигналом emaStack в конфиге,
  // поэтому три сравнения весим поровну (weight: 1 каждое).
  const trendScore = weightedAverage([
    { score: difference(close, ema20, emaStack.emaDeviation), weight: 1 },
    { score: difference(ema20, ema50, emaStack.emaDeviation), weight: 1 },
    { score: difference(ema50, ema200, emaStack.emaDeviation), weight: 1 },
  ]);

  const momentumScore = weightedAverage([
    { score: centered100(rsi14), weight: signals.rsi14.weight },
    { score: centered100(stoch_k), weight: signals.stoch_k.weight },
    { score: atrRelative(macd, atr14), weight: signals.macd.weight },
  ]);

  const technicalScore = weightedAverage([
    { score: trendScore, weight: categoryWeight.trend },
    { score: momentumScore, weight: categoryWeight.momentum },
  ]);

  return technicalScore ?? 0;
}
