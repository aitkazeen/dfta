import Constants from "expo-constants";
import { Platform } from "react-native";

export type ApiPair = {
  id: string;
  base: string;
  quote: string;
  displayName: string;
};
export type ApiQuote = {
  id: string;
  base: string;
  quote: string;
  rate: number;
  asOf: string;
  source: string;
};
export type ApiCandle = {
  ts: string;
  o: number;
  h: number;
  l: number;
  c: number;
};
export type ApiIndicators = Record<string, { value: string; ts: string }>;
export type ApiForecast = {
  pairId: string;
  horizon: string;
  direction: "up" | "down" | "flat";
  confidence: number; // 0..1 — на фронте (types.ts Forecast.confidence) шкала 0..100
  targetLow: number;
  targetHigh: number;
  engineVersion: string;
  createdAt: string;
  explanation: string | null; // LLM-шаг ещё не подключён (этап 4, позже)
  drivers: unknown | null; // то же самое
};
/** Одна статья по паре — см. server/src/modules/news/routes.ts. sentiment
 *  null, если ни у источника, ни у LLM-классификатора не нашлось значения
 *  (см. CLAUDE.md, запись 2026-08-23 про no-op-фабрики). */
export type ApiNewsArticle = {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment: number | null;
  impactScore: number;
};
export type ApiForecastHistory = {
  pairId: string;
  horizon: string;
  windowDays: number;
  total: number;
  hitRatePct: number;
  outcomes: boolean[];
  trend: { predicted: number[]; actual: number[] };
};

/**
 * Самая частая проблема новичка: приложение не видит бэкенд.
 * Причина в том, что "localhost" внутри телефона или эмулятора
 * означает сам телефон, а не твой компьютер.
 *
 * Правильные адреса:
 *   реальный телефон      -> IP компьютера в Wi-Fi, напр. 192.168.1.15
 *   Android эмулятор      -> 10.0.2.2 (спец-алиас для хоста)
 *   iOS симулятор         -> localhost работает, он делит сеть с macOS
 *
 * Ниже адрес вычисляется сам. Expo знает, с какого IP отдаётся
 * бандл (hostUri вида "192.168.1.15:8081") — берём оттуда хост
 * и подставляем свой порт.
 */
function resolveHost(): string {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)
      ?.debuggerHost;

  if (hostUri) {
    const host = hostUri.split(":")[0];
    // В Android-эмуляторе Expo иногда отдаёт localhost — подменяем.
    if (host === "localhost" || host === "127.0.0.1") {
      return Platform.OS === "android" ? "10.0.2.2" : "localhost";
    }
    return host;
  }

  return Platform.OS === "android" ? "10.0.2.2" : "localhost";
}

export const API_URL = `http://${resolveHost()}:3000`;

/** Отличает 401 (протух/невалиден токен, есть смысл рефрешить) от прочих
 *  сетевых ошибок — на нём строится retry-on-401 в useAuthStore. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    throw new ApiError(res.status, `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

function post<T>(
  path: string,
  body: unknown,
  accessToken?: string,
): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

export async function api<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function getPairs(): Promise<ApiPair[]> {
  return api<ApiPair[]>("/v1/pairs");
}

export function getQuote(id: string): Promise<ApiQuote> {
  return api<ApiQuote>(`/v1/pairs/${id}/quote`);
}

/** Пока только дневные свечи — см. GET /v1/pairs/:id/candles на бэкенде. */
export function getCandles(id: string, limit = 30): Promise<ApiCandle[]> {
  return api<ApiCandle[]>(`/v1/pairs/${id}/candles?limit=${limit}`);
}

export function getIndicators(id: string): Promise<ApiIndicators> {
  return api<ApiIndicators>(`/v1/pairs/${id}/indicators`);
}

/** 404, пока воркер не сгенерировал первый прогноз для пары — это ожидаемо,
 *  не ошибка; вызывающая сторона сама решает, чем заполнить состояние. */
export function getForecast(id: string): Promise<ApiForecast> {
  return api<ApiForecast>(`/v1/pairs/${id}/forecast`);
}

export function getForecastHistory(id: string): Promise<ApiForecastHistory> {
  return api<ApiForecastHistory>(`/v1/pairs/${id}/forecast/history`);
}

export function getNews(id: string, limit = 20): Promise<ApiNewsArticle[]> {
  return api<ApiNewsArticle[]>(`/v1/pairs/${id}/news?limit=${limit}`);
}

