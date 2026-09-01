import { Platform } from "react-native";
import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import {
  ApiError,
  refreshTokens,
  signInWithApple,
  signInWithGoogle,
  type ApiAuthUser,
} from "../api";

const ACCESS_TOKEN_KEY = "kurswise.accessToken";
const REFRESH_TOKEN_KEY = "kurswise.refreshToken";

// expo-secure-store не реализован на вебе (пустая заглушка в самом пакете,
// см. node_modules/expo-secure-store/src/ExpoSecureStore.web.ts) — вызов
// любого метода там бросает "is not a function". Приложение целится в
// iOS/Android (CLAUDE.md), web используется только для быстрой сборки-смоука,
// поэтому на вебе просто ведём себя как "сессии нет", а не падаем.
const isWeb = Platform.OS === "web";

async function getSecureItem(key: string): Promise<string | null> {
  if (isWeb) return null;
  return SecureStore.getItemAsync(key);
}

async function setSecureItem(key: string, value: string): Promise<void> {
  if (isWeb) return;
  await SecureStore.setItemAsync(key, value);
}

async function deleteSecureItem(key: string): Promise<void> {
  if (isWeb) return;
  await SecureStore.deleteItemAsync(key);
}

async function persistTokens(accessToken: string, refreshToken: string) {
  await setSecureItem(ACCESS_TOKEN_KEY, accessToken);
  await setSecureItem(REFRESH_TOKEN_KEY, refreshToken);
}

async function clearTokens() {
  await deleteSecureItem(ACCESS_TOKEN_KEY);
  await deleteSecureItem(REFRESH_TOKEN_KEY);
}

type AuthState = {
  /** "loading" — сразу после старта приложения, пока restore() не отработал.
   *  Экраны, которым нужен статус входа, должны ждать его, а не signedOut. */
  status: "loading" | "signedOut" | "signedIn";
  accessToken: string | null;
  refreshToken: string | null;
  user: ApiAuthUser | null;

  /** Зовётся один раз из app/_layout.tsx при старте: читает токены из
   *  SecureStore и сразу их обновляет — access живёт всего 15 мин, за время,
   *  пока приложение было закрыто, он почти наверняка протух. */
  restore: () => Promise<void>;
  signInWithAppleToken: (identityToken: string) => Promise<void>;
  signInWithGoogleToken: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;

  /**
   * Обёртка для одного защищённого запроса: подставляет текущий access,
   * при 401 обновляет пару токенов один раз и повторяет вызов. Использовать
   * для любого будущего запроса к /v1/me/* (пример — registerDevice).
   *
   *   await useAuthStore.getState().callAuthorized((token) =>
   *     registerDevice(token, pushToken, "ios"),
   *   );
   */
  callAuthorized: <T>(fn: (accessToken: string) => Promise<T>) => Promise<T>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "loading",
  accessToken: null,
  refreshToken: null,
  user: null,

  restore: async () => {
    const storedRefreshToken = await getSecureItem(REFRESH_TOKEN_KEY);
    if (!storedRefreshToken) {
      set({ status: "signedOut" });
      return;
    }

    try {
      const tokens = await refreshTokens(storedRefreshToken);
      await persistTokens(tokens.accessToken, tokens.refreshToken);
      set({
        status: "signedIn",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    } catch {
      // refresh просрочен (>30 дней) или отозван — считаем разлогиненным,
      // не показываем ошибку, это ожидаемый путь.
      await clearTokens();
      set({ status: "signedOut", accessToken: null, refreshToken: null });
    }
  },

  signInWithAppleToken: async (identityToken) => {
    const result = await signInWithApple(identityToken);
    await persistTokens(result.accessToken, result.refreshToken);
    set({
      status: "signedIn",
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  },

  signInWithGoogleToken: async (idToken) => {
    const result = await signInWithGoogle(idToken);
    await persistTokens(result.accessToken, result.refreshToken);
    set({
      status: "signedIn",
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  },

  signOut: async () => {
    await clearTokens();
    set({
      status: "signedOut",
      accessToken: null,
      refreshToken: null,
      user: null,
    });
  },

  callAuthorized: async (fn) => {
    const { accessToken, refreshToken: currentRefreshToken } = get();
    if (!accessToken) {
      throw new Error("callAuthorized: not signed in");
    }

    try {
      return await fn(accessToken);
    } catch (err) {
      const isExpired = err instanceof ApiError && err.status === 401;
      if (!isExpired || !currentRefreshToken) {
        throw err;
      }

      const tokens = await refreshTokens(currentRefreshToken);
      await persistTokens(tokens.accessToken, tokens.refreshToken);
      set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });

      // Один повтор — если и он словит 401, значит проблема не в
      // протухшем токене, поднимаем ошибку дальше как есть.
      return fn(tokens.accessToken);
    }
  },
}));
