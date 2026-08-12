import fs from 'fs';
import path from 'node:path'
const IN_PATH = path.resolve(import.meta.dirname, '../data/nbk-rates-2y.csv')

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()


async function main() {
    const raw = fs.readFileSync(IN_PATH, 'utf-8').trim()
    const [header, ...lines] = raw.split('\n')
    const rows = lines.map((line) => {
        const [date, usdKzt, eurKzt, rubKzt] = line.split(',')
        return { date, usdKzt: Number(usdKzt), eurKzt: Number(eurKzt), rubKzt: Number(rubKzt) }
    })

    const PAIRS = [
        { pairId: 'USD-KZT', key: 'usdKzt' as const },
        { pairId: 'EUR-KZT', key: 'eurKzt' as const },
        { pairId: 'RUB-KZT', key: 'rubKzt' as const },
    ]

    for (const row of rows) {
        const ts = new Date(`${row.date}T00:00:00.000Z`) // UTC-полночь, как у worker.ts (см. `today` в upsertDailyCandle)

        for (const { pairId, key } of PAIRS) {
            const rate = row[key]
            await db.candle.upsert({
                where: { pairId_timeframe_ts: { pairId, timeframe: '1d', ts } },
                create: { pairId, timeframe: '1d', ts, open: rate, high: rate, low: rate, close: rate, source: 'nbk' },
                update: { open: rate, high: rate, low: rate, close: rate, source: 'nbk' },
            })
        }
    }
    await db.$disconnect()
    console.log("Done")
}
main()