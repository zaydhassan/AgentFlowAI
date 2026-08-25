import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/page-shell";
import { DocsArticle } from "@/components/docs/docs-article";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout } from "@/components/docs/callout";
import { ArchitectureDiagram } from "@/components/docs/architecture-diagram";
import { RelatedDocs } from "@/components/docs/related-docs";
import { getDocBySlug } from "@/lib/docs/navigation";

const slug = "execution";
const meta = getDocBySlug(slug)!;

export const metadata: Metadata = {
  title: "Execution & Self-healing — AgentFlow AI Docs",
  description: meta.description,
  alternates: { canonical: meta.href },
  openGraph: {
    title: "Execution & Self-healing — AgentFlow AI Docs",
    description: meta.description,
    url: meta.href,
  },
};

const retryPolicy = `{
  "id": "post",
  "type": "http.request",
  "config": {
    "url": "{{ secrets.erp }}/invoices",
    "method": "POST"
  },
  "retry": {
    "maxAttempts": 5,
    "backoff": "exponential",
    "initialDelayMs": 500,
    "maxDelayMs": 8000,
    "retryOn": [500, 502, 503, 504, "timeout"]
  },
  "timeout": { "durationMs": 30000 }
}`;

const observabilityQuery = `# Inspect a run's per-node trace.
GET /api/workflows/{id}/executions/{eid}

{
  "status": "succeeded",
  "durationMs": 4821,
  "nodes": [
    { "id": "trigger",  "status": "succeeded", "ms": 12 },
    { "id": "extract",  "status": "succeeded", "ms": 1840, "tokens": 1284 },
    { "id": "route",    "status": "succeeded", "ms": 4 },
    { "id": "post",     "status": "succeeded", "ms": 2965,
      "attempts": 2, "lastError": "503 (retried)" }
  ]
}`;

export default function ExecutionDocPage() {
  return (
    <MarketingPage>
      <DocsArticle meta={meta}>
        <section id="overview">
          <h2>Overview</h2>
          <p className="lead">
            Execution is what turns a workflow graph into a reliable, observable
            run. The scheduler queues nodes, respects dependencies, enforces
            timeouts, and retries transient failures automatically — so a flaky
            third-party API never takes your whole automation down.
          </p>
          <p>
            Every run is recorded with a full per-node trace: status, duration, token usage, and
            retry history. When something fails, you replay the exact run against the exact version
            to reproduce and debug it.
          </p>
        </section>

        <section id="architecture">
          <h2>Architecture</h2>
          <p>
            Runs flow from the scheduler into isolated, ephemeral runtimes. The run log captures
            every node; failures are classified and either retried, self-healed, or surfaced.
          </p>
          <ArchitectureDiagram
            caption="The scheduler dispatches nodes to isolated runtimes; the run log records each step and drives retries."
            layers={[
              [{ label: "Scheduler", sub: "queue + dependencies", tone: "brand" }],
              [{ label: "Isolated Runtime", sub: "ephemeral · resource-limited", tone: "ai" }],
              [
                { label: "Run Log", sub: "per-node trace", tone: "success" },
                { label: "Failure Classifier", sub: "retry · heal · surface", tone: "warning" },
              ],
              [{ label: "Observability", sub: "metrics + replay", tone: "brand" }],
            ]}
          />
        </section>

        <section id="key-concepts">
          <h2>Key concepts</h2>

          <h3>Scheduler</h3>
          <p>
            The scheduler resolves the dependency graph, fans out parallel branches, and queues each
            node for execution. It respects per-branch timeouts and backpressure so a burst of
            triggers never overwhelms a downstream integration.
          </p>

          <h3>Retries & backoff</h3>
          <p>
            Every node can declare a <code>retry</code> policy: max attempts, backoff strategy
            (fixed or exponential), and which status codes or error types to retry on. Exponential
            backoff with jitter spreads load during partial outages.
          </p>

          <h3>Timeouts</h3>
          <p>
            A node <code>timeout</code> caps how long a single attempt may run. A timed-out node is
            treated as a retryable failure, so a hung HTTP call is retried with a fresh attempt
            rather than stalling the run forever.
          </p>

          <h3>Self-healing</h3>
          <p>
            For certain recoverable errors the runtime can self-heal: refresh an expired token and
            retry, or re-prompt an agent that returned malformed output. Self-heal actions are
            logged so you can see when a run recovered and why.
          </p>

          <h3>Run log & replay</h3>
          <p>
            Each execution writes an immutable trace. Replay re-runs a specific execution against
            its original version and inputs — invaluable for reproducing a prod failure in
            isolation.
          </p>
        </section>

        <section id="code-examples">
          <h2>Code examples</h2>
          <p>
            Attach a retry policy to any node. This HTTP node retries on 5xx and timeouts with
            exponential backoff, a configurable attempt cap, and a per-attempt delay ceiling.
          </p>
          <CodeBlock filename="retry-policy.json" language="json" code={retryPolicy} />

          <h3>Inspect a run</h3>
          <p>
            The execution trace shows per-node status, timing, tokens, and how many attempts a node
            took — here the <code>post</code> node succeeded on its second try after a 503.
          </p>
          <CodeBlock filename="run-trace.json" language="json" code={observabilityQuery} />

          <Callout type="note" title="Retry idempotency">
            Only retry nodes that are safe to repeat. A POST that charges a card should guard with
            an idempotency key; a webhook delivery should be safely re-deliverable. Retry multiplies
            side effects — design for it.
          </Callout>
        </section>

        <section id="best-practices">
          <h2>Best practices</h2>
          <ul className="checklist">
            <li>
              <strong>Retry only transient failures.</strong> Retry 5xx, timeouts, and rate limits —
              never 4xx. Retrying a 400 just wastes attempts.
            </li>
            <li>
              <strong>Always set a timeout.</strong> Without one, a hung call can stall a node
              indefinitely. Timeouts turn hangs into retryable failures.
            </li>
            <li>
              <strong>Make retries idempotent.</strong> Use idempotency keys for mutating calls so a
              retried attempt never double-charges or double-creates.
            </li>
            <li>
              <strong>Cap parallelism.</strong> Fan-out is great until it rate-limits a downstream.
              Bound concurrency per integration.
            </li>
            <li>
              <strong>Reproduce before you fix.</strong> Replay the failing execution against its
              version to confirm the fix before you promote.
            </li>
          </ul>
        </section>

        <section id="related">
          <h2>Related documentation</h2>
          <RelatedDocs
            links={[
              { label: "Workflows & Nodes", href: "/docs/workflows", desc: "Node types and versioning" },
              { label: "Agents & Memory", href: "/docs/agents", desc: "Agent iteration limits and tools" },
              { label: "Secrets & Integrations", href: "/docs/integrations", desc: "Token refresh + scoped creds" },
              { label: "Observability", href: "/observability", desc: "Live run metrics in the app" },
            ]}
          />
        </section>
      </DocsArticle>
    </MarketingPage>
  );
}