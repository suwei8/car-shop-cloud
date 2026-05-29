-- CreateTable
CREATE TABLE "settlements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "settleNo" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payableAmount" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "debtAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'settled',
    "remark" TEXT,
    "operatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "payMethod" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "referenceNo" TEXT,
    "cardId" TEXT,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stored_value_cards" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cardNo" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "principalBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "giftBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stored_value_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stored_value_transactions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "principal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gift" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "operatorId" TEXT NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_value_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_cards" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cardNo" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "shopIds" TEXT,
    "templateId" TEXT,
    "name" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_card_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "serviceItemId" TEXT NOT NULL,
    "totalQty" DECIMAL(10,2) NOT NULL,
    "remainQty" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_card_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_card_transactions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "remainAfter" DECIMAL(10,2) NOT NULL,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "operatorId" TEXT NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_card_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "settlements_tenantId_idx" ON "settlements"("tenantId");

-- CreateIndex
CREATE INDEX "settlements_tenantId_workOrderId_idx" ON "settlements"("tenantId", "workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_tenantId_settleNo_key" ON "settlements"("tenantId", "settleNo");

-- CreateIndex
CREATE INDEX "payments_tenantId_idx" ON "payments"("tenantId");

-- CreateIndex
CREATE INDEX "payments_settlementId_idx" ON "payments"("settlementId");

-- CreateIndex
CREATE INDEX "stored_value_cards_tenantId_idx" ON "stored_value_cards"("tenantId");

-- CreateIndex
CREATE INDEX "stored_value_cards_tenantId_customerId_idx" ON "stored_value_cards"("tenantId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "stored_value_cards_tenantId_cardNo_key" ON "stored_value_cards"("tenantId", "cardNo");

-- CreateIndex
CREATE INDEX "stored_value_transactions_tenantId_idx" ON "stored_value_transactions"("tenantId");

-- CreateIndex
CREATE INDEX "stored_value_transactions_cardId_idx" ON "stored_value_transactions"("cardId");

-- CreateIndex
CREATE INDEX "stored_value_transactions_createdAt_idx" ON "stored_value_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "package_cards_tenantId_idx" ON "package_cards"("tenantId");

-- CreateIndex
CREATE INDEX "package_cards_tenantId_customerId_idx" ON "package_cards"("tenantId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "package_cards_tenantId_cardNo_key" ON "package_cards"("tenantId", "cardNo");

-- CreateIndex
CREATE INDEX "package_card_items_tenantId_idx" ON "package_card_items"("tenantId");

-- CreateIndex
CREATE INDEX "package_card_items_cardId_idx" ON "package_card_items"("cardId");

-- CreateIndex
CREATE INDEX "package_card_transactions_tenantId_idx" ON "package_card_transactions"("tenantId");

-- CreateIndex
CREATE INDEX "package_card_transactions_cardId_idx" ON "package_card_transactions"("cardId");

-- CreateIndex
CREATE INDEX "package_card_transactions_createdAt_idx" ON "package_card_transactions"("createdAt");

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_value_cards" ADD CONSTRAINT "stored_value_cards_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_value_transactions" ADD CONSTRAINT "stored_value_transactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_value_transactions" ADD CONSTRAINT "stored_value_transactions_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "stored_value_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_cards" ADD CONSTRAINT "package_cards_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_card_items" ADD CONSTRAINT "package_card_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_card_items" ADD CONSTRAINT "package_card_items_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "package_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_card_transactions" ADD CONSTRAINT "package_card_transactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_card_transactions" ADD CONSTRAINT "package_card_transactions_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "package_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
