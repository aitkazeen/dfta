import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { fontFamily, spacing, useTheme } from '../../src/theme'
import { getCandles, getPairs, getQuote } from '../../src/api'
import { deriveDelta, pairFlags, sparkPoints } from '../../src/lib/market'
import { getTodaySummary } from '../../src/mock/watchlist'
import { Card, GearIcon, IconButton, PairRow, Text, TodayCard } from '../../src/components'
import type { WatchlistPair } from '../../src/types'

/**
 * Главный экран / watchlist (4.2). Порядок сверху вниз: карточка «Сегодня»
 * (ответ раньше данных), список пар, кнопка добавления. Шапка вынесена из
 * ScrollView, поэтому «прилипает» сверху.
 */
export default function WatchlistScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()

  // «Сегодня» — карточка с прогнозом, бэкенд его ещё не считает (мок, см.
  // src/mock/watchlist.ts). Список пар ниже — реальные данные с бэкенда.
  const today = getTodaySummary()
  const [pairs, setPairs] = useState<WatchlistPair[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const list = await getPairs()
      const rows = await Promise.all(
        list.map(async (p): Promise<WatchlistPair> => {
          const [quote, candles] = await Promise.all([getQuote(p.id), getCandles(p.id, 7)])
          const { deltaPct, direction } = deriveDelta(quote.rate, candles)
          return {
            id: p.id,
            flags: pairFlags(p.base, p.quote),
            base: p.base,
            quote: p.quote,
            rate: quote.rate,
            symbol: '₸',
            direction,
            deltaPct,
            spark: sparkPoints(candles),
          }
        }),
      )
      if (!cancelled) setPairs(rows)
    }

    load().catch((err) => console.error('[watchlist] не удалось загрузить пары', err))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <View style={[styles.screen, { backgroundColor: colors.bgBase }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.borderSubtle },
        ]}
      >
        <Text variant="caption" color={colors.textTertiary}>
          Обновлено сегодня в 11:32
        </Text>
        <IconButton
          accessibilityLabel="Настройки"
          onPress={() => {
            /* TODO: экран 4.8 «Ещё» / 4.7 настройки уведомлений */
          }}
        >
          <GearIcon color={colors.textSecondary} />
        </IconButton>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
      >
        <View style={styles.todaySection}>
          <Text style={styles.sectionLabel} color={colors.textTertiary}>
            СЕГОДНЯ
          </Text>
          <TodayCard today={today} onPress={() => router.push(`/pairs/${today.pairId}`)} />
        </View>

        <View style={styles.pairsHeader}>
          <Text style={styles.sectionLabel} color={colors.textTertiary}>
            ВАШИ ПАРЫ
          </Text>
        </View>
        <View style={styles.pairsWrap}>
          <Card padded={false} style={styles.pairsCard}>
            {pairs.length === 0 && (
              <Text variant="body" color={colors.textTertiary} style={styles.loading}>
                Загрузка курсов…
              </Text>
            )}
            {pairs.map((p, i) => (
              <PairRow
                key={p.id}
                pair={p}
                divider={i < pairs.length - 1}
                onPress={() => router.push(`/pairs/${p.id}`)}
              />
            ))}
          </Card>
        </View>

        <View style={styles.addWrap}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              /* TODO: поиск и добавление пары */
            }}
            style={({ pressed }) => [
              styles.addBtn,
              {
                backgroundColor: colors.bgSurfaceRaised,
                borderColor: colors.borderSubtle,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Text style={styles.addPlus} color={colors.textSecondary}>
              +
            </Text>
            <Text style={styles.addLabel} color={colors.textSecondary}>
              Добавить пару
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  sectionLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    letterSpacing: 0.3,
    marginBottom: spacing.sm,
  },
  todaySection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  pairsHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl - 4, // 20
  },
  pairsWrap: { paddingHorizontal: spacing.lg },
  pairsCard: { overflow: 'hidden' },
  loading: { paddingVertical: spacing.lg, textAlign: 'center' },
  addWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addPlus: { fontFamily: fontFamily.semibold, fontSize: 17, lineHeight: 20 },
  addLabel: { fontFamily: fontFamily.semibold, fontSize: 15 },
})
