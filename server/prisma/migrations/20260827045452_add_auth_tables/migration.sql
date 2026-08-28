-- CreateTable
CREATE TABLE "app_user" (
    "id" TEXT NOT NULL,
    "auth_provider" TEXT NOT NULL,
    "auth_sub" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tz" TEXT NOT NULL DEFAULT 'Asia/Almaty',
    "locale" TEXT NOT NULL DEFAULT 'ru',
    "plan" TEXT NOT NULL DEFAULT 'free',

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_token" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_user_auth_provider_auth_sub_key" ON "app_user"("auth_provider", "auth_sub");

-- CreateIndex
CREATE UNIQUE INDEX "device_token_token_key" ON "device_token"("token");

-- CreateIndex
CREATE INDEX "device_token_user_id_idx" ON "device_token"("user_id");

-- AddForeignKey
ALTER TABLE "device_token" ADD CONSTRAINT "device_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
