-- Stripe sync hardening: track the latest invoice id on the subscription row.
-- Set by the webhook on every customer.subscription.created/updated/deleted
-- from sub.latest_invoice, so the billing UI can deep-link the most recent
-- invoice without an extra Stripe round-trip.

-- AlterTable: add latestInvoiceId to Subscription
ALTER TABLE "Subscription" ADD COLUMN "latestInvoiceId" TEXT;