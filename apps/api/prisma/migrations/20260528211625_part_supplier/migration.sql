-- AlterTable
ALTER TABLE "parts" ADD COLUMN     "supplierId" TEXT,
ADD COLUMN     "warrantyMonths" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
