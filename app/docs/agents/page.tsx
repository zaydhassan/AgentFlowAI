

import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/page-shell";
import { DocsArticle } from "@/components/docs/docs-article";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout } from "@/components/docs/callout";
import { ArchitectureDiagram } from "@/components/docs/architecture-diagram";
import { RelatedDocs } from "@/components/docs/related-docs";
import { getDocBySlug } from "@/lib/docs/navigation";

const slug = "agents";
const meta = getDocBySlug(slug)!;

export const metadata: Metadata = {
  title: "Agents & Memory — AgentFlow AI Docs",
  description: meta.description,
  alternates: { canonical: meta.href },
  openGraph: {
    title: "Agents & Memory — AgentFlow AI Docs",
    description: meta.description,
    url: meta.href,
  },
};

const agentNodeSchema = `{
  "id": "research_agent",
  "type": "ai.multiAgent",
  "config": {
    "goal": "Summarize the attached contract and flag unusual clauses.",
    "model": "claude-sonnet-5",
    "tools": ["web.search", "vector.retrieve", "memory.recall"],
    "memory": {
      "collection": "contracts",
      "scope": "workspace",
      "recallTopK": 6
    },
    "maxIterations": 12
  }
}`;

const ragSnippet = `// RAG: retrieve relevant memories, then ground the prompt.
const hits = await memory.search({
  collection: "contracts",
  query: run.inputs.query,
  topK: 6,
});

const prompt = \`
You are a contract analyst. Use ONLY the context below.
If the context is insufficient, say so — do not invent clauses.

Context:
\${hits.map(h => h.text).join("\\n---\\n")}

Contract:
\${run.inputs.contract}
\`;`;

export default function AgentsDocPage() {
  return (
    <MarketingPage>
      <DocsArticle meta={meta}>
        <section id="overview">
          <h2>Overview</h2>
          <p className="lead">
            An agent is an LLM-backed node with tools, memory, and a loop. Drop it
            into a workflow and it will plan, call tools, reason over results,
            and return a structured answer — all observable, all replayable.
          </p>
          <p>
            AgentFlow agents are not black boxes. Every iteration is logged with its prompt, tool
            calls, and token usage, so you can inspect exactly why an agent decided what it did.
            Persistent memory and retrieval (RAG) let an agent carry context across runs without
            stuffing everything into the prompt.
          </p>
        </section>

        <section id="architecture">
          <h2>Architecture</h2>
          <p>
            The multi-agent runtime orchestrates a plan → research/reason → review → execute loop.
            Specialised agents run in parallel where possible, share a memory gateway, and report
            back through a single tool interface.
          </p>
          <ArchitectureDiagram
            caption="The Planner decomposes the goal; research and memory run in parallel; the Reviewer gates execution."
            layers={[
              [{ label: "Planner", sub: "decompose goal", tone: "ai" }],
              [
                { label: "Research Agent", sub: "web + tools", tone: "ai" },
                { label: "Memory Agent", sub: "recall + RAG", tone: "brand" },
                { label: "Reasoning Agent", sub: "synthesis", tone: "ai" },
              ],
              [{ label: "Reviewer", sub: "gate + critique", tone: "warning" }],
              [{ label: "Executor", sub: "structured output", tone: "success" }],
            ]}
          />
        </section>

        <section id="key-concepts">
          <h2>Key concepts</h2>

          <h3>Tools</h3>
          <p>
            Tools are the agent&apos;s hands. They are exposed through a single gateway (
            <code>AgentToolGateway</code>) so MCP servers, built-in integrations, and custom
            functions all look identical to the model. Grant an agent a scoped tool list per node.
          </p>

          <h3>Memory</h3>
          <p>
            Memory is a vector store keyed by workspace. An agent can{" "}
            <code>recall</code> relevant past context and <code>remember</code> new facts. The
            <code> AgentMemoryGateway</code> always goes through the <code>MemoryEngine</code> — it
            never bypasses access controls or embeddings.
          </p>

          <h3>Retrieval (RAG)</h3>
          <p>
            RAG is just memory + a prompt. Retrieve the top-K relevant chunks for the query, then
            ground the model on them with an explicit instruction to use only that context. This
            keeps answers faithful and the prompt small.
          </p>

          <h3>Iteration & guardrails</h3>
          <p>
            Each agent run is bounded by <code>maxIterations</code> and a per-call timeout. The
            Reviewer agent critiques outputs before they are committed, catching hallucinations and
            tool misuse before they reach downstream nodes.
          </p>
        </section>

        <section id="code-examples">
          <h2>Code examples</h2>
          <p>
            Add an agent to a workflow with the <code>ai.multiAgent</code> node. This agent reviews a
            contract, retrieves similar past contracts from memory, and uses web search when it needs
            outside context.
          </p>
          <CodeBlock filename="agent-node.json" language="json" code={agentNodeSchema} />

          <h3>Grounding a prompt with retrieval</h3>
          <p>
            The retrieval pattern itself is a few lines — search memory, then build a grounded
            prompt that forbids invention.
          </p>
          <CodeBlock filename="rag.ts" language="typescript" code={ragSnippet} />

          <Callout type="warning" title="Always bound the loop">
            Set <code>maxIterations</code> on every agent. Without a cap, a confused model can loop
            indefinitely on tool calls, burning tokens and stalling the run.
          </Callout>
        </section>

        <section id="best-practices">
          <h2>Best practices</h2>
          <ul className="checklist">
            <li>
              <strong>Scope the tool list.</strong> Give an agent only the tools it needs. Fewer
              tools means fewer ways to go wrong and cheaper prompts.
            </li>
            <li>
              <strong>Ground before you generate.</strong> Retrieve relevant context and instruct the
              model to use only it. Faithfulness beats fluency.
            </li>
            <li>
              <strong>Let the Reviewer gate output.</strong> A second pass that critiques before
              commit catches most hallucinations cheaply.
            </li>
            <li>
              <strong>Remember sparingly.</strong> Store distilled facts, not raw transcripts. Memory
              is for reuse, not for hoarding.
            </li>
            <li>
              <strong>Prefer structured output.</strong> Have agents return typed objects so
              downstream nodes can route on fields, not parse prose.
            </li>
          </ul>
        </section>

        <section id="related">
          <h2>Related documentation</h2>
          <RelatedDocs
            links={[
              { label: "Workflows & Nodes", href: "/docs/workflows", desc: "The graph agents live inside" },
              { label: "Execution & Self-healing", href: "/docs/execution", desc: "Retries and recovery for agent runs" },
              { label: "Secrets & Integrations", href: "/docs/integrations", desc: "Scoped tool credentials" },
              { label: "Security", href: "/security", desc: "Memory isolation + encryption" },
            ]}
          />
        </section>
      </DocsArticle>
    </MarketingPage>
  );
}