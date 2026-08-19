import type { TodaySummary } from "../types";

/**
 * Мок карточки «Сегодня» (4.2) — единственное на этом экране, что всё ещё
 * заглушка: прогноз бэкенд не считает (этапы 3–4 роадмапа, ForecastEngine
 * не подключён). Список пар и курсы теперь реальные — см. useEffect в
 * app/(tabs)/index.tsx, там же getPairs/getQuote/getCandles.
 */
const today: TodaySummary = {
  pairId: "USD-KZT",
  ticker: "USD/KZT",
  direction: "up",
  directionLabel: "Рост",
  targetLow: 512,
  targetHigh: 515,
  symbol: "₸",
  summary: "Тренд поддержан решением НБ РК по ставке — сигнал умеренный.",
};

export function getTodaySummary(): TodaySummary {
  return today;
}
