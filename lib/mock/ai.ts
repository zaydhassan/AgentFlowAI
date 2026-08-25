import { NODE_LIBRARY, getNodeDef } from "../nodes";
import type { WorkflowNode, WorkflowEdge, CopilotSuggestion } from "../types";

// Naive intent matcher over the node library.
function detectNode(p: string, i: number): string | null {
  const t = p.toLowerCase();
  const map: { keys: string[]; type: string }[] = [
    { keys: ["gmail", "email", "mail"], type: "gmail.search" },
    { keys: ["outlook"], type: "comm.outlook" },
    { keys: ["slack"], type: "comm.slack" },
    { keys: ["discord"], type: "comm.discord" },
    { keys: ["telegram"], type: "comm.telegram" },
    { keys: ["whatsapp"], type: "comm.whatsapp" },
    { keys: ["openai", "gpt", "chatgpt"], type: "ai.openai" },
    { keys: ["claude", "anthropic"], type: "ai.claude" },
    { keys: ["gemini", "google ai"], type: "ai.gemini" },
    { keys: ["extract", "parse", "summarize", "understand", "reason", "draft", "generate", "write", "classify"], type: "ai.claude" },
    { keys: ["agent", "research", "browse", "investigate"], type: "ai.agent" },
    { keys: ["router", "route", "best model"], type: "ai.router" },
    { keys: ["memory", "remember", "context", "preference"], type: "ai.memory" },
    { keys: ["rag", "documents", "knowledge", "notion", "confluence", "sharepoint"], type: "ai.rag" },
    { keys: ["postgres", "postgresql", "database", "save", "store"], type: "store.postgres" },
    { keys: ["mysql"], type: "store.mysql" },
    { keys: ["mongo", "mongodb"], type: "store.mongo" },
    { keys: ["redis", "cache"], type: "store.redis" },
    { keys: ["supabase"], type: "store.supabase" },
    { keys: ["firebase", "firestore"], type: "store.firebase" },
    { keys: ["pdf"], type: "doc.pdf" },
    { keys: ["docx", "word"], type: "doc.docx" },
    { keys: ["excel", "spreadsheet"], type: "doc.excel" },
    { keys: ["csv"], type: "doc.csv" },
    { keys: ["ocr", "image", "scan"], type: "doc.ocr" },
    { keys: ["rest", "api", "endpoint"], type: "dev.rest" },
    { keys: ["graphql"], type: "dev.graphql" },
    { keys: ["javascript", "js "], type: "dev.javascript" },
    { keys: ["python"], type: "dev.python" },
    { keys: ["s3", "upload to", "drive", "google drive"], type: "cloud.s3" },
    { keys: ["aws"], type: "cloud.aws" },
    { keys: ["azure"], type: "cloud.azure" },
    { keys: ["gcp", "google cloud"], type: "cloud.gcp" },
    { keys: ["github"], type: "dev.rest" },
    { keys: ["delay", "wait"], type: "util.delay" },
    { keys: ["if", "condition", "when", "qualified", "check"], type: "util.condition" },
    { keys: ["switch", "branch to", "route to"], type: "util.switch" },
    { keys: ["transform", "format", "map"], type: "util.transform" },
    { keys: ["loop", "for each", "iterate", "each"], type: "util.loop" },
  ];
  for (const m of map) {
    if (m.keys.some((k) => t.includes(k))) return m.type;
  }
  return null;
}

