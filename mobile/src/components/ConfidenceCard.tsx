import { Pressable, StyleSheet, View } from 'react-native'
import { radius, spacing, useTheme } from '../theme'
import { Text } from './Text'
import { Card } from './Card'
import { InfoIcon } from './icons'
import { confidenceWord } from './ConfidenceMeter'

type Props = {
  /** 0..100 — калиброванная уверенность (бриф правило 6). */
  value: number
  /** Что показать по тапу — объяснение методики (не формула «из головы», бриф §5.4). */
  explanation: string
  expanded: boolean
  onToggle: () => void
}

/**
 * Карточка уверенности для полного прогноза (4.4): заголовок-слово + число
 * в одной строке со шкалой, раскрывается по тапу — в отличие от компактного
 * ConfidenceMeter в ForecastCard, где слово и число подписаны под шкалой.
 */
export function ConfidenceCard({ value, explanation, expanded, onToggle }: Props) {
  const { colors } = useTheme()
  const clamped = Math.max(0, Math.min(100, value))

  return (
    <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded }}>
      <Card>
        <View style={styles.row}>
          <Text variant="title">{confidenceWord(clamped)}</Text>
          <View style={styles.valueRow}>
            <Text variant="label" color={colors.textSecondary} tabular>
              {Math.round(clamped)}
            </Text>
            <InfoIcon color={colors.textSecondary} />
          </View>
        </View>

        <View style={[styles.track, { backgroundColor: colors.borderSubtle }]}>
          <View style={[styles.tick, { backgroundColor: colors.textTertiary }]} />
          <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: colors.accent }]} />
        </View>

        {expanded && (
          <Text
            variant="body"
            color={colors.textSecondary}
            style={[styles.explanation, { borderTopColor: colors.borderSubtle }]}
          >
            {explanation}
          </Text>
        )}
      </Card>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  track: {
    marginTop: spacing.sm + 2, // 10
    height: 6,
    borderRadius: radius.sm - 5, // 3
    justifyContent: 'center',
  },
  fill: { height: 6, borderRadius: radius.sm - 5 },
  tick: { position: 'absolute', left: '50%', top: -3, width: 1, height: 12, zIndex: 1 },
  explanation: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
})
