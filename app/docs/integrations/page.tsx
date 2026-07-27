import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/page-shell";
import { DocsArticle } from "@/components/docs/docs-article";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout } from "@/components/docs/callout";
import { ArchitectureDiagram } from "@/components/docs/architecture-diagram";
import { RelatedDocs } from "@/components/docs/related-docs";
import { getDocBySlug } from "@/lib/docs/navigation";

const slug = "integrations";
const meta = getDocBySlug(slug)!;

export const metadata: Metadata = {
  title: "Secrets & Integrations — AgentFlow AI Docs",
  description: meta.description,
  alternates: { canonical: meta.href },
  openGraph: {
    title: "Secrets & Integrations — AgentFlow AI Docs",
    description: meta.description,
    url: meta.href,
  },
};

const secretRef = `{
  "id": "post",
  "type": "http.request",
  "config": {
    "url": "{{ secrets.erp_base_url }}/invoices",
    "headers": {
      "Authorization": "Bearer {{ secrets.erp_token }}"
    },
    "body": { "vendor": "{{ extract.vendor }}", "amount": "{{ extract.amount }}" }
  }
}`;

const oauthConnect = `# Connect an OAuth integration (Gmail example).
POST /api/integrations/connect
{
  "provider": "gmail",
  "scopes": ["send", "read"]
}

→ 200 { "authUrl": "https://accounts.google.com/..." }

# Provider redirects to /api/integrations/callback; the resulting
# access + refresh tokens are encrypted at rest and never logged.`;

export default function IntegrationsDocPage() {
  return (
    <MarketingPage>
      <DocsArticle meta={meta}>
        <section id="overview">
          <h2>Overview</h2>
          <p className="lead">
            Integrations connect your workflows to the outside world — 60+ built-in
            connectors plus a framework for your own. Credentials live in a
            per-workspace vault, encrypted at rest, referenced in nodes by name
            so secrets never touch your graph definitions or logs.
          </p>
          <p>
            OAuth integrations store scoped, refreshable tokens you control. We retain the minimum
            scope required and never log token values. Every integration action is auditable.
          </p>
        </section>

        <section id="architecture">
          <h2>Architecture</h2>
          <p>
            Integrations sit behind a provider-agnostic store. Nodes reference secrets by name; the
            vault decrypts them at execution time inside the isolated runtime.
          </p>
          <ArchitectureDiagram
            caption="Nodes reference secrets by name; the vault resolves and decrypts them only inside the runtime."
            layers={[
              [{ label: "Workflow Node", sub: "{{ secrets.* }} reference", tone: "brand" }],
              [{ label: "Integration Store", sub: "provider-agnostic · OAuth", tone: "ai" }],
              [
                { label: "Secret Vault", sub: "AES-256 at rest", tone: "warning" },
                { label: "OAuth Tokens", sub: "scoped + refreshable", tone: "ai" },
              ],
              [{ label: "Isolated Runtime", sub: "decrypt only at exec", tone: "success" }],
            ]}
          />
        </section>

        <section id="key-concepts">
          <h2>Key concepts</h2>

          <h3>Secrets</h3>
          <p>
            A secret is a named value scoped to a workspace — an API key, a bearer token, a base URL.
            Reference it in any node config with <code>{"{{ secrets.<name> }}"}</code>. The value is
            resolved at execution time and redacted from logs and traces.
          </p>

          <h3>OAuth integrations</h3>
          <p>
            For providers that support OAuth (Gmail, Slack, GitHub, …), AgentFlow runs the
            authorization-code flow end to end. Access and refresh tokens are encrypted at rest; the
            runtime refreshes expired tokens automatically and retries the original action.
          </p>

          <h3>Scopes & least privilege</h3>
          <p>
            Request the narrowest scopes that do the job. A workflow that only sends mail
            shouldn&apos;t have read scope. Scopes are visible per account and revocable from
            settings.
          </p>

          <h3>Custom integrations</h3>
          <p>
            The integration framework mirrors the payments/provider pattern: implement the provider
            interface, register it, and it appears in the node library. MCP servers are exposed to
            agents through the same gateway as built-in tools.
          </p>
        </section>

        <section id="code-examples">
          <h2>Code examples</h2>
          <p>
            Reference vault secrets by name in any node config. The graph stays secret-free and
            safe to commit; the vault resolves <code>erp_token</code> at run time.
          </p>
          <CodeBlock filename="secret-reference.json" language="json" code={secretRef} />

          <h3>Connect an OAuth integration</h3>
          <p>
            The connect endpoint returns an authorization URL; the provider redirects back to the
            callback, which exchanges the code for encrypted tokens.
          </p>
          <CodeBlock filename="oauth.sh" language="bash" code={oauthConnect} />

          <Callout type="warning" title="Never hardcode credentials">
            Put credentials in the vault, not in the graph. A secret literal in a node config is
            stored, versioned, and potentially exported — and it will outlive the rotation you
            forgot to do.
          </Callout>
        </section>

        <section id="best-practices">
          <h2>Best practices</h2>
          <ul className="checklist">
            <li>
              <strong>Reference by name, never by value.</strong> Keep secrets in the vault so the
              graph is safe to version and share.
            </li>
            <li>
              <strong>Request minimal scopes.</strong> The fewer permissions an integration has, the
              smaller the blast radius if a token leaks.
            </li>
            <li>
              <strong>Rotate regularly.</strong> Update a secret in the vault and every workflow
              picks it up on the next run — no graph edits required.
            </li>
            <li>
              <strong>Revoke on offboarding.</strong> Remove integration access from settings when an
              owner leaves; tokens are revocable per account.
            </li>
            <li>
              <strong>Audit integration actions.</strong> Every OAuth action is logged with actor,
              scope, and target — review periodically.
            </li>
          </ul>
        </section>

        <section id="related">
          <h2>Related documentation</h2>
          <RelatedDocs
            links={[
              { label: "Workflows & Nodes", href: "/docs/workflows", desc: "Where secrets are referenced" },
              { label: "Execution & Self-healing", href: "/docs/execution", desc: "Token refresh + retries" },
              { label: "Agents & Memory", href: "/docs/agents", desc: "Tools exposed via the same gateway" },
              { label: "Security", href: "/security", desc: "Encryption, isolation, compliance" },
            ]}
          />
        </section>
      </DocsArticle>
    </MarketingPage>
  );
}