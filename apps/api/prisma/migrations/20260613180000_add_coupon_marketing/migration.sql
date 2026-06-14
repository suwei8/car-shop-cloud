-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "discountValue" DECIMAL(12,2) NOT NULL,
    "conditionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "validDays" INTEGER NOT NULL DEFAULT 30,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "issuedQuantity" INTEGER NOT NULL DEFAULT 0,
    "usedQuantity" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_claims" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unused',
    "usedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coupons_tenantId_idx" ON "coupons"("tenantId");

-- CreateIndex
CREATE INDEX "coupons_tenantId_status_idx" ON "coupons"("tenantId", "status");

-- CreateIndex
CREATE INDEX "coupon_claims_tenantId_idx" ON "coupon_claims"("tenantId");

-- CreateIndex
CREATE INDEX "coupon_claims_couponId_idx" ON "coupon_claims"("couponId");

-- CreateIndex
CREATE INDEX "coupon_claims_customerId_idx" ON "coupon_claims"("customerId");

-- CreateIndex
CREATE INDEX "coupon_claims_tenantId_customerId_status_idx" ON "coupon_claims"("tenantId", "customerId", "status");

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_claims" ADD CONSTRAINT "coupon_claims_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_claims" ADD CONSTRAINT "coupon_claims_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_claims" ADD CONSTRAINT "coupon_claims_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
