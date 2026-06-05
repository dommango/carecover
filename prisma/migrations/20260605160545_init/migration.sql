-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('TIER1', 'TIER2');

-- CreateEnum
CREATE TYPE "WindowStatus" AS ENUM ('OPEN_TIER1', 'ESCALATED_TIER2', 'FILLED', 'CLOSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "Respondent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "tier" "Tier" NOT NULL,
    "minShiftMinutes" INTEGER NOT NULL DEFAULT 240,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Respondent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Window" (
    "id" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "tier1DeadlineAt" TIMESTAMP(3) NOT NULL,
    "status" "WindowStatus" NOT NULL DEFAULT 'OPEN_TIER1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Window_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "windowId" TEXT NOT NULL,
    "respondentId" TEXT NOT NULL,
    "tier" "Tier" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponseToken" (
    "id" TEXT NOT NULL,
    "windowId" TEXT NOT NULL,
    "respondentId" TEXT NOT NULL,
    "tier" "Tier" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResponseToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "windowId" TEXT,
    "respondentId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'sms',
    "body" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Respondent_tier_active_idx" ON "Respondent"("tier", "active");

-- CreateIndex
CREATE INDEX "Window_status_tier1DeadlineAt_idx" ON "Window"("status", "tier1DeadlineAt");

-- CreateIndex
CREATE INDEX "Assignment_windowId_idx" ON "Assignment"("windowId");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseToken_tokenHash_key" ON "ResponseToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseToken_windowId_respondentId_key" ON "ResponseToken"("windowId", "respondentId");

-- CreateIndex
CREATE INDEX "NotificationLog_windowId_idx" ON "NotificationLog"("windowId");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "Window"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "Respondent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseToken" ADD CONSTRAINT "ResponseToken_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "Window"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseToken" ADD CONSTRAINT "ResponseToken_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "Respondent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "Window"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "Respondent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
