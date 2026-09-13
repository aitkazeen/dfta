import { Platform } from "react-native";
import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

// Флаг «онбординг пройден». Версия в ключе — чтобы при существенном изменении
// дисклеймеров/раскрытия ИИ можно было показать онбординг заново (bump ключа).
const ONBOARDED_KEY = "kurswise.onboardedV1";

// expo-secure-store на web — пустая заглушка (см. комментарий в store/auth.ts),
// поэтому там онбординг будет показываться каждый раз. Web у нас только для
// смоук-сборки, на iOS/Android флаг честно персистится.
const isWeb = Platform.OS === "web";

type OnboardingState = {
  /** "loading" — пока restore() не прочитал флаг; экран не рендерим (splash). */
  status: "loading" | "pending" | "done";
  /** Читается один раз при старте из app/_layout.tsx. */
  restore: () => Promise<void>;
  /** Вызывается по нажатию «Принимаю» — фиксирует согласие и персистит флаг. */
  complete: () => Promise<void>;
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  status: "loading",

  restore: async () => {
    if (isWeb) {
      set({ status: "pending" });
      return;
    }
    try {
      const seen = await SecureStore.getItemAsync(ONBOARDED_KEY);
      set({ status: seen ? "done" : "pending" });
    } catch {
      // Не смогли прочитать — показываем онбординг, это безопасный дефолт.
      set({ status: "pending" });
    }
  },

  complete: async () => {
    // Сразу пускаем дальше, персист — фоном: даже если запись не удастся,
    // пользователь не застрянет на онбординге в этой сессии.
    set({ status: "done" });
    if (isWeb) return;
    try {
      await SecureStore.setItemAsync(ONBOARDED_KEY, "1");
    } catch {
      // проглатываем — в худшем случае онбординг покажется ещё раз при перезапуске
    }
  },
}));
