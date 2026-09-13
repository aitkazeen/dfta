import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, spacing, useTheme } from "../../src/theme";
import {
  Text,
  Card,
  ConfirmDialog,
  IconButton,
  AppleSignInCard,
  GoogleSignInCard,
  LEGAL_DISCLAIMER_FULL,
  LEGAL_ACCURACY,
  LEGAL_AI_DISCLOSURE,
} from "../../src/components";
import { useAuthStore } from "../../src/store/auth";

/** Профиль / Ещё (§4.8). Пока только вход/выход — настройки алертов и
 *  тихих часов появятся вместе с этапом 5 (уведомления).
 *
 *  Ветка "не вошёл" сюда обычно не доходит — весь (tabs) закрыт
 *  app/login.tsx, пока нет сессии (см. app/_layout.tsx, Stack.Protected).
 *  Оставлена как защитный фолбэк на случай гонки при разлогине, а не как
 *  рабочий путь. */
export default function MoreScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleConfirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      // При успехе статус станет signedOut и _layout сам покажет login —
      // этот экран размонтируется, сбрасывать состояние не нужно.
      await deleteAccount();
    } catch (err) {
      console.error("[account] не удалось удалить аккаунт", err);
      setDeleting(false);
      setConfirmVisible(false);
      setDeleteError("Не удалось удалить аккаунт. Попробуйте позже.");
    }
  }

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.bgBase, paddingTop: insets.top },
      ]}
    >
      <View style={styles.header}>
        <Text variant="h2">Ещё</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {status === "signedIn" ? (
          <Card style={styles.card}>
            <Text variant="title">{user?.email ?? "Аккаунт подключён"}</Text>
            <Text variant="body" color={colors.textSecondary}>
              Вы вошли в аккаунт
            </Text>
            <IconButton
              accessibilityLabel="Выйти"
              onPress={signOut}
              style={styles.signOutButton}
            >
              <Text variant="label" color={colors.textPrimary}>
                Выйти
              </Text>
            </IconButton>
          </Card>
        ) : (
          <Card style={styles.card}>
            <Text variant="title">Войти</Text>
            <Text variant="body" color={colors.textSecondary}>
              Нужно для push-уведомлений о прогнозах — без входа их некуда
              присылать.
            </Text>
            <AppleSignInCard />
            <GoogleSignInCard />
          </Card>
        )}

        {/* Правовая информация (roadmap §8) — постоянно доступна, не только
            на онбординге: дисклеймер, честная точность, раскрытие ИИ. */}
        <Card style={styles.card}>
          <Text variant="title">Правовая информация</Text>
          <Text variant="body" color={colors.textSecondary}>
            {LEGAL_DISCLAIMER_FULL}
          </Text>
          <Text variant="body" color={colors.textSecondary}>
            {LEGAL_ACCURACY}
          </Text>
          <Text variant="body" color={colors.textSecondary}>
            {LEGAL_AI_DISCLOSURE}
          </Text>
        </Card>

        {status === "signedIn" && (
          <Card style={styles.card}>
            <Text variant="title">Удаление аккаунта</Text>
            <Text variant="body" color={colors.textSecondary}>
              Удаляет аккаунт и все связанные данные безвозвратно.
            </Text>
            <Pressable
              onPress={() => setConfirmVisible(true)}
              disabled={deleting}
              accessibilityRole="button"
              accessibilityLabel="Удалить аккаунт"
              style={[
                styles.deleteButton,
                { borderColor: colors.down, opacity: deleting ? 0.5 : 1 },
              ]}
            >
              <Text variant="label" color={colors.down}>
                {deleting ? "Удаляем…" : "Удалить аккаунт"}
              </Text>
            </Pressable>
            {deleteError && (
              <Text variant="label" color={colors.down}>
                {deleteError}
              </Text>
            )}
          </Card>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={confirmVisible}
        title="Удалить аккаунт?"
        message="Аккаунт и все связанные данные (правила уведомлений, история) будут удалены безвозвратно."
        confirmLabel="Удалить"
        destructive
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  card: { gap: spacing.sm },
  signOutButton: {
    width: "auto",
    height: "auto",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginTop: spacing.sm,
  },
  deleteButton: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
});
