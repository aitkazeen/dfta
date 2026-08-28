import type { FastifyReply, FastifyRequest } from "fastify";
import type { AccessTokenPayload } from "./jwt.js";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}

// preHandler для защищённых роутов. request.jwtVerify() сам читает
// "Authorization: Bearer <token>", проверяет подпись и exp; здесь только
// докидываем проверку type: "access" — иначе refresh-токен (тоже валидно
// подписанный этим же секретом) можно было бы использовать как access.
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const payload = await request.jwtVerify<AccessTokenPayload>();
    if (payload.type !== "access") {
      throw new Error("expected an access token");
    }
    request.userId = payload.sub;
  } catch (err) {
    request.log.info({ err }, "auth: rejected request");
    await reply.code(401).send({ error: "unauthorized" });
  }
}
