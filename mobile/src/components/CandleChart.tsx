import { Fragment } from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, { Line, Polygon, Rect } from 'react-native-svg'
import { spacing, useTheme } from '../theme'
import { Text } from './Text'
import type { Candle } from '../types'

type Props = {
  candles: Candle[]
  /** Прогнозная зона справа от «сейчас»: диапазон цены на конце горизонта. */
  forecast: { low: number; high: number }
}

// Геометрия макета (viewBox 0 0 340 220). Свечи занимают историю до CONE_X,
// правее — прогнозный конус до VIEW_W.
const VIEW_W = 340
const VIEW_H = 220
const STEP = 14 // шаг между свечами
const BODY_W = 10 // ширина тела свечи
const CONE_X = 260 // где кончается история и начинается прогноз

/**
 * Свечной график с прогнозным конусом. Конус расширяется к правому краю
 * и нарисован пунктиром на 14% заливке — он НЕ должен читаться как линия-
 * обещание (бриф §2, §9). Вертикальный пунктир отделяет факт от прогноза.
 *
 * По Y домен считается из самих данных (свечи + прогноз) с небольшим полем,
 * поэтому график корректно масштабируется под любые реальные значения.
 * По X геометрия фиксирована под ~18 свечей, как в макете.
 */
export function CandleChart({ candles, forecast }: Props) {
  const { colors } = useTheme()

  // Домен по цене: минимум/максимум среди свечей и прогноза + поле 8%.
  const lows = [...candles.map((c) => c.l), forecast.low]
  const highs = [...candles.map((c) => c.h), forecast.high]
  const rawMin = Math.min(...lows)
  const rawMax = Math.max(...highs)
  const pad = (rawMax - rawMin) * 0.08 || 1
  const minY = rawMin - pad
  const maxY = rawMax + pad

  const scaleY = (price: number) => ((maxY - price) / (maxY - minY)) * VIEW_H

  const last = candles[candles.length - 1]
  const lastCloseY = scaleY(last.c)
  const conePoints = `${CONE_X},${lastCloseY.toFixed(1)} ${VIEW_W},${scaleY(
    forecast.high,
  ).toFixed(1)} ${VIEW_W},${scaleY(forecast.low).toFixed(1)}`

  return (
    <View style={[styles.card, { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle }]}>
      <Svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
        {candles.map((cd, i) => {
          const x = i * STEP
          const cx = x + BODY_W / 2
          // НБ РК даёт один фиксинг в день, поэтому o===h===l===c внутри
          // каждой свечи (нет реального внутридневного диапазона) — тело
          // "open→close этого же дня" всегда было бы нулевым. Вместо этого
          // тело показывает close→close: сегодняшнее закрытие относительно
          // вчерашнего, что и есть единственное реальное движение в данных.
          const prevClose = candles[i - 1]?.c ?? cd.o
          const up = cd.c >= prevClose
          const color = up ? colors.up : colors.down
          const yPrevClose = scaleY(prevClose)
          const yClose = scaleY(cd.c)

          const bodyY = Math.min(yPrevClose, yClose)
          const bodyH = Math.max(1.5, Math.abs(yClose - yPrevClose))
          console.log(cd)
          return (
            <Fragment key={i}>
              <Line x1={cx} x2={cx} y1={scaleY(cd.h)} y2={scaleY(cd.l)} stroke={color} strokeWidth={1} />
              <Rect x={x} y={bodyY} width={BODY_W} height={bodyH} rx={1.5} fill={color} />
            </Fragment>
          )
        })}

        {/* Прогнозный конус */}
        <Polygon
          points={conePoints}
          fill={colors.accent}
          fillOpacity={0.14}
          stroke={colors.accent}
          strokeWidth={1.2}
          strokeDasharray="4 3"
        />

        {/* Граница «сейчас» */}
        <Line x1={CONE_X} x2={CONE_X} y1={0} y2={VIEW_H} stroke={colors.borderSubtle} strokeWidth={1} strokeDasharray="2 3" />
      </Svg>

      <View style={styles.legend}>
        <Svg width={10} height={2}>
          <Line x1={0} y1={1} x2={10} y2={1} stroke={colors.accent} strokeWidth={1.5} strokeDasharray="2 2" />
        </Svg>
        <Text variant="caption" color={colors.textTertiary}>
          Прогнозная зона — не обещание, а диапазон вероятности
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm - 2,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: 2,
  },
})
