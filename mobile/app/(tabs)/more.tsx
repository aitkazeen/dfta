import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, useTheme } from "../../src/theme";
import {
  Text,
  Card,
  IconButton,
  AppleSignInCard,
  GoogleSignInCard,
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

      <View style={styles.content}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
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
});
