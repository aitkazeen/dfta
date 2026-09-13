import { Modal, Pressable, StyleSheet, View } from "react-native";
import { fontFamily, radius, spacing, useTheme } from "../theme";
import { Text } from "./Text";

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Красит кнопку подтверждения в цвет опасного действия (удаление). */
  destructive?: boolean;
  /** Идёт запрос: блокирует кнопки и закрытие по фону, чтобы не отменить
   *  действие на полпути. */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Единая модалка подтверждения — замена нативному Alert.alert (тот не
 * стилизуется и по-разному ведёт себя на iOS/Android/web). Управляется
 * состоянием: родитель держит visible и колбэки.
 *
 * Закрытие по тапу на фон и по системной кнопке "назад" (Android) равно
 * отмене — но не во время loading.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "ОК",
  cancelLabel = "Отмена",
  destructive,
  loading,
  onConfirm,
  onCancel,
}: Props) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={loading ? undefined : onCancel}
    >
      <Pressable
        style={styles.backdrop}
        onPress={loading ? undefined : onCancel}
      >
        {/* Внутренний Pressable перехватывает тап на карточке, чтобы он не
            дошёл до фона и не закрыл диалог. */}
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: colors.bgSurfaceRaised,
              borderColor: colors.borderSubtle,
            },
          ]}
          onPress={() => {}}
        >
          <Text variant="title">{title}</Text>
          {message ? (
            <Text variant="body" color={colors.textSecondary}>
              {message}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              disabled={loading}
              accessibilityRole="button"
              style={[styles.btn, { borderColor: colors.borderSubtle }]}
            >
              <Text variant="label" color={colors.textPrimary}>
                {cancelLabel}
              </Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={loading}
              accessibilityRole="button"
              style={[
                styles.btn,
                styles.confirmBtn,
                {
                  backgroundColor: destructive ? colors.down : colors.accent,
                  borderColor: destructive ? colors.down : colors.accent,
                  opacity: loading ? 0.6 : 1,
                },
              ]}
            >
              <Text
                variant="label"
                color={colors.onAccent}
                style={{ fontFamily: fontFamily.semibold }}
              >
                {loading ? "…" : confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  btn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtn: { borderWidth: 0 },
});
