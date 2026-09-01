import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { spacing, useTheme } from "../theme";
import { Text } from "./Text";
import { useAuthStore } from "../store/auth";

/**
 * Вход через Google на вебе (Apple Sign-In там физически недоступен, см.
 * AppleSignInCard). Google Identity Services (GIS) — официальный JS SDK
 * Google для веба: рисует свою кнопку в iframe и сам разруливает попап и
 * cookies, нам достаётся только id_token в колбэке. Никакого expo-auth-session
 * и dev-client не нужно — этот файл собирается только в веб-бандл (суффикс
 * .web.tsx, Metro подставляет его вместо GoogleSignInCard.tsx на вебе).
 *
 * EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID — Web client ID из Google Cloud Console
 * (OAuth consent screen -> Credentials -> Create OAuth client ID -> Web
 * application). Тот же ID должен быть в server/.env как один из
 * GOOGLE_CLIENT_IDS (через запятую) — иначе /v1/auth/google отклонит токен
 * с 401 (aud не совпадёт), см. server/src/modules/auth/verifiers/google.ts.
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>,
          ) => void;
        };
      };
    };
  }
}

const GSI_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

function loadGsiScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${GSI_SCRIPT_SRC}"]`,
  );
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("gsi script failed to load")),
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("gsi script failed to load"));
    document.head.appendChild(script);
  });
}

export function GoogleSignInCard() {
  const { colors } = useTheme();
  const containerRef = useRef<View>(null);
  const signInWithGoogleToken = useAuthStore((s) => s.signInWithGoogleToken);
  const [error, setError] = useState<string | null>(null);

  const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    loadGsiScript()
      .then(() => {
        // containerRef.current на react-native-web — реальный DOM-узел
        // (RNW форвардит ref на <div>), не RN-хендл measure().
        const node = containerRef.current as unknown as HTMLElement | null;
        if (cancelled || !window.google || !node) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            setError(null);
            signInWithGoogleToken(response.credential).catch(() => {
              setError("Не удалось войти через Google. Попробуй ещё раз.");
            });
          },
        });
        window.google.accounts.id.renderButton(node, {
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: "signin_with",
          width: 280,
        });
      })
      .catch(() => setError("Не удалось загрузить Google Sign-In."));

    return () => {
      cancelled = true;
    };
  }, [clientId, signInWithGoogleToken]);

  if (!clientId) {
    // Не сконфигурирован EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (см. .env.example) —
    // не показываем нерабочую кнопку, только Apple-фолбэк на этом экране
    // ("доступен только на iOS") останется единственным сообщением.
    return null;
  }

  return (
    <>
      <View ref={containerRef} style={{ marginTop: spacing.sm }} />
      {error && (
        <Text variant="label" color={colors.down}>
          {error}
        </Text>
      )}
    </>
  );
}
