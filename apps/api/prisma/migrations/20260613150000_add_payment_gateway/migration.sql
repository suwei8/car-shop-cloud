-- AlterTable: extend payments
ALTER TABLE "payments"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'paid',
  ADD COLUMN "transaction_id" TEXT,
  ADD COLUMN "callback_data" JSONB,
  ADD COLUMN "refund_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "paid_at" TIMESTAMP(3),
  ADD COLUMN "expired_at" TIMESTAMP(3);

-- CreateIndex on transactionId
CREATE INDEX "payments_transaction_id_idx" ON "payments"("transaction_id");

-- CreateTable: payment_refunds
CREATE TABLE "payment_refunds" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "refund_no" TEXT NOT NULL,
    "out_refund_no" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "callback_data" JSONB,
    "operator_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_refunds_tenant_id_idx" ON "payment_refunds"("tenant_id");
CREATE INDEX "payment_refunds_payment_id_idx" ON "payment_refunds"("payment_id");
CREATE INDEX "payment_refunds_refund_no_idx" ON "payment_refunds"("refund_no");

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
