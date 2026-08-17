import type { FullForecast } from "../types";

/**
 * Моковый полный прогноз USD/KZT — значения ровно из хендофф-макета
 * (docs/design-handoffs/Financer - Full Forecast.dc.html, §4.4). Временная
 * заглушка на этап 0, как и src/mock/pair.ts — форма совпадает с доменным
 * типом, поэтому позже её заменит fetch без правок экрана.
 */
const usdKzt: FullForecast = {
  pairId: "USD-KZT",
  ticker: "USD/KZT",
  direction: "up",
  directionLabel: "Рост",
  targetLow: 512,
  targetHigh: 515,
  symbol: "₸",
  currentRate: 511.4,
  confidence: 60,
  confidenceExplanation:
    "Уверенность — это согласованность технических индикаторов, новостного фона и исторической точности модели по этой паре. Не вероятность в строгом статистическом смысле, а сводный балл от 0 до 100.",
  aiExplanation:
    "Тренд последних дней поддержан решением НБ РК по ставке и слабостью доллара после риторики ФРС. Технические индикаторы остаются на стороне покупателей, признаков резкого разворота не зафиксировано.",
  drivers: [
    {
      category: "regulator",
      what: "НБ РК повысил базовую ставку до 15.75%",
      impact:
        "Более высокая ставка обычно поддерживает нацвалюту в краткосрочной перспективе — приток капитала на депозиты в тенге.",
      source: "НБ РК, пресс-релиз",
    },
    {
      category: "technical",
      what: "Цена выше EMA50, бычий крест MACD",
      impact:
        "Технические индикаторы указывают на сохранение восходящего импульса в ближайшие дни.",
      source: "Технический анализ",
    },
    {
      category: "global",
      what: "ФРС сохранила ставку, риторика жёстче ожиданий",
      impact:
        "Более жёсткая риторика ФРС временно ослабляет доллар на глобальных площадках.",
      source: "Reuters",
    },
  ],
  accuracy: { total: 148, windowDays: 90, hitRatePct: 61 },
  trend: {
    predicted: [
      508, 508.5, 509, 509.5, 510, 510.4, 510.8, 511.2, 511.6, 512, 512.3,
    ],
    actual: [
      508, 508.3, 509.4, 509.1, 510.3, 510.9, 510.5, 511.5, 511.3, 512.2, 511.9,
    ],
  },
};

const BY_ID: Record<string, FullForecast> = {
  "USD-KZT": usdKzt,
};

/** Возвращает полный прогноз по id пары (/pairs/[id]/forecast). */
export function getFullForecast(id?: string): FullForecast {
  return (id && BY_ID[id]) || usdKzt;
}
