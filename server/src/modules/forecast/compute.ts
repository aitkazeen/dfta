import { forecastConfig } from "./config";
import { IndicatorSnapshot } from "./types";

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
function atrRelative(
  value: number | undefined,
  atr: number | undefined,
): number | null {
  // atr <= 0 бывает на single-fix свечах НБ РК в периоды пега (14 подряд
  // одинаковых дневных фиксингов → ATR14 = 0). Тогда value/atr = ±Infinity
  // или 0/0 = NaN, что раньше протекало через clamp и портило весь
  // technicalScore. Считаем сигнал отсутствующим (null) — он честно
  // исключается из взвешенного среднего, а не превращается в мусор.
  if (value === undefined || atr === undefined || !(atr > 0)) return null;
  return clamp(value / atr, -1, 1);
}

// Взвешенное среднее по не-null сигналам. Отсутствующий сигнал исключается
// целиком (и из числителя, и из знаменателя) — не считается нейтральным нулём.
function weightedAverage(
  entries: { score: number | null; weight: number }[],
): number | null {
  // Number.isFinite отсекает не только null, но и NaN/±Infinity — второй
  // рубеж защиты от вырожденных индикаторов (см. atrRelative), чтобы ни один
  // не-число не попал ни в числитель, ни в знаменатель.
  const present = entries.filter((e): e is { score: number; weight: number } =>
    Number.isFinite(e.score),
  );
  const totalWeight = present.reduce((sum, e) => sum + e.weight, 0);
  if (present.length === 0 || totalWeight === 0) return null;
  return present.reduce((sum, e) => sum + e.score * e.weight, 0) / totalWeight;
}

// Подмножество весов, которое перебирает grid-search (scripts/tune-weights.ts).
// Всё опционально — незаданное берётся из forecastConfig. Прод (rules-engine)
// зовёт computeTechnicalScore без override и работает ровно на конфиге.
export type ScoreWeightsOverride = {
  emaDeviation?: number;
  categoryWeight?: { trend?: number; momentum?: number };
  signalWeight?: { rsi14?: number; stoch_k?: number; macd?: number };
};

export function computeTechnicalScore(
  indicators: IndicatorSnapshot,
  close: number,
  override?: ScoreWeightsOverride,
): number {
  const { ema20, ema50, ema200, rsi14, stoch_k, macd, atr14 } = indicators;
  const { emaStack, signals, categoryWeight } = forecastConfig;

  const emaDeviation = override?.emaDeviation ?? emaStack.emaDeviation;
  const catTrend = override?.categoryWeight?.trend ?? categoryWeight.trend;
  const catMomentum =
    override?.categoryWeight?.momentum ?? categoryWeight.momentum;
  const wRsi = override?.signalWeight?.rsi14 ?? signals.rsi14.weight;
  const wStoch = override?.signalWeight?.stoch_k ?? signals.stoch_k.weight;
  const wMacd = override?.signalWeight?.macd ?? signals.macd.weight;

  // Сравнения внутри EMA-стека не сконфигурированы по отдельности —
  // trend-категория целиком описывается одним сигналом emaStack в конфиге,
  // поэтому три сравнения весим поровну (weight: 1 каждое).
  const trendScore = weightedAverage([
    { score: difference(close, ema20, emaDeviation), weight: 1 },
    { score: difference(ema20, ema50, emaDeviation), weight: 1 },
    { score: difference(ema50, ema200, emaDeviation), weight: 1 },
  ]);

  const momentumScore = weightedAverage([
    { score: centered100(rsi14), weight: wRsi },
    { score: centered100(stoch_k), weight: wStoch },
    { score: atrRelative(macd, atr14), weight: wMacd },
  ]);

  const technicalScore = weightedAverage([
    { score: trendScore, weight: catTrend },
    { score: momentumScore, weight: catMomentum },
  ]);

  return technicalScore ?? 0;
}
