"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { templates } from "@/lib/mock/data";
import type { Template } from "@/lib/types";
import { cn } from "@/lib/utils";

const categories = ["All", ...Array.from(new Set(templates.map((t) => t.category)))];

export default function MarketplaceClient() {
  const router = useRouter();
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const featured = templates.filter((t) => t.featured);
  const list = templates.filter(
    (t) =>
      (cat === "All" || t.category === cat) &&
      (t.name.toLowerCase().includes(q.toLowerCase()) ||
        t.tags.some((tg) => tg.includes(q.toLowerCase()))),
  );

  async function install(t: Template) {
    // Guard against double-clicks / concurrent installs.
    if (installingId) return;
    setInstallingId(t.id);
    setError(null);
    try {
      const res = await fetch("/api/marketplace/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: t.id }),
      });
      if (res.ok) {
        const { id } = await res.json();
        if (id) {
          router.push(`/workflows/${id}?template=${encodeURIComponent(t.name)}`);
          return;
        }
      }
      if (res.status === 401) {
        router.push("/login?callbackUrl=/marketplace");
        return;
      }
      if (res.status === 402) {
        router.push("/pricing");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not install this template. Please try again.");
    } catch {
      setError("Network error — could not install this template. Please try again.");
    } finally {
      setInstallingId(null);
    }
  }

  return (
    <div className="animate-float-up">
      <PageHeader
        title="Template Marketplace"
        description="Production-ready workflow templates. Install and customize in one click."
        actions={
          <Button size="sm" variant="ai">
            <Icon name="Plus" className="h-3.5 w-3.5" /> Submit template
          </Button>
        }
      />

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          <Icon name="TriangleAlert" className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="rounded p-0.5 hover:bg-danger/20"
            aria-label="Dismiss"
          >
            <Icon name="X" className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Featured */}
      {!q && cat === "All" && (
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-fg-subtle">
            <Icon name="Sparkles" className="h-3.5 w-3.5 text-brand" /> Featured
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {featured.map((t) => {
              const busy = installingId === t.id;
              return (
                <Card key={t.id} className="card-hover relative overflow-hidden p-5">
                  <div
                    className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-20 blur-2xl"
                    style={{ background: t.color }}
                  />
                  <div
                    className="grid h-12 w-12 place-items-center rounded-xl"
                    style={{ background: `${t.color}22`, color: t.color }}
                  >
                    <Icon name={t.icon} className="h-6 w-6" />
                  </div>
                  <h3 className="mt-3 font-semibold">{t.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-fg-muted">{t.description}</p>
                  <div className="mt-3 flex items-center gap-3 text-[11px] text-fg-subtle">
                    <span className="flex items-center gap-1">
                      <Icon name="Download" className="h-3 w-3" /> {t.installs.toLocaleString("en-US")}
                    </span>
                    <span className="flex items-center gap-1">
                      <Icon name="Star" className="h-3 w-3 text-warning" /> {t.rating}
                    </span>
                    <span className="flex items-center gap-1">
                      <Icon name="Workflow" className="h-3 w-3" /> {t.nodeCount}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    className="mt-4 w-full"
                    disabled={!!installingId}
                    onClick={() => install(t)}
                  >
                    {busy ? (
                      <>
                        <Icon name="LoaderCircle" className="h-3.5 w-3.5 animate-spin" /> Installing…
                      </>
                    ) : (
                      <>
                        <Icon name="Download" className="h-3.5 w-3.5" /> Use template
                      </>
                    )}
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Icon
            name="Search"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search templates…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              suppressHydrationWarning
              onClick={() => setCat(c)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                cat === c
                  ? "bg-brand-soft text-fg border-brand/30"
                  : "border-border text-fg-muted hover:text-fg hover:bg-surface-2",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.map((t) => {
          const busy = installingId === t.id;
          return (
            <Card key={t.id} className="card-hover flex flex-col p-4">
              <div className="flex items-start justify-between">
                <div
                  className="grid h-10 w-10 place-items-center rounded-xl"
                  style={{ background: `${t.color}22`, color: t.color }}
                >
                  <Icon name={t.icon} className="h-5 w-5" />
                </div>
                {t.featured && <Badge tone="brand">Featured</Badge>}
              </div>
              <h3 className="mt-3 text-sm font-semibold">{t.name}</h3>
              <p className="mt-1 line-clamp-2 flex-1 text-xs text-fg-muted">{t.description}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {t.tags.map((tg) => (
                  <span
                    key={tg}
                    className="rounded border border-border bg-surface-2/60 px-1.5 py-0.5 text-[10px] text-fg-subtle"
                  >
                    #{tg}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="text-[11px] text-fg-subtle">by {t.author}</span>
                <span className="flex items-center gap-1 text-[11px] text-fg-muted">
                  <Icon name="Star" className="h-3 w-3 text-warning" /> {t.rating}
                </span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="mt-3 w-full"
                disabled={!!installingId}
                onClick={() => install(t)}
              >
                {busy ? (
                  <>
                    <Icon name="LoaderCircle" className="h-3.5 w-3.5 animate-spin" /> Installing…
                  </>
                ) : (
                  <>
                    <Icon name="Download" className="h-3.5 w-3.5" /> Install
                  </>
                )}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}