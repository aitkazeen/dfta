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

// Держим splash, пока не загрузятся шрифты — иначе первый кадр
// отрисуется системным шрифтом и «прыгнет» на Inter.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

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
      />
    </SafeAreaProvider>
  );
}
