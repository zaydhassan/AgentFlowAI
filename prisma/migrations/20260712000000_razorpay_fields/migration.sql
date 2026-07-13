-- Razorpay migration: add Razorpay linkage columns alongside the existing
-- Stripe columns, and relax the Stripe NOT NULL constraints so a Razorpay-
-- owned row can leave them null. Existing Stripe data is preserved (columns
-- keep their values; only the NOT NULL constraint is dropped). No data is
-- deleted or rewritten.

-- Relax Stripe NOT NULL constraints (Razorpay rows null these).
ALTER TABLE "Subscription" ALTER COLUMN "stripeCustomerId" DROP NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "stripeInvoiceId" DROP NOT NULL;
ALTER TABLE "PlanPrice" ALTER COLUMN "stripeProductId" DROP NOT NULL;
ALTER TABLE "PlanPrice" ALTER COLUMN "stripePriceId" DROP NOT NULL;

-- Razorpay customer id on User.
ALTER TABLE "User" ADD COLUMN "razorpayCustomerId" TEXT;
CREATE UNIQUE INDEX "User_razorpayCustomerId_key" ON "User"("razorpayCustomerId");

-- Razorpay linkage on Subscription.
ALTER TABLE "Subscription" ADD COLUMN "razorpayCustomerId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "razorpaySubscriptionId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "razorpayPaymentId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "razorpayOrderId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "razorpayPlanId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "paused" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "Subscription_razorpaySubscriptionId_key" ON "Subscription"("razorpaySubscriptionId");

-- Razorpay linkage on Invoice.
ALTER TABLE "Invoice" ADD COLUMN "razorpayInvoiceId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "razorpayPaymentId" TEXT;
CREATE UNIQUE INDEX "Invoice_razorpayInvoiceId_key" ON "Invoice"("razorpayInvoiceId");

-- Razorpay plan id on the provisioning cache.
ALTER TABLE "PlanPrice" ADD COLUMN "razorpayPlanId" TEXT;
CREATE UNIQUE INDEX "PlanPrice_razorpayPlanId_key" ON "PlanPrice"("razorpayPlanId");