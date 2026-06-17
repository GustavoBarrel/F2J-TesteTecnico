-- AlterTable
ALTER TABLE "sectors" ADD COLUMN     "OnlyManagerCanArchive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "onlyManagerCanEdit" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "onlyManagerCanView" BOOLEAN NOT NULL DEFAULT true;
