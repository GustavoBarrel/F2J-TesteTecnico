-- Add username column and backfill existing users before enforcing NOT NULL + UNIQUE

ALTER TABLE "users" ADD COLUMN "username" TEXT;

UPDATE "users"
SET "username" = 'admin'
WHERE "email" = 'admin@servicehub.com';

UPDATE "users"
SET "username" = split_part("email", '@', 1)
WHERE "username" IS NULL;

ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
