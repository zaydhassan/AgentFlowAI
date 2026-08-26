import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, isPaidUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { buttonVariants } from "@/components/ui/button";
import MarketplaceClient from "@/components/marketplace/marketplace-client";

export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/marketplace");

  // Marketplace is a premium feature. Free users see an inline upgrade gate
  // instead of the template grid; the install API enforces the same check.
  if (!isPaidUser(user)) {
    return (
      <div className="animate-float-up">
        <PageHeader
          title="Template Marketplace"
          description="Production-ready workflow templates. Install and customize in one click."
        />
        <Card className="mx-auto mt-6 max-w-lg p-8 text-center sm:p-10">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Icon name="Lock" className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-lg font-semibold">Marketplace is a premium feature</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-fg-muted">
            Upgrade to a paid plan to browse and install production-ready workflow templates —
            lead generation, invoice processing, support triage, and more — in one click.
          </p>
          <Link
            href="/pricing"
            className={`${buttonVariants({ variant: "ai", size: "md" })} mt-6 inline-flex`}
          >
            <Icon name="Sparkles" className="h-4 w-4" /> Upgrade plan
          </Link>
          <p className="mt-3 text-[11px] text-fg-subtle">
            Already a paid subscriber? Your plan may be paused or expired — check billing.
          </p>
        </Card>
      </div>
    );
  }

  return <MarketplaceClient />;
}