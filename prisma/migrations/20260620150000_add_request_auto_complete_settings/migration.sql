-- CreateEnum
CREATE TYPE "AutoCompleteDurationUnit" AS ENUM ('MINUTES', 'DAYS');

-- CreateTable
CREATE TABLE "request_auto_complete_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "cron_expression" TEXT NOT NULL DEFAULT '0 3 * * *',
    "duration_value" INTEGER NOT NULL DEFAULT 7,
    "duration_unit" "AutoCompleteDurationUnit" NOT NULL DEFAULT 'DAYS',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" TEXT,

    CONSTRAINT "request_auto_complete_settings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "request_auto_complete_settings" ADD CONSTRAINT "request_auto_complete_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default row
INSERT INTO "request_auto_complete_settings" ("id", "cron_expression", "duration_value", "duration_unit", "updated_at")
VALUES ('default', '0 3 * * *', 7, 'DAYS', CURRENT_TIMESTAMP);
