/*
  Warnings:

  - The values [SUPER_ADMIN] on the enum `RoleSlug` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `username` on the `users` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "RoleSlug_new" AS ENUM ('MANAGER', 'TECHNICIAN');
ALTER TABLE "roles" ALTER COLUMN "slug" TYPE "RoleSlug_new" USING ("slug"::text::"RoleSlug_new");
ALTER TYPE "RoleSlug" RENAME TO "RoleSlug_old";
ALTER TYPE "RoleSlug_new" RENAME TO "RoleSlug";
DROP TYPE "public"."RoleSlug_old";
COMMIT;

-- DropIndex
DROP INDEX "users_username_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "username";
