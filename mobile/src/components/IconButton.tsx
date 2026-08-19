import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { radius, useTheme } from "../theme";

type Props = {
  onPress?: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Круглая кнопка-иконка (back, bell). Визуально 36×36 как в макете,
 * но hitSlop добавляет по 4px с каждой стороны → эффективная зона нажатия
 * 44×44, как требует бриф §3.3.
 */
export function IconButton({
  onPress,
  accessibilityLabel,
  children,
  style,
}: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.bgSurfaceRaised, opacity: pressed ? 0.6 : 1 },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
