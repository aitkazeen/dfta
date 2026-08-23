// СГЕНЕРИРОВАНО: npm run forecast:backtest (server/scripts/backtest-forecast.ts)
// 2026-08-23 — не редактировать руками, перегенерировать бэктестом.
//
// Правило 6 (CLAUDE.md): confidence берётся из этой таблицы "скор → факт.
// частота попадания", не из формулы наугад. Таблица монотонна по построению
// (isotonic regression поверх walk-forward бэктеста на 2-летнем датасете
// НБ РК) — выше сырой |blendedScore| гарантированно не даёт ниже confidence.
//
// Ограничение: бэктест использует newsScore = 0 для всей истории (архива
// новостей за 2 года нет) — калибровка отражает фактически только
// technicalScore-часть блендинга.

export type CalibrationBreakpoint = { minScore: number; confidence: number };

export const calibration: Record<string, CalibrationBreakpoint[]> = {
  "24h": [
    {
      "minScore": 0,
      "confidence": 0.328
    },
    {
      "minScore": 0.1,
      "confidence": 0.328
    },
    {
      "minScore": 0.2,
      "confidence": 0.328
    },
    {
      "minScore": 0.30000000000000004,
      "confidence": 0.328
    },
    {
      "minScore": 0.4,
      "confidence": 0.353
    },
    {
      "minScore": 0.5,
      "confidence": 0.353
    }
  ],
  "7d": [
    {
      "minScore": 0,
      "confidence": 0.078
    },
    {
      "minScore": 0.1,
      "confidence": 0.507
    },
    {
      "minScore": 0.2,
      "confidence": 0.511
    },
    {
      "minScore": 0.30000000000000004,
      "confidence": 0.511
    },
    {
      "minScore": 0.4,
      "confidence": 0.511
    },
    {
      "minScore": 0.5,
      "confidence": 0.511
    }
  ]
};

// Наименьший калиброванный score ниже самого нижнего бакета с данными —
// используем confidence самого нижнего доступного бакета (экстраполяция
// вниз не делается, это было бы гаданием за пределами данных).
export function calibrateConfidence(rawScore: number, horizon: string): number {
  const table = calibration[horizon] ?? calibration["24h"];
  if (!table || table.length === 0) return rawScore;
  let result = table[0].confidence;
  for (const bp of table) {
    if (rawScore >= bp.minScore) result = bp.confidence;
  }
  return result;
}
