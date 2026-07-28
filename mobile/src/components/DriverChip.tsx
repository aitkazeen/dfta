import { Pressable, StyleSheet } from 'react-native'
import { radius, useTheme } from '../theme'
import { Text } from './Text'
import { BankIcon, NewsIcon, TrendIcon } from './icons'
import type { DriverCategory } from '../types'

type Props = {
  category: DriverCategory
  text: string
  /** Тап раскрывает источник драйвера (бриф §3.4). */
  onPress?: () => void
}

const ICON = {
  technical: TrendIcon,
  news: NewsIcon,
  regulator: BankIcon,
} as const

/**
 * Пилюля-драйвер прогноза: линейная иконка категории + короткий текст.
 * Эмодзи заменены на линейные иконки — требование брифа §3.4.
 */
export function DriverChip({ category, text, onPress }: Props) {
  const { colors } = useTheme()
  const Icon = ICON[category]

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: colors.bgSurfaceRaised,
          borderColor: colors.borderSubtle,
          opacity: pressed && onPress ? 0.6 : 1,
        },
      ]}
    >
      <Icon color={colors.textSecondary} size={13} />
      <Text variant="label">{text}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
})
