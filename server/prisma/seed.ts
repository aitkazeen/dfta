/**
 * Справочники MVP: 4 валюты + ровно 3 одобренных пары (§1 CLAUDE.md —
 * KZT центральная, только X/KZT). Идемпотентно — upsert, безопасно
 * перезапускать.
 *
 * Запуск: npm run db:seed   (из server/)
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const currencies = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
  { code: 'KZT', name: 'Kazakhstani Tenge', symbol: '₸' },
]

const pairs = [
  { id: 'USD-KZT', baseCode: 'USD', quoteCode: 'KZT', displayName: 'USD/KZT', priority: 1 },
  { id: 'EUR-KZT', baseCode: 'EUR', quoteCode: 'KZT', displayName: 'EUR/KZT', priority: 2 },
  { id: 'RUB-KZT', baseCode: 'RUB', quoteCode: 'KZT', displayName: 'RUB/KZT', priority: 3 },
]

async function main() {
  for (const c of currencies) {
    await db.currency.upsert({ where: { code: c.code }, update: c, create: c })
  }
  for (const p of pairs) {
    await db.currencyPair.upsert({ where: { id: p.id }, update: p, create: p })
  }
  console.log(`Готово: ${currencies.length} валют, ${pairs.length} пар.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
