-- AlterTable
ALTER TABLE "Window" ADD COLUMN     "taskTags" TEXT[] DEFAULT ARRAY[]::TEXT[];
