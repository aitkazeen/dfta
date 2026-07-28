import type { PairSnapshot } from '../types'

/**
 * Моковый снимок пары USD/KZT — значения ровно из хендофф-макета (§4.3).
 * Временная заглушка на этап 0: FX-провайдер и эндпоинт /v1/pairs/snapshot
 * ещё не подключены. Форма совпадает с доменным типом, поэтому позже
 * заглушку заменит fetch без правок экрана.
 */
const usdKzt: PairSnapshot = {
  id: 'USD-KZT',
  base: 'USD',
  quote: 'KZT',
  symbol: '₸',
  rate: 511.4,
  deltaPct: 0.6,
  direction: 'up',
  quoteTime: '11:32',
  officialLine: 'НБ РК: 511.2 ₸ на 28.07',
  candles: [
    { o: 505.2, h: 506.8, l: 504.5, c: 506.1 },
    { o: 506.1, h: 507.5, l: 505.6, c: 505.9 },
    { o: 505.9, h: 506.4, l: 504.2, c: 504.8 },
    { o: 504.8, h: 506.0, l: 504.1, c: 505.6 },
    { o: 505.6, h: 507.2, l: 505.3, c: 506.9 },
    { o: 506.9, h: 508.1, l: 506.5, c: 507.8 },
    { o: 507.8, h: 508.4, l: 506.9, c: 507.2 },
    { o: 507.2, h: 509.0, l: 507.0, c: 508.6 },
    { o: 508.6, h: 509.3, l: 507.9, c: 508.1 },
    { o: 508.1, h: 509.8, l: 507.8, c: 509.5 },
    { o: 509.5, h: 510.6, l: 509.1, c: 510.2 },
    { o: 510.2, h: 510.9, l: 509.6, c: 509.9 },
    { o: 509.9, h: 511.4, l: 509.7, c: 510.8 },
    { o: 510.8, h: 511.9, l: 510.3, c: 511.5 },
    { o: 511.5, h: 512.2, l: 510.9, c: 511.0 },
    { o: 511.0, h: 511.8, l: 510.4, c: 511.2 },
    { o: 511.2, h: 512.0, l: 510.8, c: 511.7 },
    { o: 511.7, h: 512.4, l: 511.1, c: 511.4 },
  ],
  forecast: {
    direction: 'up',
    directionLabel: 'Рост',
    targetLow: 512,
    targetHigh: 515,
    confidence: 60,
    explanation:
      'Тренд последних дней поддержан решением НБ РК по ставке и слабостью доллара после риторики ФРС. Признаков резкого движения не зафиксировано.',
    drivers: [
      { category: 'technical', text: 'Техника: цена выше EMA50' },
      { category: 'news', text: 'Новость: НБ РК повысил ставку' },
      { category: 'regulator', text: 'Регулятор: заседание ФРС' },
    ],
    enginePairAccuracyPct: 61,
    enginePairWindowDays: 90,
  },
  indicators: [
    { name: 'RSI (14)', value: '68', interp: 'Перекуплен', tone: 'warn' },
    { name: 'MACD', value: '+1.2', interp: 'Бычий крест', tone: 'up' },
    { name: 'ATR (14)', value: '3.8 ₸', interp: 'Повышенная волатильность', tone: 'neutral' },
    { name: 'EMA 50/200', value: 'Выше EMA50', interp: 'Восходящий тренд', tone: 'up' },
  ],
  news: [
    {
      source: 'НБ РК',
      time: '28.07, 09:12',
      title: 'Нацбанк повысил базовую ставку до 15.75%',
      tag: 'Влияет на USD/KZT',
    },
    {
      source: 'Reuters',
      time: '27.07, 22:40',
      title: 'ФРС сохранила ставку, риторика жёстче ожиданий',
      tag: 'Влияет на USD/KZT',
    },
    {
      source: 'Минфин РК',
      time: '27.07, 16:05',
      title: 'Увеличены объёмы покупки валюты на бирже',
      tag: 'Влияет на USD/KZT',
    },
  ],
  accuracy: {
    hitRatePct: 61,
    total: 148,
    windowDays: 90,
    outcomes: [true, true, true, false, true, true, false, true, true, true, true, false, true, true, true, false, true, true, true, true],
  },
}

const BY_ID: Record<string, PairSnapshot> = {
  'USD-KZT': usdKzt,
}

/**
 * Возвращает снимок пары по id роута (/pairs/[id]).
 * Пока известна только USD-KZT — на неё же откатываемся по умолчанию.
 */
export function getPairSnapshot(id?: string): PairSnapshot {
  return (id && BY_ID[id]) || usdKzt
}
