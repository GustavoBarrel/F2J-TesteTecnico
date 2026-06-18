/*
  Warnings:

  - You are about to drop the column `assigned_to_id` on the `requests` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "requests" DROP CONSTRAINT "requests_assigned_to_id_fkey";

-- DropIndex
DROP INDEX "requests_assigned_to_id_idx";

-- AlterTable
ALTER TABLE "requests" DROP COLUMN "assigned_to_id";

-- CreateTable
CREATE TABLE "request_assignees" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_observers" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_observers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_assignees_user_id_idx" ON "request_assignees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "request_assignees_request_id_user_id_key" ON "request_assignees"("request_id", "user_id");

-- CreateIndex
CREATE INDEX "request_observers_user_id_idx" ON "request_observers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "request_observers_request_id_user_id_key" ON "request_observers"("request_id", "user_id");

-- AddForeignKey
ALTER TABLE "request_assignees" ADD CONSTRAINT "request_assignees_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_assignees" ADD CONSTRAINT "request_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_observers" ADD CONSTRAINT "request_observers_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_observers" ADD CONSTRAINT "request_observers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
