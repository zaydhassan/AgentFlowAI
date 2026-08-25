import { requireUser } from "@/lib/auth/session";
import { repository, embeddingConfigured } from "@/lib/memory";
import { PageHeader } from "@/components/layout/page-header";
import { MemoryDashboard } from "@/components/memory/memory-dashboard";

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const user = await requireUser();

  const [memories, stats, collections] = await Promise.all([
    repository.list({ ownerId: user.id, limit: 50 }),
    repository.stats(user.id),
    repository.listCollections(user.id),
  ]);

  return (
    <div className="animate-float-up">
      <PageHeader
        title="Memory"
        description="Long-term memory across runs, agents, and workflows — so your AI gets smarter, not just faster."
      />
      <MemoryDashboard
        initialMemories={memories}
        initialStats={stats}
        initialCollections={collections}
        embeddingsConfigured={embeddingConfigured()}
      />
    </div>
  );
}