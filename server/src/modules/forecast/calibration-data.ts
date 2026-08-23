// СГЕНЕРИРОВАНО: npm run forecast:backtest (server/scripts/backtest-forecast.ts)
// 2026-08-23 — не редактировать руками, перегенерировать бэктестом.
//
// Таблица монотонна по построению (isotonic regression поверх walk-forward
// бэктеста на 2-летнем датасете НБ РК) — выше сырой |blendedScore|
// гарантированно не даёт ниже confidence.
//
// Ограничение: бэктест использует newsScore = 0 для всей истории (архива
// новостей за 2 года нет) — калибровка отражает фактически только
// technicalScore-часть блендинга. Логика чтения таблицы — в calibration.ts
// (не регенерируется, статичная).

export type CalibrationBreakpoint = { minScore: number; confidence: number };

export const calibrationTable: Record<string, CalibrationBreakpoint[]> = {
  "24h": [
    {
      minScore: 0,
      confidence: 0.32,
    },
    {
      minScore: 0.1,
      confidence: 0.32,
    },
    {
      minScore: 0.2,
      confidence: 0.32,
    },
    {
      minScore: 0.30000000000000004,
      confidence: 0.32,
    },
    {
      minScore: 0.4,
      confidence: 0.32,
    },
    {
      minScore: 0.5,
      confidence: 0.32,
    },
  ],
  "7d": [
    {
      minScore: 0,
      confidence: 0.342,
    },
    {
      minScore: 0.1,
      confidence: 0.421,
    },
    {
      minScore: 0.2,
      confidence: 0.421,
    },
    {
      minScore: 0.30000000000000004,
      confidence: 0.421,
    },
    {
      minScore: 0.4,
      confidence: 0.421,
    },
    {
      minScore: 0.5,
      confidence: 0.421,
    },
  ],
};
