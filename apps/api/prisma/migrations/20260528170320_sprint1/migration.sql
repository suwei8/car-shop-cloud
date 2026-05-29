-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "gender" TEXT,
    "email" TEXT,
    "address" TEXT,
    "remark" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "plateNo" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "vin" TEXT,
    "engineNo" TEXT,
    "color" TEXT,
    "mileage" INTEGER,
    "firstRegDate" TIMESTAMP(3),
    "remark" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "serviceType" TEXT NOT NULL,
    "appointTime" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "arriveTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'receiving',
    "workOrderId" TEXT,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '次',
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "orderType" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "vehiclePlateNo" TEXT NOT NULL,
    "vehicleMileage" INTEGER,
    "advisorId" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payableAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "serviceItemId" TEXT,
    "itemType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT '次',
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "technicianId" TEXT,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "note" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "itemIds" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispatch_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customers_tenantId_idx" ON "customers"("tenantId");

-- CreateIndex
CREATE INDEX "customers_tenantId_phone_idx" ON "customers"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "vehicles_tenantId_idx" ON "vehicles"("tenantId");

-- CreateIndex
CREATE INDEX "vehicles_tenantId_plateNo_idx" ON "vehicles"("tenantId", "plateNo");

-- CreateIndex
CREATE INDEX "vehicles_tenantId_vin_idx" ON "vehicles"("tenantId", "vin");

-- CreateIndex
CREATE INDEX "appointments_tenantId_idx" ON "appointments"("tenantId");

-- CreateIndex
CREATE INDEX "appointments_tenantId_shopId_idx" ON "appointments"("tenantId", "shopId");

-- CreateIndex
CREATE INDEX "appointments_tenantId_appointTime_idx" ON "appointments"("tenantId", "appointTime");

-- CreateIndex
CREATE INDEX "receptions_tenantId_idx" ON "receptions"("tenantId");

-- CreateIndex
CREATE INDEX "receptions_tenantId_shopId_idx" ON "receptions"("tenantId", "shopId");

-- CreateIndex
CREATE INDEX "service_items_tenantId_idx" ON "service_items"("tenantId");

-- CreateIndex
CREATE INDEX "service_items_tenantId_category_idx" ON "service_items"("tenantId", "category");

-- CreateIndex
CREATE INDEX "work_orders_tenantId_idx" ON "work_orders"("tenantId");

-- CreateIndex
CREATE INDEX "work_orders_tenantId_shopId_idx" ON "work_orders"("tenantId", "shopId");

-- CreateIndex
CREATE INDEX "work_orders_tenantId_status_idx" ON "work_orders"("tenantId", "status");

-- CreateIndex
CREATE INDEX "work_orders_tenantId_createdAt_idx" ON "work_orders"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_tenantId_orderNo_key" ON "work_orders"("tenantId", "orderNo");

-- CreateIndex
CREATE INDEX "work_order_items_tenantId_idx" ON "work_order_items"("tenantId");

-- CreateIndex
CREATE INDEX "work_order_items_workOrderId_idx" ON "work_order_items"("workOrderId");

-- CreateIndex
CREATE INDEX "inspection_records_tenantId_idx" ON "inspection_records"("tenantId");

-- CreateIndex
CREATE INDEX "inspection_records_workOrderId_idx" ON "inspection_records"("workOrderId");

-- CreateIndex
CREATE INDEX "dispatch_tasks_tenantId_idx" ON "dispatch_tasks"("tenantId");

-- CreateIndex
CREATE INDEX "dispatch_tasks_workOrderId_idx" ON "dispatch_tasks"("workOrderId");

-- CreateIndex
CREATE INDEX "dispatch_tasks_technicianId_idx" ON "dispatch_tasks"("technicianId");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receptions" ADD CONSTRAINT "receptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receptions" ADD CONSTRAINT "receptions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receptions" ADD CONSTRAINT "receptions_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_items" ADD CONSTRAINT "service_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_serviceItemId_fkey" FOREIGN KEY ("serviceItemId") REFERENCES "service_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_records" ADD CONSTRAINT "inspection_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_records" ADD CONSTRAINT "inspection_records_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_tasks" ADD CONSTRAINT "dispatch_tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_tasks" ADD CONSTRAINT "dispatch_tasks_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
