-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "rotatedAt" TIMESTAMP(3);
