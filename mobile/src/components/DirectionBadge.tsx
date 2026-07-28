import { StyleSheet, View } from 'react-native'
import { fontFamily, radius, useTheme } from '../theme'
import { directionArrow } from '../lib/format'
import { Text } from './Text'
import type { Direction } from '../types'

type Props = {
  direction: Direction
  /** Текст справа от стрелки: "+0.6%" (дельта) или "Рост" (прогноз). */
  label: string
  /** sm — в шапке/списке, md — в карточке прогноза. */
  size?: 'sm' | 'md'
}

/**
 * Пилюля направления: стрелка + слово/процент на цветном фоне.
 * Направление кодируется цветом И стрелкой И знаком — требование
 * дальтонизма (бриф §3.1). Один компонент на два случая: дельта курса
 * в шапке и «↑ Рост» в ForecastCard.
 */
export function DirectionBadge({ direction, label, size = 'sm' }: Props) {
  const { colors } = useTheme()

  const palette = {
    up: { fg: colors.up, bg: colors.upBg },
    down: { fg: colors.down, bg: colors.downBg },
    flat: { fg: colors.flat, bg: colors.bgSurfaceRaised },
  }[direction]

  const pad = size === 'md' ? styles.padMd : styles.padSm
  const weight = size === 'md' ? fontFamily.semibold : fontFamily.medium

  return (
    <View style={[styles.badge, pad, { backgroundColor: palette.bg }]}>
      <Text
        tabular
        style={{ color: palette.fg, fontFamily: weight, fontSize: 13, lineHeight: 18 }}
      >
        {directionArrow(direction)} {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  padSm: { paddingVertical: 3, paddingHorizontal: 8 },
  padMd: { paddingVertical: 4, paddingHorizontal: 10 },
})
