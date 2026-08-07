import { Pressable, StyleSheet, View } from 'react-native'
import { fontFamily, radius, spacing, useTheme } from '../theme'
import { Text } from './Text'
import { Card } from './Card'
import { BankIcon, GlobeIcon, NewsIcon, TrendIcon } from './icons'
import type { FullForecastDriver } from '../types'

type Props = {
  driver: FullForecastDriver
  onPressSource?: () => void
}

const ICON = {
  technical: TrendIcon,
  news: NewsIcon,
  regulator: BankIcon,
  global: GlobeIcon,
} as const

/**
 * Развёрнутая карточка драйвера прогноза (экран 4.4) — детализация
 * компактного DriverChip с 4.3: иконка категории, заголовок события,
 * объяснение влияния на пару, ссылка на источник.
 */
export function DriverCard({ driver, onPressSource }: Props) {
  const { colors } = useTheme()
  const Icon = ICON[driver.category]

  return (
    <Card>
      <View style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: colors.bgSurfaceRaised }]}>
          <Icon color={colors.textSecondary} size={15} />
        </View>
        <Text variant="title" style={styles.what}>
          {driver.what}
        </Text>
      </View>

      <Text variant="body" color={colors.textSecondary} style={styles.impact}>
        {driver.impact}
      </Text>

      <Pressable
        onPress={onPressSource}
        accessibilityRole="button"
        hitSlop={4}
        style={({ pressed }) => [styles.source, { opacity: pressed && onPressSource ? 0.6 : 1 }]}
      >
        <Text variant="label" color={colors.accent} style={{ fontFamily: fontFamily.semibold }}>
          {driver.source} →
        </Text>
      </Pressable>
    </Card>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  what: { flex: 1 },
  impact: { marginTop: spacing.sm },
  source: { marginTop: spacing.sm + 2, alignSelf: 'flex-start' }, // 10
})
