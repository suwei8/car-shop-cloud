-- AlterTable
ALTER TABLE "dispatch_tasks" ADD COLUMN     "assistantIds" TEXT,
ADD COLUMN     "team" TEXT,
ADD COLUMN     "workPlace" TEXT;

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "expectDate" TIMESTAMP(3);
