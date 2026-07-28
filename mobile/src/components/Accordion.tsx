import { useEffect, useRef } from 'react'
import {
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  UIManager,
  View,
} from 'react-native'
import { spacing, useTheme } from '../theme'
import { Text } from './Text'
import { ChevronDownIcon } from './icons'

// На старой архитектуре Android LayoutAnimation нужно включать вручную.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

type Props = {
  title: string
  open: boolean
  onToggle: () => void
  /** Первая секция в группе — без верхней границы-разделителя. */
  first?: boolean
  children: React.ReactNode
}

/**
 * Секция-аккордеон. Шеврон плавно поворачивается на 180° (бриф 4.3),
 * раскрытие содержимого анимируется LayoutAnimation. Состояние open
 * держит родитель — так на экране пары все секции управляются одним объектом.
 */
export function Accordion({ title, open, onToggle, first, children }: Props) {
  const { colors } = useTheme()
  const rotation = useRef(new Animated.Value(open ? 1 : 0)).current

  useEffect(() => {
    Animated.timing(rotation, {
      toValue: open ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start()
  }, [open, rotation])

  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] })

  function handlePress() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    onToggle()
  }

  return (
    <View>
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={[styles.header, !first && { borderTopWidth: 1, borderTopColor: colors.borderSubtle }]}
      >
        <Text variant="title">{title}</Text>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <ChevronDownIcon color={colors.textTertiary} />
        </Animated.View>
      </Pressable>
      {open && <View style={styles.body}>{children}</View>}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
})
