import type { PrismaClient } from "@prisma/client";
import { IndicatorSnapshot } from "../forecast/types";

export async function getLatestIndicators(
  db: PrismaClient,
  pairId: string,
  timeframe = "1d",
): Promise<IndicatorSnapshot> {
  const rows = await db.indicatorValue.findMany({
    where: { pairId, timeframe },
    orderBy: { ts: "desc" },
    distinct: ["name"],
  });
  return Object.fromEntries(
    rows.map((r) => [r.name, r.value.toNumber()]),
  ) as IndicatorSnapshot;
}
