import { createRemoteJWKSet, jwtVerify } from "jose";
const JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

export async function verifyAppleIdToken(
  identityToken: string,
  env: { APPLE_BUNDLE_ID?: string } = process.env,
): Promise<{ sub: string; email: string | null; emailVerified: boolean }> {
  // Без aud jose НЕ проверяет audience вовсе — принял бы Apple id_token,
  // выпущенный для ЛЮБОГО приложения. Fail-closed: лучше отказать во входе,
  // чем принять чужой токен (зеркалит google.ts с GOOGLE_CLIENT_IDS).
  const audience = env.APPLE_BUNDLE_ID?.trim();
  if (!audience) {
    throw new Error("APPLE_BUNDLE_ID is not configured");
  }

  const { payload } = await jwtVerify(identityToken, JWKS, {
    issuer: "https://appleid.apple.com",
    audience,
  });
  if (!payload.sub) {
    throw new Error("Apple id_token missing sub claim");
  }

  return {
    sub: payload.sub,
    email: typeof payload.email === "string" ? payload.email : null,
    emailVerified:
      payload.email_verified === true || payload.email_verified === "true",
  };
}
