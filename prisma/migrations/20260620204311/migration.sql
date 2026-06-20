-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('USER', 'SECTOR', 'REQUEST');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('EMAIL', 'SMS', 'PUSH', 'WHATSAPP', 'IN_APP');

-- CreateEnum
CREATE TYPE "PivotStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED', 'RETRYING', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "pivot_table" (
    "id" TEXT NOT NULL,
    "subjectType" "SubjectType" NOT NULL,
    "subject_id" TEXT NOT NULL,
    "channel" "ChannelType" NOT NULL,
    "status" "PivotStatus" NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "metadata" JSONB,
    "sent_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pivot_table_pkey" PRIMARY KEY ("id")
);
