import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fontFamily, radius, spacing, useTheme } from "../../src/theme";
import { getNews, getPairs, type ApiPair } from "../../src/api";
import { mergeNews, type FeedArticle } from "../../src/lib/news";
import { Card, NewsItem, Text } from "../../src/components";

/**
 * Лента новостей (4.5) — фильтр по паре + метка тональности (roadmap §5.2).
 * Агрегированного эндпоинта нет (только GET /v1/pairs/:id/news на пару) —
 * дёргаем его по всем парам watchlist параллельно и мёрджим (lib/news.ts).
 */
export default function NewsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [pairs, setPairs] = useState<ApiPair[]>([]);
  const [articles, setArticles] = useState<FeedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null); // null = "Все"

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const list = await getPairs();
      if (cancelled) return;
      setPairs(list);

      const perPair = await Promise.all(
        list.map(async (pair) => ({
          pair,
          // Отдельная пара без новостей за окно (или временная ошибка) не
          // должна ронять всю ленту — просто пустой массив для неё.
          articles: await getNews(pair.id).catch(() => []),
        })),
      );
      if (cancelled) return;
      setArticles(mergeNews(perPair));
      setLoading(false);
    }

    load().catch((err) => {
      console.error("[news] не удалось загрузить новости", err);
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () =>
      filter === null
        ? articles
        : articles.filter((a) => a.pairIds.includes(filter)),
    [articles, filter],
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.bgBase }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.sm,
            borderBottomColor: colors.borderSubtle,
          },
        ]}
      >
        <Text variant="title">Новости</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersRow}
        contentContainerStyle={styles.filters}
      >
        <FilterChip
          label="Все"
          active={filter === null}
          onPress={() => setFilter(null)}
        />
        {pairs.map((p) => (
          <FilterChip
            key={p.id}
            label={`${p.base}/${p.quote}`}
            active={filter === p.id}
            onPress={() => setFilter(p.id)}
          />
        ))}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.lg,
        }}
      >
        {loading && (
          <Text
            variant="body"
            color={colors.textTertiary}
            center
            style={styles.state}
          >
            Загрузка новостей…
          </Text>
        )}
        {!loading && visible.length === 0 && (
          <Text
            variant="body"
            color={colors.textTertiary}
            center
            style={styles.state}
          >
            Новостей пока нет.
          </Text>
        )}
        {visible.length > 0 && (
          <Card padded={false} style={styles.list}>
            {visible.map((article, i) => (
              <NewsItem key={article.url} article={article} first={i === 0} />
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

type FilterChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

/** Пилюля-фильтр по паре — визуальный язык TimeframeTabs (accent-заливка
 *  активного), но одна кнопка на весь текст, не flex:1, т.к. чипов может
 *  быть больше, чем помещается по ширине (ряд скроллится). */
function FilterChip({ label, active, onPress }: FilterChipProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.accent : "transparent",
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
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  filtersRow: { flexGrow: 0 },
  filters: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm - 2, // 6, как TimeframeTabs
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  state: { paddingVertical: spacing.xxl },
  list: { overflow: "hidden" },
});
