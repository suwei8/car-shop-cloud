-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "subscriptionEndAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionStatus" TEXT NOT NULL DEFAULT 'trial';
