/*
  Warnings:

  - You are about to drop the column `lockedAt` on the `templates` table. All the data in the column will be lost.
  - You are about to drop the column `lockedById` on the `templates` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "templates" DROP CONSTRAINT "templates_lockedById_fkey";

-- AlterTable
ALTER TABLE "templates" DROP COLUMN "lockedAt",
DROP COLUMN "lockedById";

-- CreateTable
CREATE TABLE "template_locks" (
    "templateId" TEXT NOT NULL,
    "lockedById" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_locks_pkey" PRIMARY KEY ("templateId")
);

-- CreateIndex
CREATE INDEX "template_locks_lockedById_idx" ON "template_locks"("lockedById");

-- AddForeignKey
ALTER TABLE "template_locks" ADD CONSTRAINT "template_locks_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_locks" ADD CONSTRAINT "template_locks_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
