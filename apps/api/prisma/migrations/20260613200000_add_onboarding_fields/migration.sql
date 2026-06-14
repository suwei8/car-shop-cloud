-- AlterTable: Add onboarding fields to Tenant
ALTER TABLE "tenants" ADD COLUMN "businessType" TEXT,
ADD COLUMN "employeeCount" INTEGER;

-- AlterTable: Add wxOpenid to User
ALTER TABLE "users" ADD COLUMN "wxOpenid" TEXT;

-- CreateIndex: Unique index for wxOpenid (partial, allowing nulls)
CREATE UNIQUE INDEX "user_wxopenid_key" ON "users"("wxOpenid") WHERE "wxOpenid" IS NOT NULL;
