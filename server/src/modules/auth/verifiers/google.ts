import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

export async function verifyGoogleIdToken(
  idToken: string,
  env: { GOOGLE_CLIENT_IDS?: string } = process.env,
): Promise<{ sub: string; email: string | null; emailVerified: boolean }> {
  // Несколько допустимых aud сразу: iOS + Android + Web client ID из одного
  // Google Cloud проекта. Первый релиз iOS-only (см. project_stage5_ios_only),
  // но поле уже список — Android/Web client ID добавляются без переделок.
  const audience = (env.GOOGLE_CLIENT_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (audience.length === 0) {
    throw new Error("GOOGLE_CLIENT_IDS is not configured");
  }

  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience,
  });

  if (!payload.sub) {
    throw new Error("Google id_token missing sub claim");
  }

  return {
    sub: payload.sub,
    email: typeof payload.email === "string" ? payload.email : null,
    emailVerified: payload.email_verified === true,
  };
}
