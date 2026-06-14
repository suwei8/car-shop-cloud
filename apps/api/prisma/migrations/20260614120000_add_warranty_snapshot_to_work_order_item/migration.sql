-- AlterTable: WorkOrderItem 增加质保快照字段
ALTER TABLE "work_order_items" ADD COLUMN "supplierId" TEXT,
ADD COLUMN "warrantyMonths" INTEGER,
ADD COLUMN "warrantyUntil" TIMESTAMP(3);
