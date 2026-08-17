import { StyleSheet, View } from "react-native";
import { radius, spacing, useTheme } from "../theme";
import { Text } from "./Text";

type Props = {
  /** 0..100 — калиброванная уверенность (бриф правило 6). */
  value: number;
  /** Слово-оценка. Если не передано — выводится по шкале (см. confidenceWord). */
  label?: string;
};

/**
 * Шкала уверенности 0–100 с засечкой на 50 («случайность»).
 * Слово крупнее числа — так требует бриф §3.4: человек читает оценку словом,
 * число вторично. Заполнение — accent, ширина = value%.
 */
export function ConfidenceMeter({ value, label }: Props) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <View>
      <View style={[styles.track, { backgroundColor: colors.borderSubtle }]}>
        {/* Засечка «случайность» на 50% */}
        <View style={[styles.tick, { backgroundColor: colors.textTertiary }]} />
        <View
          style={[
            styles.fill,
            { width: `${clamped}%`, backgroundColor: colors.accent },
          ]}
        />
      </View>
      <View style={styles.caption}>
        <Text variant="title" style={styles.word}>
          {label ?? confidenceWord(clamped)}
        </Text>
        <Text variant="label" color={colors.textSecondary} tabular>
          {Math.round(clamped)}
        </Text>
      </View>
    </View>
  );
}

/** Пороги слов — из брифа §3.4. */
export function confidenceWord(value: number): string {
  if (value < 55) return "Слабый сигнал";
  if (value < 65) return "Умеренная уверенность";
  if (value < 75) return "Выраженный сигнал";
  return "Сильный сигнал";
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: radius.sm - 5, // 3
    justifyContent: "center",
  },
  fill: {
    height: 6,
    borderRadius: radius.sm - 5,
  },
  tick: {
    position: "absolute",
    left: "50%",
    top: -3,
    width: 1,
    height: 12,
    zIndex: 1,
  },
  caption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: spacing.sm - 2, // 6
  },
  // Слово по макету 15/600 — крупнее числа (13/500)
  word: { fontSize: 15, lineHeight: 20 },
});
