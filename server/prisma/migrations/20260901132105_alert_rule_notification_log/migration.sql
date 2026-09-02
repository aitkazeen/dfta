-- CreateTable
CREATE TABLE "alert_rule" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "pair_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "quiet_hours" JSONB,

    CONSTRAINT "alert_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rule_id" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "notification_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alert_rule_user_id_idx" ON "alert_rule"("user_id");

-- CreateIndex
CREATE INDEX "notification_log_user_id_idx" ON "notification_log"("user_id");

-- CreateIndex
CREATE INDEX "notification_log_rule_id_idx" ON "notification_log"("rule_id");

-- AddForeignKey
ALTER TABLE "alert_rule" ADD CONSTRAINT "alert_rule_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rule" ADD CONSTRAINT "alert_rule_pair_id_fkey" FOREIGN KEY ("pair_id") REFERENCES "currency_pair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "alert_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
