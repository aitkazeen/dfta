import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerDevice } from "../api";
import { useAuthStore } from "../store/auth";

/**
 * Push-уведомления (этап 5, §7). Единственный внешний канал доставки ценности.
 *
 * Пуш физически работает только на реальном устройстве в собранном приложении
 * (dev-build / EAS Build) — не в симуляторе и не в Expo Go (в SDK 53+ remote
 * push из Expo Go убран). Поэтому весь код здесь оборонительный: на web и
 * симуляторе он тихо ничего не делает, а не падает.
 */

// Как показывать уведомление, пришедшее пока приложение открыто. Без этого
// foreground-пуши молча проглатываются системой.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Запрашивает разрешение и возвращает Expo push-токен ("ExponentPushToken[…]"),
 * или null, если пуш недоступен (симулятор/web) либо пользователь отказал.
 */
export async function registerForPushNotificationsAsync(): Promise<
  string | null
> {
  // isDevice === false на симуляторе и в браузере — токен там не выдаётся.
  if (!Device.isDevice) return null;

  // Android требует канал, иначе heads-up уведомления не показываются.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Уведомления",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== "granted") {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== "granted") return null;

  // projectId нужен getExpoPushTokenAsync, чтобы токен маршрутизировался в наш
  // проект. Берём из app.json (extra.eas.projectId) — он там уже прописан.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants.easConfig as { projectId?: string } | undefined)?.projectId;
  if (!projectId) return null;

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

/**
 * Полный цикл: получить токен и зарегистрировать его на бэкенде
 * (POST /v1/me/devices через callAuthorized). Зовётся из app/_layout.tsx,
 * когда пользователь вошёл. Ошибки не пробрасывает — отсутствие пуша не должно
 * ломать вход в приложение.
 */
export async function syncPushToken(): Promise<void> {
  try {
    const token = await registerForPushNotificationsAsync();
    if (!token) return;

    // Бэкенд принимает "ios" | "android"; web сюда не дойдёт (isDevice=false).
    const platform = Platform.OS === "android" ? "android" : "ios";
    await useAuthStore
      .getState()
      .callAuthorized((accessToken) =>
        registerDevice(accessToken, token, platform),
      );
  } catch (err) {
    console.warn("[push] не удалось зарегистрировать push-токен", err);
  }
}
