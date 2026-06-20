-- AlterTable
ALTER TABLE "image_generations" ADD COLUMN     "usageId" TEXT;

-- AddForeignKey
ALTER TABLE "image_generations" ADD CONSTRAINT "image_generations_usageId_fkey" FOREIGN KEY ("usageId") REFERENCES "usages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
