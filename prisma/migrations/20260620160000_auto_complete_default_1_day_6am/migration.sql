-- AlterColumn defaults
ALTER TABLE "request_auto_complete_settings" ALTER COLUMN "cron_expression" SET DEFAULT '0 6 * * *';
ALTER TABLE "request_auto_complete_settings" ALTER COLUMN "duration_value" SET DEFAULT 1;

-- Atualiza registro padrão existente (instalações que ainda usam valores de fábrica)
UPDATE "request_auto_complete_settings"
SET
  "cron_expression" = '0 6 * * *',
  "duration_value" = 1,
  "duration_unit" = 'DAYS',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "id" = 'default';
