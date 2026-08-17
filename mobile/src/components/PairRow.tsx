import { Pressable, StyleSheet, View } from "react-native";
import { fontFamily, spacing, useTheme } from "../theme";
import { formatRate } from "../lib/format";
import { Text } from "./Text";
import { DirectionBadge } from "./DirectionBadge";
import { Sparkline } from "./Sparkline";
import type { Direction, WatchlistPair } from "../types";

type Props = {
  pair: WatchlistPair;
  onPress?: () => void;
  /** Нижняя граница-разделитель (не нужна у последней строки). */
  divider?: boolean;
};

const SIGN: Record<Direction, string> = { up: "+", down: "−", flat: "" };

/**
 * Строка watchlist (§3.4): флаги-пара, тикер, дельта за 24ч, микро-спарклайн,
 * цена и бейдж направления. Высота 68 (бриф). Тап → экран пары.
 */
export function PairRow({ pair, onPress, divider }: Props) {
  const { colors } = useTheme();

  const dirColor = { up: colors.up, down: colors.down, flat: colors.flat }[
    pair.direction
  ];
  const pct = `${Math.abs(pair.deltaPct).toFixed(1)}%`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${pair.base}/${pair.quote}, ${formatRate(pair.rate)} ${pair.symbol}, за сутки ${SIGN[pair.direction]}${pct}`}
      style={({ pressed }) => [
        styles.row,
        divider && {
          borderBottomWidth: 1,
          borderBottomColor: colors.borderSubtle,
        },
        pressed && { backgroundColor: colors.bgSurfaceRaised },
      ]}
    >
      <View style={[styles.flags, { backgroundColor: colors.bgSurfaceRaised }]}>
        <Text style={styles.flagsText}>{pair.flags}</Text>
      </View>

      <View style={styles.mid}>
        <Text style={styles.ticker}>
          {pair.base}/{pair.quote}
        </Text>
        <Text
          tabular
          style={{
            color: dirColor,
            fontFamily: fontFamily.medium,
            fontSize: 13,
            lineHeight: 18,
          }}
        >
          24ч: {SIGN[pair.direction]}
          {pct}
        </Text>
      </View>

      <Sparkline points={pair.spark} color={dirColor} />

      <View style={styles.right}>
        <Text tabular style={styles.price}>
          {formatRate(pair.rate)} {pair.symbol}
        </Text>
        <View style={styles.badge}>
          <DirectionBadge direction={pair.direction} label={pct} size="xs" />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    height: 68,
  },
  flags: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  flagsText: { fontSize: 14 },
  mid: { flex: 1, minWidth: 0, gap: 2 },
  ticker: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20 },
  right: { alignItems: "flex-end", minWidth: 64 },
  price: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20 },
  badge: { marginTop: 2 },
});
