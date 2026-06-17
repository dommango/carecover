-- CreateEnum
CREATE TYPE "ClaimRule" AS ENUM ('PARTIAL', 'WHOLE_GAP');

-- AlterEnum
BEGIN;
CREATE TYPE "WindowStatus_new" AS ENUM ('OPEN', 'FILLED', 'CLOSED', 'EXPIRED');
ALTER TABLE "public"."Window" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Window" ALTER COLUMN "status" TYPE "WindowStatus_new" USING ("status"::text::"WindowStatus_new");
ALTER TYPE "WindowStatus" RENAME TO "WindowStatus_old";
ALTER TYPE "WindowStatus_new" RENAME TO "WindowStatus";
DROP TYPE "public"."WindowStatus_old";
ALTER TABLE "Window" ALTER COLUMN "status" SET DEFAULT 'OPEN';
COMMIT;

-- DropIndex
DROP INDEX "Respondent_tier_active_idx";

-- DropIndex
DROP INDEX "ResponseToken_windowId_respondentId_key";

-- DropIndex
DROP INDEX "Window_status_tier1DeadlineAt_idx";

-- AlterTable
ALTER TABLE "Assignment" DROP COLUMN "tier",
ADD COLUMN     "windowTierId" TEXT;

-- AlterTable
ALTER TABLE "Respondent" DROP COLUMN "minShiftMinutes",
DROP COLUMN "tier";

-- AlterTable
ALTER TABLE "ResponseToken" DROP COLUMN "tier",
ADD COLUMN     "windowTierId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Window" DROP COLUMN "tier1DeadlineAt",
ADD COLUMN     "activeTierIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currentTierDeadlineAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'OPEN';

-- DropEnum
DROP TYPE "Tier";

-- CreateTable
CREATE TABLE "WindowTier" (
    "id" TEXT NOT NULL,
    "windowId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT,
    "claimRule" "ClaimRule" NOT NULL,
    "minShiftMinutes" INTEGER NOT NULL DEFAULT 240,
    "deadlineAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WindowTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WindowTierMember" (
    "id" TEXT NOT NULL,
    "windowTierId" TEXT NOT NULL,
    "respondentId" TEXT NOT NULL,

    CONSTRAINT "WindowTierMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WindowTier_windowId_position_key" ON "WindowTier"("windowId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "WindowTierMember_windowTierId_respondentId_key" ON "WindowTierMember"("windowTierId", "respondentId");

-- CreateIndex
CREATE INDEX "Respondent_active_idx" ON "Respondent"("active");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseToken_windowId_respondentId_windowTierId_key" ON "ResponseToken"("windowId", "respondentId", "windowTierId");

-- CreateIndex
CREATE INDEX "Window_status_currentTierDeadlineAt_idx" ON "Window"("status", "currentTierDeadlineAt");

-- AddForeignKey
ALTER TABLE "WindowTier" ADD CONSTRAINT "WindowTier_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "Window"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WindowTierMember" ADD CONSTRAINT "WindowTierMember_windowTierId_fkey" FOREIGN KEY ("windowTierId") REFERENCES "WindowTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WindowTierMember" ADD CONSTRAINT "WindowTierMember_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "Respondent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_windowTierId_fkey" FOREIGN KEY ("windowTierId") REFERENCES "WindowTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseToken" ADD CONSTRAINT "ResponseToken_windowTierId_fkey" FOREIGN KEY ("windowTierId") REFERENCES "WindowTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

