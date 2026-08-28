import Fastify from "fastify";

import cors from "@fastify/cors";
import jwt from "@fastify/jwt";

import { PrismaClient } from "@prisma/client";
import { createQuoteProvider } from "./modules/market/quote-provider.factory.js";
import { marketRoutes } from "./modules/market/routes.js";
import { forecastRoutes } from "./modules/forecast/routes.js";
import { newsRoutes } from "./modules/news/routes.js";
import { authRoutes } from "./modules/auth/routes.js";

const db = new PrismaClient();
const app = Fastify({ logger: true });

// Проверка живости — сюда стучится healthcheck и ты сам из браузера.
app.get("/health", async () => {
  return { ok: true, time: new Date().toISOString() };
});

await app.register(cors, { origin: true });

// В отличие от GEMINI_API_KEY/ANTHROPIC_API_KEY это не опциональный
// провайдер с no-op фолбэком — без секрета подписывать токены нечем,
// падаем сразу при старте, а не на первом логине.
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not set");
}
await app.register(jwt, { secret: process.env.JWT_SECRET });

const quoteProvider = createQuoteProvider(process.env, app.log);
await app.register(marketRoutes({ db, quoteProvider }));
await app.register(forecastRoutes({ db }));
await app.register(newsRoutes({ db }));
await app.register(authRoutes({ db }));

const port = Number(process.env.PORT ?? 3000);

// host: '0.0.0.0' обязателен внутри Docker.
// С дефолтным 127.0.0.1 сервер слушает только петлю внутри контейнера,
// и снаружи (с твоей машины, с телефона) он будет недоступен.
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
