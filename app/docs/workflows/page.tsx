import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/page-shell";
import { DocsArticle } from "@/components/docs/docs-article";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout } from "@/components/docs/callout";
import { ArchitectureDiagram } from "@/components/docs/architecture-diagram";
import { RelatedDocs } from "@/components/docs/related-docs";
import { getDocBySlug } from "@/lib/docs/navigation";

const slug = "workflows";
const meta = getDocBySlug(slug)!;

export const metadata: Metadata = {
  title: "Workflows & Nodes — AgentFlow AI Docs",
  description: meta.description,
  alternates: { canonical: meta.href },
  openGraph: {
    title: "Workflows & Nodes — AgentFlow AI Docs",
    description: meta.description,
    url: meta.href,
  },
};

const workflowSchema = `{
  "id": "wf_invoice_triage",
  "version": 3,
  "nodes": [
    {
      "id": "trigger",
      "type": "trigger.webhook",
      "config": { "path": "/hooks/invoice-received" }
    },
    {
      "id": "extract",
      "type": "ai.extract",
      "config": {
        "model": "claude-sonnet-5",
        "schema": { "vendor": "string", "amount": "number", "dueDate": "string" }
      }
    },
    {
      "id": "route",
      "type": "branch.conditional",
      "config": {
        "rules": [
          { "when": "{{ extract.amount }} > 10000", "goto": "approval" },
          { "when": "true", "goto": "post" }
        ]
      }
    },
    { "id": "approval", "type": "human.approval" },
    { "id": "post",      "type": "http.request", "config": { "url": "{{ secrets.erp }}/invoices" } }
  ],
  "edges": [
    { "from": "trigger", "to": "extract" },
    { "from": "extract", "to": "route" }
  ]
}`;

export default function WorkflowsDocPage() {
  return (
    <MarketingPage>
      <DocsArticle meta={meta}>
        <section id="overview">
          <h2>Overview</h2>
          <p className="lead">
            A workflow is a directed graph of typed nodes. Each node performs one
            discrete step — a trigger, an AI call, a branch, an HTTP request, a
            human approval — and passes its output to the next. The canvas and
            the code are the same object, so you can design visually and inspect
            or version-control the exact graph that runs.
          </p>
          <p>
            Workflows are <strong>versioned</strong>, <strong>reproducible</strong>, and
            <strong> observable</strong>: every run records per-node inputs, outputs, timing, and
            token usage. The same schema powers the visual builder and the CLI, so code and canvas
            never drift.
          </p>
        </section>

        <section id="architecture">
          <h2>Architecture</h2>
          <p>
            A workflow moves through four layers — from an external event into the
            graph engine, through typed nodes, out to integrations, and finally
            into the execution runtime which records the run.
          </p>
          <ArchitectureDiagram
            caption="A webhook trigger flows through extraction and conditional routing into an HTTP action."
            layers={[
              [{ label: "Trigger", sub: "webhook · schedule · event", tone: "brand" }],
              [{ label: "Graph Engine", sub: "typed nodes + edges", tone: "ai" }],
              [
                { label: "AI Node", sub: "extract / reason", tone: "ai" },
                { label: "Branch Node", sub: "conditional routing", tone: "warning" },
              ],
              [{ label: "Integration", sub: "HTTP · tool · human", tone: "success" }],
              [{ label: "Execution Runtime", sub: "scheduler + run log", tone: "brand" }],
            ]}
          />
        </section>

        <section id="key-concepts">
          <h2>Key concepts</h2>

          <h3>Nodes</h3>
          <p>
            A node is the atomic unit of work. Every node has a <code>type</code>, a unique{" "}
            <code>id</code>, and a <code>config</code> object. There are 60+ built-in node types
            grouped into families: <code>trigger.*</code>, <code>ai.*</code>, <code>branch.*</code>,
            <code>http.*</code>, <code>logic.*</code>, <code>human.*</code>, and{" "}
            <code>integrations.*</code>.
          </p>

          <h3>Edges & routing</h3>
          <p>
            Edges connect node outputs to node inputs. Conditional routing is expressed with a{" "}
            <code>branch.conditional</code> node whose rules evaluate templated expressions against
            upstream outputs. The first matching rule wins; a default <code>true</code> rule acts as
            the fallback.
          </p>

          <h3>Outputs & templating</h3>
          <p>
            Each node exposes its result as <code>{"{{ nodeId.<field> }}"}</code> in downstream
            configs. Templating is deterministic and sandboxed — no arbitrary code execution. This
            is how an extraction output flows into a branch condition and then into an HTTP body.
          </p>

          <h3>Parallel execution</h3>
          <p>
            A node with multiple outgoing edges fans out and runs its children concurrently. The
            runtime awaits all branches before continuing past a join, with per-branch timeouts so
            one slow child can never stall the whole run.
          </p>

          <h3>Versioning</h3>
          <p>
            Every save creates an immutable version. Promote a version to production; roll back in
            one command. Runs always reference the exact version that executed, so an audit trail is
            reproducible months later.
          </p>
        </section>

        <section id="code-examples">
          <h2>Code examples</h2>
          <p>
            A workflow is a JSON graph. Below is an invoice-triage workflow: a webhook triggers an
            AI extraction, a conditional route sends large invoices to human approval, and everything
            else posts directly to the ERP.
          </p>
          <CodeBlock filename="workflow.json" language="json" code={workflowSchema} />

          <h3>Define the same workflow as code</h3>
          <p>
            Prefer the terminal? The CLI scaffolds a typed workflow file that compiles to the same
            schema as the canvas.
          </p>
          <CodeBlock
            filename="terminal"
            language="bash"
            code={`$ agentflow init invoice-triage
$ agentflow run
$ agentflow deploy --env production`}
          />

          <Callout type="tip" title="Reference outputs in any downstream node">
            Use <code>{"{{ extract.vendor }}"}</code> anywhere a config field accepts a template —
            HTTP headers, branch rules, AI prompts. The engine resolves templates at the moment a
            node fires, so always-fresh values flow through the graph.
          </Callout>
        </section>

        <section id="best-practices">
          <h2>Best practices</h2>
          <ul className="checklist">
            <li>
              <strong>Keep nodes single-purpose.</strong> One extraction, one branch, one request.
              Small nodes are easier to test, retry, and reuse across workflows.
            </li>
            <li>
              <strong>Always provide a fallback branch.</strong> End conditional routing with a{" "}
              <code>true</code> rule so no run ever dead-ends on an unexpected value.
            </li>
            <li>
              <strong>Cap parallel branches with timeouts.</strong> Fan-out is powerful; a per-branch
              timeout keeps one slow child from stalling the run.
            </li>
            <li>
              <strong>Version before you promote.</strong> Never edit a live version. Save → test →
              promote → roll back if needed.
            </li>
            <li>
              <strong>Templating is data, not code.</strong> Keep expressions deterministic and
              side-effect free so runs stay reproducible.
            </li>
          </ul>
        </section>

        <section id="related">
          <h2>Related documentation</h2>
          <RelatedDocs
            links={[
              { label: "Agents & Memory", href: "/docs/agents", desc: "Invoke LLM agents as nodes" },
              { label: "Execution & Self-healing", href: "/docs/execution", desc: "Scheduler, retries, recovery" },
              { label: "Secrets & Integrations", href: "/docs/integrations", desc: "Scoped credentials + 60+ integrations" },
              { label: "Changelog", href: "/changelog", desc: "What shipped, week by week" },
            ]}
          />
        </section>
      </DocsArticle>
    </MarketingPage>
  );
}