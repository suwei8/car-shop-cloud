-- CreateTable
CREATE TABLE "parts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "brand" TEXT,
    "unit" TEXT NOT NULL DEFAULT '个',
    "costPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "salePrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "remark" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "remark" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_balances" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_bills" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "billNo" TEXT NOT NULL,
    "billType" TEXT NOT NULL,
    "supplierId" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "remark" TEXT,
    "operatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_bill_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_bill_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "movementType" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "billId" TEXT,
    "billItemId" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "operatorId" TEXT NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "parts_tenantId_idx" ON "parts"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "parts_tenantId_code_key" ON "parts"("tenantId", "code");

-- CreateIndex
CREATE INDEX "suppliers_tenantId_idx" ON "suppliers"("tenantId");

-- CreateIndex
CREATE INDEX "warehouses_tenantId_idx" ON "warehouses"("tenantId");

-- CreateIndex
CREATE INDEX "warehouses_tenantId_shopId_idx" ON "warehouses"("tenantId", "shopId");

-- CreateIndex
CREATE INDEX "stock_balances_tenantId_idx" ON "stock_balances"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_balances_tenantId_warehouseId_partId_key" ON "stock_balances"("tenantId", "warehouseId", "partId");

-- CreateIndex
CREATE INDEX "stock_bills_tenantId_idx" ON "stock_bills"("tenantId");

-- CreateIndex
CREATE INDEX "stock_bills_tenantId_billType_idx" ON "stock_bills"("tenantId", "billType");

-- CreateIndex
CREATE UNIQUE INDEX "stock_bills_tenantId_billNo_key" ON "stock_bills"("tenantId", "billNo");

-- CreateIndex
CREATE INDEX "stock_bill_items_tenantId_idx" ON "stock_bill_items"("tenantId");

-- CreateIndex
CREATE INDEX "stock_bill_items_billId_idx" ON "stock_bill_items"("billId");

-- CreateIndex
CREATE INDEX "stock_movements_tenantId_idx" ON "stock_movements"("tenantId");

-- CreateIndex
CREATE INDEX "stock_movements_partId_idx" ON "stock_movements"("partId");

-- CreateIndex
CREATE INDEX "stock_movements_warehouseId_idx" ON "stock_movements"("warehouseId");

-- CreateIndex
CREATE INDEX "stock_movements_createdAt_idx" ON "stock_movements"("createdAt");

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_bills" ADD CONSTRAINT "stock_bills_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_bills" ADD CONSTRAINT "stock_bills_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_bill_items" ADD CONSTRAINT "stock_bill_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_bill_items" ADD CONSTRAINT "stock_bill_items_billId_fkey" FOREIGN KEY ("billId") REFERENCES "stock_bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_bill_items" ADD CONSTRAINT "stock_bill_items_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_billId_fkey" FOREIGN KEY ("billId") REFERENCES "stock_bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;
