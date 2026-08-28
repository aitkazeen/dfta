import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "./jwt.js";
import { requireAuth } from "./middleware.js";
import { verifyAppleIdToken } from "./verifiers/apple.js";
import { verifyGoogleIdToken } from "./verifiers/google.js";

type AuthRoutesDeps = {
  db: PrismaClient;
};

async function upsertUser(
  db: PrismaClient,
  provider: "apple" | "google",
  sub: string,
  email: string | null,
) {
  return db.appUser.upsert({
    where: { authProvider_authSub: { authProvider: provider, authSub: sub } },
    // Apple/Google отдают email только при первом входе — не затираем уже
    // сохранённый email значением null на повторных логинах.
    update: email ? { email } : {},
    create: { authProvider: provider, authSub: sub, email },
  });
}

export function authRoutes(deps: AuthRoutesDeps) {
  return async function (app: FastifyInstance) {
    app.post("/v1/auth/apple", async (req, reply) => {
      const { identityToken } = req.body as { identityToken?: string };
      if (!identityToken) {
        return reply.code(400).send({ error: "identityToken is required" });
      }

      let claims;
      try {
        claims = await verifyAppleIdToken(identityToken);
      } catch (err) {
        req.log.info({ err }, "auth: apple token rejected");
        return reply.code(401).send({ error: "invalid identityToken" });
      }

      const user = await upsertUser(deps.db, "apple", claims.sub, claims.email);
      return {
        accessToken: signAccessToken(app, user.id),
        refreshToken: signRefreshToken(app, user.id),
        user: { id: user.id, email: user.email },
      };
    });

    app.post("/v1/auth/google", async (req, reply) => {
      const { idToken } = req.body as { idToken?: string };
      if (!idToken) {
        return reply.code(400).send({ error: "idToken is required" });
      }

      let claims;
      try {
        claims = await verifyGoogleIdToken(idToken);
      } catch (err) {
        req.log.info({ err }, "auth: google token rejected");
        return reply.code(401).send({ error: "invalid idToken" });
      }

      const user = await upsertUser(
        deps.db,
        "google",
        claims.sub,
        claims.email,
      );
      return {
        accessToken: signAccessToken(app, user.id),
        refreshToken: signRefreshToken(app, user.id),
        user: { id: user.id, email: user.email },
      };
    });

    app.post("/v1/auth/refresh", async (req, reply) => {
      const { refreshToken } = req.body as { refreshToken?: string };
      if (!refreshToken) {
        return reply.code(400).send({ error: "refreshToken is required" });
      }

      let sub: string;
      try {
        ({ sub } = verifyRefreshToken(app, refreshToken));
      } catch (err) {
        req.log.info({ err }, "auth: refresh token rejected");
        return reply.code(401).send({ error: "invalid refreshToken" });
      }

      const user = await deps.db.appUser.findUnique({ where: { id: sub } });
      if (!user) {
        return reply.code(401).send({ error: "invalid refreshToken" });
      }

      // Ротация: каждый refresh выдаёт новую пару токенов, старый refresh
      // больше не переиспользуется клиентом (он его заменяет на новый).
      return {
        accessToken: signAccessToken(app, user.id),
        refreshToken: signRefreshToken(app, user.id),
      };
    });

    app.post(
      "/v1/me/devices",
      { preHandler: requireAuth },
      async (req, reply) => {
        const { token, platform } = req.body as {
          token?: string;
          platform?: string;
        };
        if (!token || (platform !== "ios" && platform !== "android")) {
          return reply.code(400).send({
            error: "token and platform ('ios'|'android') are required",
          });
        }

        // token уникален глобально (см. схему) — если один физический токен
        // переезжает на другого пользователя (переустановка, смена аккаунта
        // на том же устройстве), просто перепривязываем его.
        const device = await deps.db.deviceToken.upsert({
          where: { token },
          update: { userId: req.userId!, platform, lastSeenAt: new Date() },
          create: { userId: req.userId!, platform, token },
        });

        return { id: device.id };
      },
    );
  };
}
