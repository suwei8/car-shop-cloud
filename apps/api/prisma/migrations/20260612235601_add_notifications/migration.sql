-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shopId" TEXT,
    "channel" TEXT NOT NULL,
    "scene" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "failReason" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_tenantId_scene_idx" ON "notifications"("tenantId", "scene");

-- CreateIndex
CREATE INDEX "notifications_relatedType_relatedId_idx" ON "notifications"("relatedType", "relatedId");
