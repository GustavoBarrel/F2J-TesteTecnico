/*
  Warnings:

  - You are about to drop the column `OnlyManagerCanArchive` on the `sectors` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "sectors" DROP COLUMN "OnlyManagerCanArchive",
ADD COLUMN     "onlyManagerCanArchive" BOOLEAN NOT NULL DEFAULT true;
