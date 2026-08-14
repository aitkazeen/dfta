import { EMA, RSI, MACD, Stochastic, ATR, BollingerBands } from 'technicalindicators'

type CandleInput = { ts: Date; open: number; high: number; low: number; close: number }
type IndicatorPoint = { ts: Date; name: string; value: number }

export function computeIndicators(candles: CandleInput[]): IndicatorPoint[] {
    const closes = candles.map((c) => c.close)
    const highs = candles.map((c) => c.high)
    const lows = candles.map((c) => c.low)
    const points: IndicatorPoint[] = []

    // technicalindicators returns arrays SHORTER than the input — a period-N
    // EMA over M candles gives M-N+1 values. They align to the END of the
    // input, so the result's index i corresponds to candles[candles.length - result.length + i].
    const align = (name: string, values: number[]) => {
        const offset = candles.length - values.length
        values.forEach((value, i) => points.push({ ts: candles[offset + i].ts, name, value }))
    }

    align('ema20', EMA.calculate({ period: 20, values: closes }))
    align('ema50', EMA.calculate({ period: 50, values: closes }))
    align('ema200', EMA.calculate({ period: 200, values: closes }))
    align('rsi14', RSI.calculate({ period: 14, values: closes }))
    align('atr14', ATR.calculate({ period: 14, high: highs, low: lows, close: closes }))

    const macd = MACD.calculate({
        values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
        SimpleMAOscillator: false, SimpleMASignal: false,
    })
    align('macd', macd.map((m) => m.MACD ?? 0))

    const stoch = Stochastic.calculate({ high: highs, low: lows, close: closes, period: 14, signalPeriod: 3 })
    align('stoch_k', stoch.map((s) => s.k))

    // BollingerBands doesn't give "width" directly — derive it: (upper-lower)/middle
    const bb = BollingerBands.calculate({ period: 20, values: closes, stdDev: 2 })
    align('bb_width', bb.map((b) => (b.upper - b.lower) / b.middle))

return points
}