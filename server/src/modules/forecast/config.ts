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
    flatThreshold: 0.1,   // |technicalScore| ниже этого — 'flat'
    maxMovePct: 0.01,     // сдвиг середины диапазона от close при score = ±1
  },

  categoryWeight: {
    trend: 1,
    momentum: 1,
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
};
