type Category = "trend" | "momentum" | "volatility";

type SignalConfig = {
  category: Category;
  weight: number; // вес сигнала внутри своей категории
  normalize: "emaStack" | "centered100" | "atrRelative";
};

export const forecastConfig = {
  emaStack: {
    emaDeviation: 0.02,
  },
  decision: {
    flatThreshold: 0.1, // |blendedScore| ниже этого — 'flat'
    maxMovePct: 0.01, // сдвиг середины диапазона от close при score = ±1
    // Полуширина "мёртвой зоны" для резолва факта, в единицах ATR за горизонт:
    // flatBand = flatBandAtrMult * atr14 * sqrt(horizonDays). Факт считается
    // 'flat', если |actualClose - close| <= flatBand. Раньше здесь был
    // фиксированный порог 0.1% (flatThreshold * maxMovePct), не зависящий от
    // горизонта — из-за него на 7д почти любое реальное движение превышало
    // мёртвую зону, и все прогнозы-'flat' засчитывались промахом (бэктест:
    // бакет [0,0.1) на 7д давал 8.3%). Привязка к ATR и sqrt(горизонта) делает
    // "флэт" волатильностно-относительным: движение меньше типичного за
    // горизонт — это шум, а не направление. 0.5 = "меньше половины типичного
    // движения за горизонт — шум"; на этом значении факт-баланс 7д ≈
    // up 34% / down 37% / flat 29% (tune-weights.ts), 24ч ≈ 25/27/48.
    flatBandAtrMult: 0.5,
  },

  // Слияние технического и новостного сигналов (roadmap §5.3).
  merge: {
    technicalWeight: 0.6,
    newsWeight: 0.4,
  },

  // Веса категорий подобраны walk-forward grid-search'ем (scripts/tune-weights.ts,
  // 2026-08-23, 2151 дней-сэмплов × 3 пары). Ключевой вывод: НИ ОДИН конфиг из
  // перебора (все миксы весов × пороги × прямой/инвертированный сигнал) не даёт
  // положительного edge над наивным baseline "всегда предсказывай более частое
  // направление" — лучший edge −9.9% (7d), инвертированный −16.6%. То есть
  // технический сигнал на дневных фиксингах НБ РК направленного преимущества не
  // несёт (это эмпирически подтверждает риск роадмапа §10). Поэтому веса выбраны
  // НЕ ради выжимания точности (её нет), а по принципу: trend-heavy — тренд несёт
  // ту структуру, что вообще есть, а momentum-индикаторы на single-fix свечах
  // (open=high=low=close) вырождены и шумят. volatility остаётся 0 (ATR/BB
  // используются только для нормализации/диапазона, не как направленный сигнал).
  categoryWeight: {
    trend: 0.7,
    momentum: 0.3,
    volatility: 0,
  } satisfies Record<Category, number>,

  signals: {
    emaStack: { category: "trend", weight: 1, normalize: "emaStack" },
    rsi14: { category: "momentum", weight: 1, normalize: "centered100" },
    stoch_k: { category: "momentum", weight: 1, normalize: "centered100" },
    macd: { category: "momentum", weight: 1, normalize: "atrRelative" },
    atr14: { category: "volatility", weight: 0, normalize: "atrRelative" },
    bb_width: { category: "volatility", weight: 0, normalize: "atrRelative" },
  } satisfies Record<string, SignalConfig>,

  historyWindowDays: 90,
};

// Горизонт прогноза в днях — общий источник правды для резолва факта
// (мёртвая зона масштабируется на sqrt(horizonDays)) и для смещения дня
// резолва в worker.ts. Ключи совпадают с ForecastInput["horizon"].
export const horizonDays: Record<"24h" | "7d", number> = {
  "24h": 1,
  "7d": 7,
};
