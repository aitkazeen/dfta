import Fastify, { type FastifyInstance } from "fastify";
import jwt from "@fastify/jwt";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "./jwt.js";

describe("jwt", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(jwt, { secret: "test-secret" });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("подписывает и проверяет refresh-токен", () => {
    const token = signRefreshToken(app, "user-1");
    expect(verifyRefreshToken(app, token)).toEqual({ sub: "user-1" });
  });

  it("access-токен нельзя использовать как refresh — регрессия на баг с payload.type", () => {
    const accessToken = signAccessToken(app, "user-1");
    expect(() => verifyRefreshToken(app, accessToken)).toThrow();
  });

  it("невалидный токен бросает, а не возвращает { sub: 'error' }", () => {
    expect(() => verifyRefreshToken(app, "not-a-real-token")).toThrow();
  });

  it("access-токен несёт правильный sub и истекает через 15 минут", () => {
    const token = signAccessToken(app, "user-1");
    const decoded = app.jwt.verify<{
      sub: string;
      type: string;
      exp: number;
      iat: number;
    }>(token);
    expect(decoded.sub).toBe("user-1");
    expect(decoded.type).toBe("access");
    expect(decoded.exp - decoded.iat).toBe(15 * 60);
  });
});
