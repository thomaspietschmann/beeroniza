-- AlterTable
ALTER TABLE "stored_files" ADD COLUMN     "focalX" DOUBLE PRECISION,
ADD COLUMN     "focalY" DOUBLE PRECISION,
ADD COLUMN     "hasFace" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originalName" TEXT,
ADD COLUMN     "sha256" TEXT;

-- CreateIndex
CREATE INDEX "stored_files_userId_kind_sha256_idx" ON "stored_files"("userId", "kind", "sha256");
