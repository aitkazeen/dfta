import type { FastifyInstance } from "fastify";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "30d";

export type AccessTokenPayload = { sub: string; type: "access" };
export type RefreshTokenPayload = { sub: string; type: "refresh" };

export function signAccessToken(app: FastifyInstance, userId: string): string {
  return app.jwt.sign(
    { sub: userId, type: "access" },
    { expiresIn: ACCESS_TOKEN_TTL },
  );
}

export function signRefreshToken(app: FastifyInstance, userId: string): string {
  return app.jwt.sign(
    { sub: userId, type: "refresh" },
    { expiresIn: REFRESH_TOKEN_TTL },
  );
}

export function verifyRefreshToken(
  app: FastifyInstance,
  token: string,
): { sub: string } {
  const payload = app.jwt.verify<RefreshTokenPayload>(token);

  if (payload.type !== "refresh") {
    throw new Error("expected a refresh token");
  }

  return { sub: payload.sub };
}
