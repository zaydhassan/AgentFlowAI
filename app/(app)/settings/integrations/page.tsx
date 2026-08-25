import { requireUser } from "@/lib/auth/session";
import { listAccounts, listProviders, encryptionConfigured } from "@/lib/integrations";
import { PageHeader } from "@/components/layout/page-header";
import { IntegrationsManager } from "@/components/integrations/integrations-manager";

export const dynamic = "force-dynamic";

type SearchParams = { connected?: string; error?: string };

export default async function IntegrationsPage(props: { searchParams: Promise<SearchParams> }) {
  const sp = await props.searchParams;
  const user = await requireUser();

  const [providers, accounts] = await Promise.all([
    listProviders(user.id),
    listAccounts(user.id),
  ]);

  return (
    <div className="animate-float-up">
      <PageHeader title="Integrations" description="Connect external accounts your workflows can use." />
      <IntegrationsManager
        providers={providers}
        accounts={accounts}
        encryptionConfigured={encryptionConfigured()}
        flash={sp.connected ? { kind: "connected" } : sp.error ? { kind: "error", message: sp.error } : null}
      />
    </div>
  );
}