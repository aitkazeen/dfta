-- DropIndex
DROP INDEX "candle_ts_idx";

-- CreateTable
CREATE TABLE "indicator_value" (
    "pair_id" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "timeframe" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DECIMAL(18,6) NOT NULL,

    CONSTRAINT "indicator_value_pkey" PRIMARY KEY ("pair_id","timeframe","ts","name")
);

-- AddForeignKey
ALTER TABLE "indicator_value" ADD CONSTRAINT "indicator_value_pair_id_fkey" FOREIGN KEY ("pair_id") REFERENCES "currency_pair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
