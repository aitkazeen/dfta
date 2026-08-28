import { createRemoteJWKSet, jwtVerify } from "jose";
const JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

export async function verifyAppleIdToken(
  identityToken: string,
  env: { APPLE_BUNDLE_ID?: string } = process.env,
): Promise<{ sub: string; email: string | null; emailVerified: boolean }> {
  const { payload } = await jwtVerify(identityToken, JWKS, {
    issuer: "https://appleid.apple.com",
    audience: env.APPLE_BUNDLE_ID,
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