// --- Auth (этап 5, см. server/src/modules/auth/routes.ts) ---

export type ApiAuthUser = { id: string; email: string | null };
export type ApiAuthTokens = { accessToken: string; refreshToken: string };

/** identityToken — из AppleAuthentication.signInAsync() на клиенте. */
export function signInWithApple(
  identityToken: string,
): Promise<ApiAuthTokens & { user: ApiAuthUser }> {
  return post("/v1/auth/apple", { identityToken });
}

/** idToken — credential из Google Identity Services (см. GoogleSignInCard.web.tsx).
 *  Поле называется idToken, не identityToken — так его ждёт /v1/auth/google
 *  (server/src/modules/auth/routes.ts). */
export function signInWithGoogle(
  idToken: string,
): Promise<ApiAuthTokens & { user: ApiAuthUser }> {
  return post("/v1/auth/google", { idToken });
}

export function refreshTokens(refreshToken: string): Promise<ApiAuthTokens> {
  return post("/v1/auth/refresh", { refreshToken });
}

/** Защищённый роут — требует access-токен. platform всегда "ios" в первом
 *  релизе (см. project_stage5_ios_only), но бэкенд принимает и "android". */
export function registerDevice(
  accessToken: string,
  deviceToken: string,
  platform: "ios" | "android",
): Promise<{ id: string }> {
  return post("/v1/me/devices", { token: deviceToken, platform }, accessToken);
}

/** Удаление аккаунта и всех связанных данных (App Store 5.1.1(v) / Google
 *  Play). Бэкенд отдаёт 204 без тела — не гоняем через request(). */
export async function deleteAccount(accessToken: string): Promise<void> {
  const res = await fetch(`${API_URL}/v1/me`, {
    method: "DELETE",
    headers: authHeader(accessToken),
  });
  if (!res.ok) {
    throw new ApiError(res.status, `${res.status} ${res.statusText}`);
  }
}

// --- Алерты (этап 5, см. server/src/modules/notifications/routes.ts) ---

/** 4 типа триггеров из roadmap §7. Форма params зависит от type — см.
 *  checkThresholdTrigger/… в server/.../notifications/evaluate.ts:
 *    daily      -> {}                                (утренний прогноз)
 *    threshold  -> { value: number; direction: "above" | "below" }
 *    movement   -> { atrMultiplier?: number }        (по умолчанию 2×ATR)
 *    news       -> { minImpactScore: number }        */
export type AlertType = "daily" | "threshold" | "movement" | "news";

/** "HH:mm" в tz пользователя (app_user.tz). null — без тихих часов. */
export type QuietHours = { start: string; end: string };

export type ApiAlertRule = {
  id: string;
  pairId: string;
  type: AlertType;
  params: Record<string, unknown>;
  quietHours: QuietHours | null;
  isActive: boolean;
};

export type CreateAlertInput = {
  pairId: string;
  type: AlertType;
  params: Record<string, unknown>;
  quietHours?: QuietHours | null;
};

export type UpdateAlertInput = {
  isActive?: boolean;
  params?: Record<string, unknown>;
  quietHours?: QuietHours | null;
};

function authHeader(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

export function getAlerts(accessToken: string): Promise<ApiAlertRule[]> {
  return request<ApiAlertRule[]>("/v1/me/alerts", {
    headers: authHeader(accessToken),
  });
}

export function createAlert(
  accessToken: string,
  input: CreateAlertInput,
): Promise<ApiAlertRule> {
  return post<ApiAlertRule>("/v1/me/alerts", input, accessToken);
}

export function updateAlert(
  accessToken: string,
  id: string,
  patch: UpdateAlertInput,
): Promise<ApiAlertRule> {
  return request<ApiAlertRule>(`/v1/me/alerts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeader(accessToken) },
    body: JSON.stringify(patch),
  });
}

/** DELETE отдаёт 204 без тела — не гоняем через request(), тот всегда
 *  делает res.json() и упал бы на пустом ответе. */
export async function deleteAlert(
  accessToken: string,
  id: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/v1/me/alerts/${id}`, {
    method: "DELETE",
    headers: authHeader(accessToken),
  });
  if (!res.ok) {
    throw new ApiError(res.status, `${res.status} ${res.statusText}`);
  }
}
