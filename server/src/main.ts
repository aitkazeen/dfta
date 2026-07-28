import Fastify from 'fastify'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const app = Fastify({ logger: true })

// Проверка живости — сюда стучится healthcheck и ты сам из браузера.
app.get('/health', async () => {
  return { ok: true, time: new Date().toISOString() }
})

// Единственный демонстрационный эндпоинт: считает записи в БД
// и возвращает их. Дальше пишешь свои роуты рядом.
app.get('/ping', async () => {
  const count = await db.ping.count()
  const created = await db.ping.create({ data: {} })
  return { message: 'pong', previousPings: count, id: created.id }
})

const port = Number(process.env.PORT ?? 3000)

// host: '0.0.0.0' обязателен внутри Docker.
// С дефолтным 127.0.0.1 сервер слушает только петлю внутри контейнера,
// и снаружи (с твоей машины, с телефона) он будет недоступен.
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err)
  process.exit(1)
})
