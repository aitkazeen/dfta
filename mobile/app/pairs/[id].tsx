import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { spacing, useTheme } from "../../src/theme";
import { formatRate, formatSignedPct } from "../../src/lib/format";
import {
  getCandles,
  getForecast,
  getIndicators,
  getQuote,
} from "../../src/api";
import { mapIndicators } from "../../src/lib/indicators";
import { fallbackTargetRange, mapForecast } from "../../src/lib/forecast";
import { deriveDelta } from "../../src/lib/market";
import { getPairSnapshot } from "../../src/mock/pair";
import type { PairSnapshot, Timeframe } from "../../src/types";
import {
  Accordion,
  AccuracyGrid,
  CandleChart,
  ChevronLeftIcon,
  BellIcon,
  DirectionBadge,
  Disclaimer,
  ForecastCard,
  IconButton,
  IndicatorRow,
  NewsItem,
  Text,
  TimeframeTabs,
} from "../../src/components";

type OpenSections = {
  indicators: boolean;
  news: boolean;
  accuracy: boolean;
};

/**
 * Экран валютной пары (4.3) — ключевой экран продукта.
 * Sticky-шапка (курс + дельта) вынесена из ScrollView, поэтому всегда
 * на виду; ниже скроллится график, ForecastCard и секции-аккордеоны.
 */
