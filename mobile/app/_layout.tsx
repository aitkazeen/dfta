import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { darkColors } from "../src/theme";
import { useAuthStore } from "../src/store/auth";

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

  useEffect(() => {
    restoreAuth();
  }, [restoreAuth]);

  useEffect(() => {
    if (fontsLoaded && authStatus !== "loading") SplashScreen.hideAsync();
  }, [fontsLoaded, authStatus]);

  if (!fontsLoaded || authStatus === "loading") return null;

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
        <Stack.Protected guard={!isSignedIn}>
          <Stack.Screen name="login" />
        </Stack.Protected>

        <Stack.Protected guard={isSignedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="pairs/[id]" />
          <Stack.Screen name="pairs/[id]/forecast" />
        </Stack.Protected>
      </Stack>
    </SafeAreaProvider>
  );
}
