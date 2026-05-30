-- AlterTable
ALTER TABLE "work_order_items" ADD COLUMN     "partId" TEXT;

-- CreateIndex
CREATE INDEX "work_order_items_partId_idx" ON "work_order_items"("partId");

-- AddForeignKey
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
