-- AlterTable
ALTER TABLE "requests" ADD COLUMN "solved_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "requests_status_solved_at_idx" ON "requests"("status", "solved_at");
