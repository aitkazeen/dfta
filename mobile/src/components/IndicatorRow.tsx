import { StyleSheet, View } from 'react-native'
import { spacing, useTheme } from '../theme'
import { Text } from './Text'
import type { Indicator, IndicatorTone } from '../types'

type Props = {
  indicator: Indicator
  /** Первая строка таблицы — без верхней границы. */
  first?: boolean
}

/**
 * Строка таблицы индикаторов: название → значение → интерпретация одним
 * словом с цветовым кодом. Термины даём с расшифровкой-словом, т.к. средний
 * пользователь не знает, что такое RSI/ATR (бриф §1.1).
 */
export function IndicatorRow({ indicator, first }: Props) {
  const { colors } = useTheme()
  const toneColor: Record<IndicatorTone, string> = {
    up: colors.up,
    down: colors.down,
    warn: colors.warn,
    neutral: colors.textSecondary,
  }

  return (
    <View
      style={[styles.row, !first && { borderTopWidth: 1, borderTopColor: colors.borderSubtle }]}
    >
      <Text variant="body" color={colors.textSecondary} style={styles.name}>
        {indicator.name}
      </Text>
      <Text variant="monoNum" tabular>
        {indicator.value}
      </Text>
      <Text variant="label" color={toneColor[indicator.tone]} style={styles.interp}>
        {indicator.interp}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2, // 10
  },
  name: { flexShrink: 0 },
  interp: { flexShrink: 1, textAlign: 'right' },
})
