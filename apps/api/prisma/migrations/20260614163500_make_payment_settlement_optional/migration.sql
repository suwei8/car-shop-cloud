-- DropForeignKey
ALTER TABLE "payment_refunds" DROP CONSTRAINT "payment_refunds_payment_id_fkey";

-- DropForeignKey
ALTER TABLE "payment_refunds" DROP CONSTRAINT "payment_refunds_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_settlementId_fkey";

-- DropIndex
DROP INDEX "payment_refunds_payment_id_idx";

-- DropIndex
DROP INDEX "payment_refunds_refund_no_idx";

-- DropIndex
DROP INDEX "payment_refunds_tenant_id_idx";

-- DropIndex
DROP INDEX "payments_transaction_id_idx";

-- AlterTable
ALTER TABLE "payment_refunds" DROP COLUMN "callback_data",
DROP COLUMN "created_at",
DROP COLUMN "operator_id",
DROP COLUMN "out_refund_no",
DROP COLUMN "payment_id",
DROP COLUMN "refund_no",
DROP COLUMN "tenant_id",
DROP COLUMN "updated_at",
ADD COLUMN     "callbackData" JSONB,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "operatorId" TEXT NOT NULL,
ADD COLUMN     "outRefundNo" TEXT,
ADD COLUMN     "paymentId" TEXT NOT NULL,
ADD COLUMN     "refundNo" TEXT NOT NULL,
ADD COLUMN     "tenantId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "callback_data",
DROP COLUMN "expired_at",
DROP COLUMN "paid_at",
DROP COLUMN "refund_amount",
DROP COLUMN "transaction_id",
ADD COLUMN     "callbackData" JSONB,
ADD COLUMN     "expiredAt" TIMESTAMP(3),
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "refundAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "transactionId" TEXT,
ALTER COLUMN   "settlementId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "subscription_plans" ADD COLUMN     "discount12m" DECIMAL(4,2) NOT NULL DEFAULT 0.80,
ADD COLUMN     "discount3m" DECIMAL(4,2) NOT NULL DEFAULT 0.95,
ADD COLUMN     "discount6m" DECIMAL(4,2) NOT NULL DEFAULT 0.90,
ADD COLUMN     "priceMonthly" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "subscription_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "months" INTEGER NOT NULL,
    "originalAmount" DECIMAL(12,2) NOT NULL,
    "discountRate" DECIMAL(4,2) NOT NULL DEFAULT 1.0,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentMethod" TEXT,
    "transactionId" TEXT,
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscription_orders_tenantId_idx" ON "subscription_orders"("tenantId");

-- CreateIndex
CREATE INDEX "subscription_orders_tenantId_status_idx" ON "subscription_orders"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_orders_tenantId_orderNo_key" ON "subscription_orders"("tenantId", "orderNo");

-- CreateIndex
CREATE INDEX "payment_refunds_tenantId_idx" ON "payment_refunds"("tenantId");

-- CreateIndex
CREATE INDEX "payment_refunds_paymentId_idx" ON "payment_refunds"("paymentId");

-- CreateIndex
CREATE INDEX "payment_refunds_refundNo_idx" ON "payment_refunds"("refundNo");

-- CreateIndex
CREATE INDEX "payments_transactionId_idx" ON "payments"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "users_wxOpenid_key" ON "users"("wxOpenid");

-- AddForeignKey
ALTER TABLE "subscription_orders" ADD CONSTRAINT "subscription_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_orders" ADD CONSTRAINT "subscription_orders_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
