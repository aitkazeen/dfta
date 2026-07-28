import { Pressable, StyleSheet, View } from 'react-native'
import { fontFamily, radius, spacing, useTheme } from '../theme'
import { formatRange } from '../lib/format'
import { Card } from './Card'
import { Text } from './Text'
import { DirectionBadge } from './DirectionBadge'
import { ConfidenceMeter } from './ConfidenceMeter'
import { DriverChip } from './DriverChip'
import { Disclaimer } from './Disclaimer'
import type { Forecast } from '../types'

type Props = {
  forecast: Forecast
  /** Символ котируемой валюты для целевого диапазона ("₸"). */
  symbol: string
  /** Переход на полный прогноз (экран 4.4). */
  onPressDetails?: () => void
  onPressDriver?: (index: number) => void
}

/**
 * Главный носитель ценности продукта (бриф §3.4, §9): направление →
 * целевой диапазон → уверенность → объяснение → драйверы → честная точность
 * движка → дисклеймер. Свёрнутый вариант для экрана пары, с кнопкой
 * «Подробнее» на полный прогноз.
 */
export function ForecastCard({ forecast, symbol, onPressDetails, onPressDriver }: Props) {
  const { colors } = useTheme()

  return (
    <Card>
      <View style={styles.header}>
        <Text variant="title">Прогноз на сегодня</Text>
        <DirectionBadge direction={forecast.direction} label={forecast.directionLabel} size="md" />
      </View>

      <Text tabular style={styles.target}>
        {formatRange(forecast.targetLow, forecast.targetHigh, symbol)}
      </Text>

      <View style={styles.meter}>
        <ConfidenceMeter value={forecast.confidence} />
      </View>

      <Text variant="body" color={colors.textSecondary} style={styles.explanation}>
        {forecast.explanation}
      </Text>

      <View style={styles.drivers}>
        {forecast.drivers.map((d, i) => (
          <DriverChip
            key={i}
            category={d.category}
            text={d.text}
            onPress={onPressDriver ? () => onPressDriver(i) : undefined}
          />
        ))}
      </View>

      <Text
        variant="label"
        color={colors.textSecondary}
        style={[styles.accuracy, { borderTopColor: colors.borderSubtle }]}
      >
        Точность движка по этой паре: {forecast.enginePairAccuracyPct}% ({forecast.enginePairWindowDays}{' '}
        дней)
      </Text>

      <Pressable
        onPress={onPressDetails}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.detailsBtn,
          {
            backgroundColor: colors.bgSurfaceRaised,
            borderColor: colors.borderSubtle,
            opacity: pressed ? 0.6 : 1,
          },
        ]}
      >
        <Text style={{ fontFamily: fontFamily.semibold, fontSize: 15 }}>Подробнее</Text>
      </Pressable>

      <View style={styles.disclaimer}>
        <Disclaimer />
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  target: {
    marginTop: spacing.sm + 2, // 10
    fontFamily: fontFamily.semibold,
    fontSize: 28,
    lineHeight: 32,
  },
  meter: { marginTop: spacing.md + 2 }, // 14
  explanation: { marginTop: spacing.md },
  drivers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  accuracy: {
    marginTop: spacing.md + 2, // 14
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  detailsBtn: {
    marginTop: spacing.md,
    width: '100%',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  disclaimer: { marginTop: spacing.md },
})
