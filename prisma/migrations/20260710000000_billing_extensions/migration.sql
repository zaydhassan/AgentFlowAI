-- Billing extensions: richer subscription state, usage metering fields,
-- and the PlanPrice provisioning cache.

-- AlterTable: add billing-cycle / product / trial / card fields to Subscription
ALTER TABLE "Subscription" ADD COLUMN "stripeProductId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "interval" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "currentPeriodStart" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "cancelAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "trialEnd" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "cardBrand" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "cardLast4" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "cardExpMonth" INTEGER;
ALTER TABLE "Subscription" ADD COLUMN "cardExpYear" INTEGER;

-- AlterTable: add usage metering fields to Usage
ALTER TABLE "Usage" ADD COLUMN "storage" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Usage" ADD COLUMN "tokenUsage" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Usage" ADD COLUMN "compute" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: PlanPrice provisioning cache
CREATE TABLE "PlanPrice" (
    "id" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "stripeProductId" TEXT NOT NULL,
    "stripePriceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanPrice_stripePriceId_key" ON "PlanPrice"("stripePriceId");
CREATE UNIQUE INDEX "PlanPrice_plan_interval_key" ON "PlanPrice"("plan", "interval");