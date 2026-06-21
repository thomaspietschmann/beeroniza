-- DropIndex
DROP INDEX "brand_kits_userId_key";

-- AlterTable
ALTER TABLE "brand_kits" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Brand Kit';

-- Mark existing kits as default (they were the only kit per user)
UPDATE "brand_kits" SET "isDefault" = true;

-- AlterTable
ALTER TABLE "usages" ADD COLUMN "brandKitId" TEXT;

-- CreateIndex
CREATE INDEX "brand_kits_userId_idx" ON "brand_kits"("userId");

-- AddForeignKey
ALTER TABLE "usages" ADD CONSTRAINT "usages_brandKitId_fkey" FOREIGN KEY ("brandKitId") REFERENCES "brand_kits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
