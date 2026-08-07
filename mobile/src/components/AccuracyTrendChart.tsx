import { StyleSheet, View } from 'react-native'
import Svg, { Line, Polyline } from 'react-native-svg'
import { spacing, useTheme } from '../theme'
import { Text } from './Text'
import type { AccuracyTrend } from '../types'

type Props = {
  trend: AccuracyTrend
}

const VIEW_W = 340
const VIEW_H = 120

/** Точки в общей шкале 0..VIEW_W / 0..VIEW_H (домен по обоим рядам сразу,
 *  чтобы предсказание и факт были сопоставимы на одном графике). */
function toLine(values: number[], min: number, max: number): string {
  const range = max - min || 1
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * VIEW_W
      const y = VIEW_H - 10 - ((v - min) / range) * 100
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

/**
 * Линейный график «предсказано (пунктир) vs. факт (сплошная)» за 30 дней —
 * визуальное доказательство честной точности движка (экран 4.4, §5.4).
 */
export function AccuracyTrendChart({ trend }: Props) {
  const { colors } = useTheme()
  const all = [...trend.predicted, ...trend.actual]
  const min = Math.min(...all)
  const max = Math.max(...all)

  return (
    <View>
      <Text variant="label" color={colors.textSecondary} style={styles.title}>
        Предсказано vs. факт, 30 дней
      </Text>
      <Svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
        <Polyline
          points={toLine(trend.predicted, min, max)}
          fill="none"
          stroke={colors.accent}
          strokeWidth={1.6}
          strokeDasharray="4 3"
        />
        <Polyline points={toLine(trend.actual, min, max)} fill="none" stroke={colors.textPrimary} strokeWidth={1.6} />
      </Svg>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <Svg width={12} height={2}>
            <Line x1={0} y1={1} x2={12} y2={1} stroke={colors.accent} strokeWidth={1.6} strokeDasharray="4 3" />
          </Svg>
          <Text variant="label" color={colors.textSecondary}>
            Прогноз
          </Text>
        </View>
        <View style={styles.legendItem}>
          <Svg width={12} height={2}>
            <Line x1={0} y1={1} x2={12} y2={1} stroke={colors.textPrimary} strokeWidth={1.6} />
          </Svg>
          <Text variant="label" color={colors.textSecondary}>
            Факт
          </Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  title: { marginBottom: spacing.sm },
  legend: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.xs + 2, // 6
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 }, // 6
})
