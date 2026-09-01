import { useState } from "react";
import { Platform, StyleSheet } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { spacing, useTheme } from "../theme";
import { Text } from "./Text";
import { useAuthStore } from "../store/auth";

/** Кнопка входа через Apple + обработка ошибок. Используется и на
 *  app/login.tsx, и на вкладке "Ещё" (защитный фолбэк, см. more.tsx). */
export function AppleSignInCard() {
  const { colors } = useTheme();
  const signInWithAppleToken = useAuthStore((s) => s.signInWithAppleToken);
  const [error, setError] = useState<string | null>(null);

  async function handlePress() {
    setError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error("Apple не вернул identityToken");
      }
      await signInWithAppleToken(credential.identityToken);
    } catch (err) {
      // ERR_REQUEST_CANCELED — пользователь просто закрыл системный лист,
      // это не ошибка, не показываем её.
      const code = (err as { code?: string })?.code;
      if (code === "ERR_REQUEST_CANCELED") return;
      setError("Не удалось войти через Apple. Попробуй ещё раз.");
    }
  }

  return (
    <>
      {Platform.OS === "ios" ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={12}
          style={styles.button}
          onPress={handlePress}
        />
      ) : (
        <Text variant="body" color={colors.textTertiary}>
          Вход через Apple доступен только на iOS.
        </Text>
      )}
      {error && (
        <Text variant="label" color={colors.down}>
          {error}
        </Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  button: { width: "100%", height: 44, marginTop: spacing.sm },
});
