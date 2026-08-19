import { StyleSheet, View } from "react-native";
import { fontFamily, radius, useTheme } from "../theme";
import { directionArrow } from "../lib/format";
import { Text } from "./Text";
import type { Direction } from "../types";

type Size = "xs" | "sm" | "md";

type Props = {
  direction: Direction;
  /** Текст справа от стрелки: "0.6%" / "+0.6%" / "Рост". */
  label: string;
  /** xs — в строке watchlist, sm — в шапке, md — в карточке прогноза. */
  size?: Size;
};

const SIZES: Record<
  Size,
  {
    padV: number;
    padH: number;
    radius: number;
    fontSize: number;
    weight: string;
  }
> = {
  xs: {
    padV: 2,
    padH: 7,
    radius: 6,
    fontSize: 11,
    weight: fontFamily.semibold,
  },
  sm: {
    padV: 3,
    padH: 8,
    radius: radius.sm,
    fontSize: 13,
    weight: fontFamily.medium,
  },
  md: {
    padV: 4,
    padH: 10,
    radius: radius.sm,
    fontSize: 13,
    weight: fontFamily.semibold,
  },
};

/**
 * Пилюля направления: стрелка + слово/процент на цветном фоне.
 * Направление кодируется цветом И стрелкой И знаком — требование
 * дальтонизма (бриф §3.1). Один компонент на все места: строка watchlist,
 * дельта курса в шапке, «↑ Рост» в ForecastCard.
 */
export function DirectionBadge({ direction, label, size = "sm" }: Props) {
  const { colors } = useTheme();
  const cfg = SIZES[size];

  const palette = {
    up: { fg: colors.up, bg: colors.upBg },
    down: { fg: colors.down, bg: colors.downBg },
    flat: { fg: colors.flat, bg: colors.bgSurfaceRaised },
  }[direction];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: palette.bg,
          borderRadius: cfg.radius,
          paddingVertical: cfg.padV,
          paddingHorizontal: cfg.padH,
        },
      ]}
    >
      <Text
        tabular
        style={{
          color: palette.fg,
          fontFamily: cfg.weight,
          fontSize: cfg.fontSize,
          lineHeight: cfg.fontSize + 5,
        }}
      >
        {directionArrow(direction)} {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
  },
});