export default function PairScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  // news бэкенд ещё не считает (этап 3, INewsProvider не подключён) — берём
  // из мока как есть. rate/direction/deltaPct/quoteTime/officialLine/candles/
  // indicators/forecast ниже подменяются реальными данными после загрузки
  // (useEffect) — forecast почти весь реальный (direction/confidence/
  // targetLow/High от RulesForecastEngine, explanation/drivers от Explainer,
  // могут быть пустыми, если ANTHROPIC_API_KEY не задан или LLM-вызов не
  // удался); enginePairAccuracyPct/Days всё ещё мок — forecast_outcome воркер
  // уже пишет, но эндпоинта для чтения агрегированной точности пока нет.
  const [snap, setSnap] = useState<PairSnapshot>(() => getPairSnapshot(id));

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      const [quote, candles, indicators] = await Promise.all([
        getQuote(id),
        getCandles(id, 30),
        getIndicators(id),
      ]);
      if (cancelled || candles.length === 0) return;

      const { deltaPct, direction } = deriveDelta(quote.rate, candles);
      const quoteTime = new Date(quote.asOf).toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      });

      // Отдельно от Promise.all выше: 404 здесь — ожидаемое состояние
      // (воркер ещё не прогнал сутки для этой пары), не должно валить
      // загрузку курса/свечей/индикаторов, которые уже пришли успешно.
      const apiForecast = await getForecast(id).catch(() => null);
      if (cancelled) return;

      setSnap((prev) => ({
        ...prev,
        id: quote.id,
        base: quote.base,
        quote: quote.quote,
        rate: quote.rate,
        direction,
        deltaPct,
        quoteTime,
        officialLine: `${quote.source === "nbk" ? "НБ РК" : quote.source}: ${formatRate(quote.rate)} ₸`,
        candles: candles.map((c) => ({ o: c.o, h: c.h, l: c.l, c: c.c })),
        indicators: mapIndicators(indicators, quote.rate, prev.symbol),
        forecast: apiForecast
          ? mapForecast(apiForecast, prev.forecast)
          : { ...prev.forecast, ...fallbackTargetRange(quote.rate) },
      }));
    }

    load().catch((err) =>
      console.error("[pair] не удалось загрузить курс/свечи", err),
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  const [timeframe, setTimeframe] = useState<Timeframe>("1Д");
  const [open, setOpen] = useState<OpenSections>({
    indicators: true,
    news: false,
    accuracy: false,
  });

  const toggle = (key: keyof OpenSections) =>
    setOpen((s) => ({ ...s, [key]: !s[key] }));

  return (
    <View style={[styles.screen, { backgroundColor: colors.bgBase }]}>
      {/* Шапка (эффект sticky — она вне ScrollView) */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.sm,
            borderBottomColor: colors.borderSubtle,
          },
        ]}
      >
        <View style={styles.navRow}>
          <IconButton accessibilityLabel="Назад" onPress={() => router.back()}>
            <ChevronLeftIcon color={colors.textPrimary} />
          </IconButton>
          <Text variant="title">
            {snap.base}/{snap.quote}
          </Text>
          <IconButton
            accessibilityLabel="Создать алерт по паре"
            onPress={() => {
              /* TODO: экран 4.6 — конструктор алерта, предзаполненный этой парой */
            }}
          >
            <BellIcon color={colors.textSecondary} />
          </IconButton>
        </View>

        <View style={styles.rateRow}>
          <Text variant="display" tabular>
            {formatRate(snap.rate)} {snap.symbol}
          </Text>
          <DirectionBadge
            direction={snap.direction}
            label={formatSignedPct(snap.deltaPct)}
          />
        </View>

        <Text
          variant="caption"
          color={colors.textTertiary}
          style={styles.quoteLine}
        >
          Курс на {snap.quoteTime} · обновляется каждые 15 мин
        </Text>
        <Text
          variant="caption"
          color={colors.textTertiary}
          style={styles.officialLine}
        >
          {snap.officialLine}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.sm }}
        showsVerticalScrollIndicator={false}
      >
        {/* График + таймфреймы */}
        <View style={styles.block}>
          <View style={styles.tabs}>
            <TimeframeTabs value={timeframe} onChange={setTimeframe} />
          </View>
          <CandleChart
            candles={snap.candles}
            forecast={{
              low: snap.forecast.targetLow,
              high: snap.forecast.targetHigh,
            }}
          />
        </View>

        {/* Карточка прогноза */}
        <View style={styles.blockH}>
          <ForecastCard
            forecast={snap.forecast}
            symbol={snap.symbol}
            onPressDetails={() => router.push(`/pairs/${snap.id}/forecast`)}
          />
        </View>

        {/* Аккордеоны */}
        <View style={styles.blockH}>
          <View
            style={[
              styles.accordions,
              {
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderSubtle,
              },
            ]}
          >
            <Accordion
              title="Индикаторы"
              open={open.indicators}
              onToggle={() => toggle("indicators")}
              first
            >
              {snap.indicators.map((ind) => (
                <IndicatorRow key={ind.name} indicator={ind} />
              ))}
            </Accordion>

            <Accordion
              title="Новости по паре"
              open={open.news}
              onToggle={() => toggle("news")}
            >
              {snap.news.map((article) => (
                <NewsItem key={article.title} article={article} />
              ))}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  /* TODO: экран 4.5 — новости */
                }}
                style={styles.allNews}
              >
                <Text variant="label" color={colors.accent} center>
                  Все новости
                </Text>
              </Pressable>
            </Accordion>

            <Accordion
              title="Точность прогнозов"
              open={open.accuracy}
              onToggle={() => toggle("accuracy")}
            >
              <Text
                variant="body"
                color={colors.textSecondary}
                style={styles.accuracyText}
              >
                {snap.accuracy.hitRatePct}% предсказаний совпало с фактическим
                направлением — {snap.accuracy.total} прогнозов за{" "}
                {snap.accuracy.windowDays} дней.
              </Text>
              <AccuracyGrid outcomes={snap.accuracy.outcomes} />
            </Accordion>
          </View>
        </View>

        <View style={styles.footer}>
          <Disclaimer short center />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rateRow: {
    marginTop: spacing.lg + 2, // 18
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm + 2, // 10
  },
  quoteLine: { marginTop: 6 },
  officialLine: { marginTop: spacing.xs },
  block: { padding: spacing.lg },
  blockH: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  tabs: { marginBottom: spacing.md },
  accordions: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  allNews: { paddingTop: spacing.md },
  accuracyText: { marginBottom: spacing.sm + 2 },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
});
