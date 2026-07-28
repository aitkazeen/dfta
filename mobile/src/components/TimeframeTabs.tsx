import { Pressable, StyleSheet, View } from 'react-native'
import { fontFamily, radius, spacing, useTheme } from '../theme'
import { Text } from './Text'
import type { Timeframe } from '../types'

type Props = {
  value: Timeframe
  onChange: (tf: Timeframe) => void
  options?: readonly Timeframe[]
}

const DEFAULT_OPTIONS: readonly Timeframe[] = ['1Ч', '1Д', '1Н', '1М', '1Г']

/**
 * Ряд переключателей таймфрейма. Активный — заливка accent, текст белый;
 * неактивные — прозрачные с обводкой. Каждая кнопка flex:1 (равная ширина).
 * В проде смена таба должна перезапрашивать свечи за период.
 */
export function TimeframeTabs({ value, onChange, options = DEFAULT_OPTIONS }: Props) {
  const { colors } = useTheme()

  return (
    <View style={styles.row}>
      {options.map((tf) => {
        const active = tf === value
        return (
          <Pressable
            key={tf}
            onPress={() => onChange(tf)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              styles.tab,
              {
                backgroundColor: active ? colors.accent : 'transparent',
                borderColor: active ? colors.accent : colors.borderSubtle,
              },
            ]}
          >
            <Text
              style={{
                color: active ? colors.onAccent : colors.textSecondary,
                fontFamily: fontFamily.semibold,
                fontSize: 13,
              }}
            >
              {tf}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm - 2, // 6, как в макете
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
