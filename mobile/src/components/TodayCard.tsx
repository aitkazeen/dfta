import { Pressable, StyleSheet, View } from "react-native";
import { fontFamily, spacing, useTheme } from "../theme";
import { formatRange } from "../lib/format";
import { Card } from "./Card";
import { Text } from "./Text";
import { DirectionBadge } from "./DirectionBadge";
import type { TodaySummary } from "../types";

type Props = {
  today: TodaySummary;
  onPress?: () => void;
};

/**
 * Верхняя карточка «Сегодня» на watchlist (бриф §4.2): первое, что видит
 * человек — сокращённый прогноз по паре №1. Ответ раньше данных (принцип §2).
 * Тап ведёт на экран пары.
 */
export function TodayCard({ today, onPress }: Props) {
  const { colors } = useTheme();

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => (
        <Card style={pressed ? styles.pressed : undefined}>
          <View style={styles.header}>
            <Text style={styles.ticker} color={colors.textSecondary}>
              {today.ticker}
            </Text>
            <DirectionBadge
              direction={today.direction}
              label={today.directionLabel}
              size="md"
            />
          </View>

          <Text tabular style={styles.range}>
            {formatRange(today.targetLow, today.targetHigh, today.symbol)}
          </Text>

          <Text
            variant="body"
            color={colors.textSecondary}
            style={styles.summary}
          >
            {today.summary}
          </Text>
        </Card>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ticker: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20 },
  range: {
    marginTop: spacing.sm,
    fontFamily: fontFamily.semibold,
    fontSize: 26,
    lineHeight: 30,
  },
  summary: { marginTop: spacing.sm, lineHeight: 21 },
});
