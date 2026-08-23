import {
  calibrationTable,
  type CalibrationBreakpoint,
} from "./calibration-data.js";

export type { CalibrationBreakpoint };

// Правило 6 (CLAUDE.md): confidence — из калиброванной таблицы "скор →
// факт. частота попадания" (walk-forward бэктест, см.
// scripts/backtest-forecast.ts), не из формулы наугад. Таблица — в
// calibration-data.ts, регенерируется бэктестом (npm run forecast:backtest);
// эта функция — статичная, руками не перегенерируется.
//
// Наименьший калиброванный score ниже самого нижнего бакета с данными —
// используем confidence самого нижнего доступного бакета (экстраполяция
// вниз не делается, это было бы гаданием за пределами данных).
export function calibrateConfidence(rawScore: number, horizon: string): number {
  const table = calibrationTable[horizon] ?? calibrationTable["24h"];
  if (!table || table.length === 0) return rawScore;
  let result = table[0].confidence;
  for (const bp of table) {
    if (rawScore >= bp.minScore) result = bp.confidence;
  }
  return result;
}

// Реэкспорт под старым именем — тесты и потребители продолжают импортировать
// "./calibration"; сами данные теперь физически в calibration-data.ts.
export { calibrationTable as calibration };
