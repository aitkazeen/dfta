import { useEffect } from "react";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { syncPushToken } from "../src/lib/push";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { darkColors } from "../src/theme";
import { useAuthStore } from "../src/store/auth";
import { useOnboardingStore } from "../src/store/onboarding";

// Держим splash, пока не загрузятся шрифты и не восстановится сессия —
// иначе экран "Ещё" на миг покажет кнопку входа перед тем, как узнает,
// что пользователь уже залогинен (restore() дергает /v1/auth/refresh).
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const authStatus = useAuthStore((s) => s.status);
  const restoreAuth = useAuthStore((s) => s.restore);
  const onboardingStatus = useOnboardingStore((s) => s.status);
  const restoreOnboarding = useOnboardingStore((s) => s.restore);

  useEffect(() => {
    restoreAuth();
    restoreOnboarding();
  }, [restoreAuth, restoreOnboarding]);

  const ready =
    fontsLoaded && authStatus !== "loading" && onboardingStatus !== "loading";

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Как только пользователь вошёл — регистрируем push-токен устройства на
  // бэкенде (иначе воркеру некуда слать уведомления). Идемпотентно: сервер
  // делает upsert по токену (см. /v1/me/devices).
  useEffect(() => {
    if (authStatus === "signedIn") void syncPushToken();
  }, [authStatus]);

  // Тап по уведомлению открывает экран пары. pairId кладёт бэкенд в data
  // (см. notifications/evaluate.ts:buildPayload).
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as {
          pairId?: string;
        };
        if (data?.pairId) {
          router.push({
            pathname: "/pairs/[id]",
            params: { id: data.pairId },
          });
        }
      },
    );
    return () => sub.remove();
  }, []);

  if (!ready) return null;

  // Онбординг — самый внешний гейт: до принятия дисклеймеров/раскрытия ИИ
  // (roadmap §8) не пускаем ни на login, ни в (tabs), независимо от сессии.
  const showOnboarding = onboardingStatus !== "done";
  const isSignedIn = authStatus === "signedIn";

  return (
    <SafeAreaProvider>
      {/* Светлый контент статус-бара поверх тёмного фона */}
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          // У экранов свои шапки (sticky-хедер пары), системную прячем.
          headerShown: false,
          contentStyle: { backgroundColor: darkColors.bgBase },
        }}
      >
        <Stack.Protected guard={showOnboarding}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>

        <Stack.Protected guard={!showOnboarding && !isSignedIn}>
          <Stack.Screen name="login" />
        </Stack.Protected>

        <Stack.Protected guard={!showOnboarding && isSignedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="pairs/[id]" />
          <Stack.Screen name="pairs/[id]/forecast" />
        </Stack.Protected>
      </Stack>
    </SafeAreaProvider>
  );
}