export interface NLPlan {
  plan: string[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  reasoning: string;
}

// Break a natural-language prompt into sentences / clauses.
function splitInstructions(prompt: string): string[] {
  return prompt
    .replace(/\n+/g, ". ")
    .split(/[.\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function generateWorkflowFromPrompt(prompt: string): NLPlan {
  const instructions = splitInstructions(prompt);

  // Trigger detection
  const lower = prompt.toLowerCase();
  let triggerType = "trigger.webhook";
  if (lower.includes("every") || lower.includes("schedule") || lower.includes("cron") || lower.includes("daily") || lower.includes("each")) {
    triggerType = "trigger.schedule";
  }
  const triggerDef = getNodeDef(triggerType)!;

  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];
  const plan: string[] = [];

  // Trigger node
  nodes.push({
    id: "g1",
    type: triggerType,
    position: { x: 40, y: 200 },
    data: { label: triggerDef.label, config: triggerDef.defaultConfig ?? {} },
  });
  plan.push(`Trigger: ${triggerDef.label}`);

  let lastId = "g1";
  let idx = 2;
  const seen = new Set<string>();

  for (const ins of instructions) {
    const type = detectNode(ins, idx);
    if (!type) {
      plan.push(`(skipped) "${ins}"`);
      continue;
    }
    if (seen.has(type)) {
      plan.push(`Reused ${getNodeDef(type)!.label} for: "${ins}"`);
      continue;
    }
    seen.add(type);
    const def = getNodeDef(type)!;
    const id = `g${idx}`;
    const col = (idx - 1) % 3;
    const row = Math.floor((idx - 1) / 3);
    nodes.push({
      id,
      type,
      position: { x: 40 + col * 280, y: 40 + row * 180 },
      data: { label: def.label, config: def.defaultConfig ?? {} },
    });
    edges.push({ id: `e${lastId}-${id}`, source: lastId, target: id, animated: true });
    plan.push(`Step ${idx - 1}: ${def.label} — ${ins}`);
    lastId = id;
    idx++;
  }

  const reasoning = `I analyzed your request and identified ${nodes.length - 1} action${
    nodes.length === 2 ? "" : "s"
  }. I chose a ${triggerDef.label} trigger, sequenced the steps in dependency order, and connected them with validated edges. ${nodes.length > 3 ? "Independent steps could be parallelized — the Copilot will suggest this." : ""}`;

  return { plan, nodes, edges, reasoning };
}

export function mockCopilotReply(question: string): string {
  const q = question.toLowerCase();
  if (q.includes("cost") || q.includes("cheap") || q.includes("save"))
    return "Routing low-complexity extractions to a smaller model (e.g. Claude Haiku 4.5 or GPT-4.1-mini) typically cuts this workflow's inference cost by ~60% with no quality loss on routine inputs. I can add an AI Router node to dispatch by estimated complexity.";
  if (q.includes("fail") || q.includes("error") || q.includes("retry"))
    return "For the failing node I'd add: (1) an exponential-backoff retry policy, (2) a self-healing branch that refreshes credentials before retrying, and (3) a dead-letter write to Postgres so no run is silently lost. Want me to wire these in?";
  if (q.includes("parallel") || q.includes("fast") || q.includes("latency"))
    return "OCR and LLM extraction are independent — running them in parallel should cut end-to-end latency by ~40%. I can split the branch right after the Gmail node and merge before the Postgres write.";
  if (q.includes("secur") || q.includes("token") || q.includes("secret"))
    return "Move any inline credentials to the Secrets Manager and reference them by key. I detected one Slack token referenced inline — rotating it into a managed secret removes the risk and enables safe rotation.";
  if (q.includes("missing") || q.includes("add") || q.includes("improve"))
    return "I see a few improvements: add error handling after storage writes, cache the Research Agent's external lookups, and an AI Router to pick the best model per step. I can apply any of these.";
  return "I can help optimize this workflow — cost, latency, reliability, or security. For example, I'd add an AI Router to dispatch by complexity and a self-healing branch for credential expiry. Tell me which direction matters most.";
}

export function selfHealSuggestions(errorText: string): CopilotSuggestion[] {
  const e = errorText.toLowerCase();
  if (e.includes("401") || e.includes("auth") || e.includes("token") || e.includes("unauthorized"))
    return [
      { id: "h1", kind: "self-heal", title: "Refresh OAuth token", description: "The credential expired. Self-healing can refresh it and retry without manual intervention.", severity: "info", action: "Auto-fix & retry" },
      { id: "h2", kind: "self-heal", title: "Rotate secret", description: "If refresh fails, rotate the secret in Secrets Manager and reconnect.", severity: "warning", action: "Rotate" },
    ];
  if (e.includes("429") || e.includes("rate") || e.includes("quota") || e.includes("too many"))
    return [
      { id: "h1", kind: "self-heal", title: "Exponential backoff", description: "Provider rate-limited the request. Retry with jittered backoff (2s, 4s, 8s).", severity: "info", action: "Retry with backoff" },
      { id: "h2", kind: "self-heal", title: "Add Redis cache", description: "Cache repeated lookups to reduce external call volume ~70%.", severity: "warning", action: "Add cache" },
    ];
  if (e.includes("timeout") || e.includes("timed out"))
    return [
      { id: "h1", kind: "self-heal", title: "Increase timeout", description: "The node exceeded the default 30s. Raise to 90s for this step.", severity: "info", action: "Apply" },
      { id: "h2", kind: "self-heal", title: "Parallelize", description: "Split heavy work across branches to stay under the timeout.", severity: "info", action: "Refactor" },
    ];
  return [
    { id: "h1", kind: "self-heal", title: "Inspect logs", description: "Capture the full stack and correlate with the failing node's last input.", severity: "info", action: "View logs" },
    { id: "h2", kind: "self-heal", title: "Retry safely", description: "Retry idempotently after validating upstream state.", severity: "info", action: "Retry" },
  ];
}