import { Text as RNText, StyleSheet, type TextProps } from "react-native";
import { typography, useTheme, type TypographyVariant } from "../theme";

type Props = TextProps & {
  /** Стиль из типографической шкалы (бриф §3.2). По умолчанию body. */
  variant?: TypographyVariant;
  /** Цвет из темы. По умолчанию text/primary. */
  color?: string;
  /** Табличные цифры — обязательны для всех курсов и значений (бриф §3.2). */
  tabular?: boolean;
  center?: boolean;
};

/**
 * Единственный способ выводить текст в приложении. Инкапсулирует шкалу
 * и цвета темы — компоненты не хардкодят fontSize/цвет, а называют роль.
 */
export function Text({
  variant = "body",
  color,
  tabular,
  center,
  style,
  ...rest
}: Props) {
  const { colors } = useTheme();
  return (
    <RNText
      {...rest}
      style={[
        typography[variant],
        { color: color ?? colors.textPrimary },
        tabular && styles.tabular,
        center && styles.center,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  tabular: { fontVariant: ["tabular-nums"] },
  center: { textAlign: "center" },
});
