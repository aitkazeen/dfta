import { StyleSheet, View } from "react-native";
import { useTheme } from "../theme";

type Props = {
  /** Последние N резолвов прогнозов: true = совпало с фактом. */
  outcomes: boolean[];
};

/**
 * Ряд квадратов-исходов для блока «Точность прогнозов»: совпадение —
 * полный signal/up, промах — приглушённый text/tertiary. Визуализирует
 * честную точность из forecast_outcome (бриф §4.4 «Честная статистика»).
 */
export function AccuracyGrid({ outcomes }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.grid}>
      {outcomes.map((hit, i) => (
        <View
          key={i}
          style={[
            styles.cell,
            {
              backgroundColor: hit ? colors.up : colors.textTertiary,
              opacity: hit ? 1 : 0.4,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
  },
  cell: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
});
