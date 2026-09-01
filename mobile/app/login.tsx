import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, useTheme } from "../src/theme";
import {
  Text,
  Card,
  AppleSignInCard,
  GoogleSignInCard,
  Disclaimer,
} from "../src/components";

/** Экран входа (§4.8 / §8 — дисклеймер обязателен на онбординге). Вне
 *  таб-бара — root Stack открывает его вместо (tabs), пока нет сессии
 *  (см. app/_layout.tsx, Stack.Protected). */
export default function LoginScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.bgBase, paddingTop: insets.top },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.intro}>
          <Text variant="display" center>
            KursWise
          </Text>
          <Text variant="body" color={colors.textSecondary} center>
            Технический анализ и новостной фон по валютным парам к тенге —
            прогноз направления и push, когда рынок двигается.
          </Text>
        </View>

        <Card style={styles.card}>
          <Text variant="title">Войти</Text>
          <Text variant="body" color={colors.textSecondary}>
            Нужно для push-уведомлений о прогнозах — без входа их некуда
            присылать.
          </Text>
          <AppleSignInCard />
          <GoogleSignInCard />
        </Card>

        <Disclaimer short center />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
  },
  intro: { gap: spacing.sm },
  card: { gap: spacing.sm },
});
