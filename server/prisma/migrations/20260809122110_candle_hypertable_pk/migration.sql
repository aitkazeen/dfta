-- CreateTable
CREATE TABLE "currency" (
    "code" CHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "currency_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "currency_pair" (
    "id" VARCHAR(15) NOT NULL,
    "base_code" CHAR(3) NOT NULL,
    "quote_code" CHAR(3) NOT NULL,
    "display_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "currency_pair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candle" (
    "pair_id" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "timeframe" TEXT NOT NULL,
    "open" DECIMAL(18,6) NOT NULL,
    "high" DECIMAL(18,6) NOT NULL,
    "low" DECIMAL(18,6) NOT NULL,
    "close" DECIMAL(18,6) NOT NULL,
    "source" TEXT NOT NULL,

    CONSTRAINT "candle_pkey" PRIMARY KEY ("pair_id","timeframe","ts")
);

-- CreateIndex
CREATE UNIQUE INDEX "currency_pair_base_code_quote_code_key" ON "currency_pair"("base_code", "quote_code");

-- AddForeignKey
ALTER TABLE "currency_pair" ADD CONSTRAINT "currency_pair_base_code_fkey" FOREIGN KEY ("base_code") REFERENCES "currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "currency_pair" ADD CONSTRAINT "currency_pair_quote_code_fkey" FOREIGN KEY ("quote_code") REFERENCES "currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candle" ADD CONSTRAINT "candle_pair_id_fkey" FOREIGN KEY ("pair_id") REFERENCES "currency_pair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE EXTENSION IF NOT EXISTS timescaledb;
SELECT create_hypertable('candle', 'ts', migrate_data => true);