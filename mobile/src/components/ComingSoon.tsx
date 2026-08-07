import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { spacing, useTheme } from '../theme'
import { Text } from './Text'

type Props = {
  title: string
  note?: string
}

/** Заглушка ещё не спроектированного экрана таб-бара. */
export function ComingSoon({ title, note }: Props) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.screen, { backgroundColor: colors.bgBase, paddingTop: insets.top }]}>
      <View style={styles.center}>
        <Text variant="h2">{title}</Text>
        <Text variant="body" color={colors.textSecondary} center>
          {note ?? 'Экран появится на следующем этапе.'}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
})
