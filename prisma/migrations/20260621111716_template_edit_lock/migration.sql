-- AlterTable
ALTER TABLE "templates" ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "lockedById" TEXT;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
