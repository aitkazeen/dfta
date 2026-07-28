import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Link } from 'expo-router'
import { spacing, useTheme } from '../src/theme'
import { Card, Text } from '../src/components'

/**
 * Временная заглушка главного экрана (watchlist, 4.2 — ещё не спроектирован).
 * Пока это просто вход в готовый экран пары, чтобы его было куда открыть.
 */
export default function HomeScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.screen, { backgroundColor: colors.bgBase, paddingTop: insets.top + spacing.lg }]}>
      <Text variant="h1">Financer</Text>
      <Text variant="body" color={colors.textSecondary} style={styles.subtitle}>
        Watchlist появится здесь (экран 4.2). Пока — открой готовый экран пары:
      </Text>

      <Link href="/pairs/USD-KZT" asChild>
        <Pressable>
          <Card style={styles.link}>
            <Text variant="title">USD/KZT</Text>
            <Text variant="body" color={colors.textSecondary}>
              511.40 ₸ · прогноз на сегодня
            </Text>
          </Card>
        </Pressable>
      </Link>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  subtitle: { marginBottom: spacing.sm },
  link: { gap: spacing.xs },
})
