-- CreateTable
CREATE TABLE "forecast" (
    "id" TEXT NOT NULL,
    "pair_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horizon" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "confidence" DECIMAL(18,6) NOT NULL,
    "target_low" DECIMAL(18,6) NOT NULL,
    "target_high" DECIMAL(18,6) NOT NULL,
    "engine_version" TEXT NOT NULL,
    "features" JSONB NOT NULL,
    "explanation" TEXT,
    "drivers" JSONB,

    CONSTRAINT "forecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecast_outcome" (
    "forecast_id" TEXT NOT NULL,
    "resolved_at" TIMESTAMP(3) NOT NULL,
    "actual_close" DECIMAL(18,6) NOT NULL,
    "was_correct" BOOLEAN NOT NULL,
    "abs_error" DECIMAL(18,6) NOT NULL,

    CONSTRAINT "forecast_outcome_pkey" PRIMARY KEY ("forecast_id")
);

-- AddForeignKey
ALTER TABLE "forecast" ADD CONSTRAINT "forecast_pair_id_fkey" FOREIGN KEY ("pair_id") REFERENCES "currency_pair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_outcome" ADD CONSTRAINT "forecast_outcome_forecast_id_fkey" FOREIGN KEY ("forecast_id") REFERENCES "forecast"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
