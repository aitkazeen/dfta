import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { fontFamily, radius, spacing, useTheme } from '../../../src/theme'
import { formatRange, formatRate } from '../../../src/lib/format'
import { getForecast, getQuote } from '../../../src/api'
import { DIRECTION_LABEL, fallbackTargetRange } from '../../../src/lib/forecast'
import { getFullForecast } from '../../../src/mock/fullForecast'
import type { ForecastHorizon } from '../../../src/types'
import {
  AccuracyTrendChart,
  BellIcon,
  Card,
  ChevronLeftIcon,
  ConfidenceCard,
  DirectionBadge,
  Disclaimer,
  DriverCard,
  IconButton,
  Text,
} from '../../../src/components'

const HORIZONS: readonly ForecastHorizon[] = ['24ч', '7д']
const HORIZON_LABEL: Record<ForecastHorizon, string> = { '24ч': '24 часа', '7д': '7 дней' }

/**
 * Полный прогноз (4.4) — детализация ForecastCard с экрана пары: объяснение
 * уверенности, текст от ИИ с явной пометкой (правило 3 / бриф §8), развёрнутые
 * драйверы с источниками, честная статистика с графиком предсказано/факт.
 */
export default function FullForecastScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  // Реальными становятся только direction/target*/confidence/currentRate —
  // остальное (confidenceExplanation, aiExplanation, драйверы с источниками,
  // accuracy, trend) требует LLM-шага и forecast_outcome (задача #9),
  // которых ещё нет. Выдумывать эти поля хуже, чем явно оставить мок.
  const [forecast, setForecast] = useState(() => getFullForecast(id))

  useEffect(() => {
    if (!id) return
    let cancelled = false

    Promise.all([getQuote(id), getForecast(id).catch(() => null)])
      .then(([quote, api]) => {
        if (cancelled) return
        setForecast((prev) => ({
          ...prev,
          currentRate: quote.rate,
          ...(api
            ? {
                direction: api.direction,
                directionLabel: DIRECTION_LABEL[api.direction],
                targetLow: api.targetLow,
                targetHigh: api.targetHigh,
                confidence: Math.round(api.confidence * 100),
              }
            : fallbackTargetRange(quote.rate)),
        }))
      })
      .catch((err) => console.error('[forecast] не удалось загрузить курс/прогноз', err))

    return () => {
      cancelled = true
    }
  }, [id])

  const [horizon, setHorizon] = useState<ForecastHorizon>('24ч')
  const [confidenceOpen, setConfidenceOpen] = useState(false)

  return (
    <View style={[styles.screen, { backgroundColor: colors.bgBase }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.borderSubtle },
        ]}
      >
        <IconButton accessibilityLabel="Назад" onPress={() => router.back()}>
          <ChevronLeftIcon color={colors.textPrimary} />
        </IconButton>
        <Text variant="title">Прогноз · {forecast.ticker}</Text>
        <IconButton
          accessibilityLabel="Создать алерт по паре"
          onPress={() => {
            /* TODO: экран 4.6 — конструктор алерта, предзаполненный этой парой */
          }}
        >
          <BellIcon color={colors.textSecondary} />
        </IconButton>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.block}>
          <View style={styles.horizonRow}>
            {HORIZONS.map((h) => {
              const active = h === horizon
              return (
                <Pressable
                  key={h}
                  onPress={() => setHorizon(h)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.horizonTab,
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
                      fontSize: 14,
                    }}
                  >
                    {h}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <View style={styles.directionRow}>
            <DirectionBadge direction={forecast.direction} label={forecast.directionLabel} size="md" />
            <Text variant="label" color={colors.textTertiary}>
              на горизонте {HORIZON_LABEL[horizon]}
            </Text>
          </View>

          <Text tabular style={styles.target}>
            {formatRange(forecast.targetLow, forecast.targetHigh, forecast.symbol)}
          </Text>
          <Text variant="label" color={colors.textSecondary} style={styles.currentRate}>
            Текущая цена: {formatRate(forecast.currentRate)} {forecast.symbol}
          </Text>
        </View>

        <View style={styles.blockH}>
          <ConfidenceCard
            value={forecast.confidence}
            explanation={forecast.confidenceExplanation}
            expanded={confidenceOpen}
            onToggle={() => setConfidenceOpen((v) => !v)}
          />
        </View>

        <View style={styles.blockH}>
          <Card>
            <Text variant="body">{forecast.aiExplanation}</Text>
            <Text variant="caption" color={colors.textTertiary} style={styles.aiTag}>
              ✦ СГЕНЕРИРОВАНО ИИ
            </Text>
          </Card>
        </View>

        <View style={styles.sectionLabelWrap}>
          <Text variant="label" color={colors.textTertiary} style={styles.sectionLabel}>
            ДРАЙВЕРЫ ПРОГНОЗА
          </Text>
        </View>
        <View style={styles.drivers}>
          {forecast.drivers.map((d, i) => (
            <DriverCard
              key={i}
              driver={d}
              onPressSource={() => {
                /* TODO: переход/раскрытие первоисточника драйвера */
              }}
            />
          ))}
        </View>

        <View style={[styles.sectionLabelWrap, { paddingTop: spacing.xl }]}>
          <Text variant="label" color={colors.textTertiary} style={styles.sectionLabel}>
            ЧЕСТНАЯ СТАТИСТИКА
          </Text>
        </View>
        <View style={styles.blockH}>
          <Card>
            <View style={styles.statsRow}>
              <View>
                <Text tabular style={styles.statValue}>
                  {forecast.accuracy.total}
                </Text>
                <Text variant="label" color={colors.textTertiary} style={styles.statCaption}>
                  прогнозов за {forecast.accuracy.windowDays} дн.
                </Text>
              </View>
              <View>
                <Text tabular color={colors.up} style={styles.statValue}>
                  {forecast.accuracy.hitRatePct}%
                </Text>
                <Text variant="label" color={colors.textTertiary} style={styles.statCaption}>
                  сбылось
                </Text>
              </View>
            </View>

            <View style={styles.trend}>
              <AccuracyTrendChart trend={forecast.trend} />
            </View>

            <Text
              variant="label"
              color={colors.textSecondary}
              style={[styles.methodology, { borderTopColor: colors.borderSubtle }]}
            >
              Точность рассчитывается по совпадению направления движения, а не точной цены.
              Публикуем всегда, даже когда результат ниже среднего.
            </Text>
          </Card>
        </View>

        <View style={styles.footer}>
          <Disclaimer center />
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
  block: { padding: spacing.lg, paddingBottom: 0 },
  blockH: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  horizonRow: { flexDirection: 'row', gap: spacing.sm - 2 }, // 6
  horizonTab: {
    flex: 1,
    paddingVertical: spacing.sm + 1, // 9
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  target: {
    marginTop: spacing.sm + 2, // 10
    fontFamily: fontFamily.semibold,
    fontSize: 36,
    lineHeight: 40,
  },
  currentRate: { marginTop: 2 },
  aiTag: { marginTop: spacing.sm },
  sectionLabelWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl - 4 }, // 20
  sectionLabel: { fontFamily: fontFamily.semibold, letterSpacing: 0.3, marginBottom: spacing.sm },
  drivers: { paddingHorizontal: spacing.lg, gap: spacing.sm + 2 }, // 10
  statsRow: { flexDirection: 'row', gap: spacing.xl },
  statValue: { fontFamily: fontFamily.semibold, fontSize: 26, lineHeight: 30 },
  statCaption: { marginTop: 2 },
  trend: { marginTop: spacing.lg },
  methodology: {
    marginTop: spacing.md + 2, // 14
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
})
