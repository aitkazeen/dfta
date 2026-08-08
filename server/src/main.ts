import Fastify from 'fastify'
import { PrismaClient } from '@prisma/client'
import { createQuoteProvider } from './modules/market/quote-provider.factory.js'
import { marketRoutes } from './modules/market/routes.js'

const db = new PrismaClient()
const app = Fastify({ logger: true })

// Проверка живости — сюда стучится healthcheck и ты сам из браузера.
app.get('/health', async () => {
  return { ok: true, time: new Date().toISOString() }
})

const quoteProvider = createQuoteProvider(process.env, app.log)
await app.register(marketRoutes({ db, quoteProvider }))

const port = Number(process.env.PORT ?? 3000)

// host: '0.0.0.0' обязателен внутри Docker.
// С дефолтным 127.0.0.1 сервер слушает только петлю внутри контейнера,
// и снаружи (с твоей машины, с телефона) он будет недоступен.
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err)
  process.exit(1)
})
