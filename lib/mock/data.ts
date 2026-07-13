import type {
  Workflow,
  Execution,
  Template,
  CopilotSuggestion,
  AgentRun,
  AuditLogEntry,
  TeamMember,
  Notification,
} from "../types";

// ============================================================
// Mock datasets — realistic enough to feel like a real product
// ============================================================

const now = Date.now();
const iso = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString();

export const dashboardStats = {
  totalExecutions: 184293,
  activeWorkflows: 47,
  runningAgents: 12,
  apiUsage: 9_820_413,
  creditsRemaining: 142_500,
  monthlyUsage: 78,
  errorRate: 1.8,
  successRate: 98.2,
  monthlyCost: 4820.45,
  tokenUsage: 842_193_402,
  workflowsHealth: 96,
};

// 14-day execution volume + cost
export const executionTrend = Array.from({ length: 14 }, (_, i) => {
  const day = 13 - i;
  const base = 12000 + Math.sin(i * 0.7) * 3000;
  const jitter = ((i * 9301 + 49297) % 233280) / 233280 * 2500;
  const execs = Math.round(base + jitter);
  return {
    date: new Date(now - day * 86_400_000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    executions: execs,
    success: Math.round(execs * (0.96 + ((i * 7) % 4) / 100)),
    failures: Math.round(execs * (0.018 + ((i * 3) % 5) / 200)),
    cost: Math.round((execs * 0.041) * 100) / 100,
    tokens: Math.round(execs * 4200 + jitter * 200),
  };
});

export const tokenBreakdown = [
  { name: "OpenAI", value: 412_000_000, color: "#10a37f" },
  { name: "Claude", value: 268_000_000, color: "#d97706" },
  { name: "Gemini", value: 102_000_000, color: "#4285f4" },
  { name: "Local", value: 60_000_000, color: "#64748b" },
];

export const costByCategory = [
  { name: "AI inference", value: 2840, color: "#7c5cff" },
  { name: "API calls", value: 980, color: "#22d3ee" },
  { name: "Storage", value: 420, color: "#10a98f" },
  { name: "Compute", value: 580, color: "#f59e0b" },
];

export const recentActivity = [
  { id: "a1", text: "Invoice Processing workflow executed successfully", time: iso(2), type: "success", icon: "FileText" },
  { id: "a2", text: "AI Router selected Claude Opus for reasoning task", time: iso(6), type: "info", icon: "Route" },
  { id: "a3", text: "Self-healing retried Gmail node after auth refresh", time: iso(11), type: "warning", icon: "Wrench" },
  { id: "a4", text: "Lead Generation workflow triggered by webhook", time: iso(14), type: "info", icon: "Webhook" },
  { id: "a5", text: "Memory Agent stored 4 new business context items", time: iso(23), type: "info", icon: "Brain" },
  { id: "a6", text: "CRM Sync failed at step 3 — quota exceeded", time: iso(31), type: "error", icon: "AlertTriangle" },
  { id: "a7", text: "New workflow 'Sales Outreach' published by Maya Chen", time: iso(48), type: "info", icon: "Sparkles" },
  { id: "a8", text: "Research Agent summarized 12 docs for Q3 report", time: iso(67), type: "info", icon: "Search" },
];

export const workflows: Workflow[] = [
  {
    id: "wf_invoice",
    name: "Invoice Processing",
    description: "Extract invoice data from Gmail, save to Postgres, notify Slack, generate monthly report.",
    status: "active",
    category: "Finance",
    lastRun: iso(2),
    schedule: "Every 5 min",
    health: 98,
    tags: ["finance", "ai", "ocr"],
    version: 12,
    createdBy: "Maya Chen",
    nodes: [
      { id: "n1", type: "trigger.schedule", position: { x: 40, y: 120 }, data: { label: "Schedule", config: { cron: "*/5 * * * *" } } },
      { id: "n2", type: "gmail.search", position: { x: 280, y: 40 }, data: { label: "Gmail Search", config: { query: "subject:invoice" } } },
      { id: "n3", type: "ai.claude", position: { x: 540, y: 40 }, data: { label: "Claude Extract", config: { model: "claude-opus-4-8" } } },
      { id: "n4", type: "doc.ocr", position: { x: 540, y: 220 }, data: { label: "OCR Backup", config: {} } },
      { id: "n5", type: "store.postgres", position: { x: 820, y: 40 }, data: { label: "Postgres", config: { table: "invoices" } } },
      { id: "n6", type: "cloud.s3", position: { x: 820, y: 220 }, data: { label: "S3 Archive", config: { bucket: "invoices" } } },
      { id: "n7", type: "comm.slack", position: { x: 1120, y: 40 }, data: { label: "Slack Notify", config: { channel: "#finance" } } },
      { id: "n8", type: "ai.prompt", position: { x: 1120, y: 220 }, data: { label: "Monthly Report", config: {} } },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n3" },
      { id: "e3", source: "n2", target: "n4" },
      { id: "e3b", source: "n3", target: "n5" },
      { id: "e4", source: "n4", target: "n6" },
      { id: "e5", source: "n5", target: "n7" },
      { id: "e6", source: "n5", target: "n8" },
    ],
  },
  {
    id: "wf_leadgen",
    name: "Lead Generation",
    description: "Enrich inbound leads with AI research and route qualified leads to sales.",
    status: "active",
    category: "Sales",
    lastRun: iso(14),
    schedule: "On webhook",
    health: 94,
    tags: ["sales", "ai", "crm"],
    version: 7,
    createdBy: "Jordan Pike",
    nodes: [
      { id: "n1", type: "trigger.webhook", position: { x: 40, y: 160 }, data: { label: "Webhook", config: {} } },
      { id: "n2", type: "ai.agent", position: { x: 280, y: 160 }, data: { label: "Research Agent", config: {} } },
      { id: "n3", type: "ai.router", position: { x: 540, y: 160 }, data: { label: "AI Router", config: {} } },
      { id: "n4", type: "util.condition", position: { x: 820, y: 80 }, data: { label: "Qualified?", config: {} } },
      { id: "n5", type: "comm.slack", position: { x: 1100, y: 40 }, data: { label: "Slack", config: { channel: "#sales" } } },
      { id: "n6", type: "store.supabase", position: { x: 1100, y: 220 }, data: { label: "Supabase", config: { table: "leads" } } },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n3" },
      { id: "e3", source: "n3", target: "n4" },
      { id: "e4", source: "n4", target: "n5" },
      { id: "e5", source: "n4", target: "n6" },
    ],
  },
  {
    id: "wf_support",
    name: "Customer Support Triage",
    description: "Classify, summarize, and route support tickets to the right agent.",
    status: "active",
    category: "Support",
    lastRun: iso(1),
    schedule: "Continuous",
    health: 99,
    tags: ["support", "ai", "router"],
    version: 21,
    createdBy: "Maya Chen",
    nodes: [],
    edges: [],
  },
  {
    id: "wf_email",
    name: "AI Email Assistant",
    description: "Draft, schedule, and send personalized email replies with memory.",
    status: "active",
    category: "Productivity",
    lastRun: iso(8),
    schedule: "Every 10 min",
    health: 92,
    tags: ["email", "ai", "memory"],
    version: 9,
    createdBy: "Sam Rivera",
    nodes: [],
    edges: [],
  },
  {
    id: "wf_github",
    name: "GitHub Automation",
    description: "Auto-triage issues, label PRs, and summarize diffs with AI.",
    status: "paused",
    category: "DevOps",
    lastRun: iso(320),
    schedule: "On webhook",
    health: 87,
    tags: ["github", "devops", "ai"],
    version: 4,
    createdBy: "Jordan Pike",
    nodes: [],
    edges: [],
  },
  {
    id: "wf_onboarding",
    name: "HR Onboarding",
    description: "Provision accounts, send welcome sequences, and track completion.",
    status: "active",
    category: "HR",
    lastRun: iso(45),
    schedule: "Daily 9am",
    health: 95,
    tags: ["hr", "automation"],
    version: 6,
    createdBy: "Sam Rivera",
    nodes: [],
    edges: [],
  },
  {
    id: "wf_crm",
    name: "CRM Sync",
    description: "Two-way sync between Supabase and HubSpot with conflict resolution.",
    status: "error",
    category: "Sales",
    lastRun: iso(31),
    schedule: "Every 30 min",
    health: 41,
    tags: ["crm", "sync"],
    version: 3,
    createdBy: "Jordan Pike",
    nodes: [],
    edges: [],
  },
  {
    id: "wf_meeting",
    name: "Meeting Notes",
    description: "Transcribe, summarize, and assign action items from meetings.",
    status: "draft",
    category: "Productivity",
    lastRun: iso(1440),
    schedule: "Manual",
    health: 100,
    tags: ["notes", "ai"],
    version: 1,
    createdBy: "Maya Chen",
    nodes: [],
    edges: [],
  },
];

export const executions: Execution[] = [
  {
    id: "ex_8842",
    workflowId: "wf_invoice",
    workflowName: "Invoice Processing",
    status: "succeeded",
    startedAt: iso(2),
    durationMs: 18420,
    trigger: "schedule",
    retried: 0,
    totalTokens: 18420,
    totalCost: 0.42,
    steps: [
      { id: "s1", nodeId: "n1", nodeName: "Schedule", status: "succeeded", startedAt: iso(2), durationMs: 12, logs: ["Cron tick fired"], retries: 0 },
      { id: "s2", nodeId: "n2", nodeName: "Gmail", status: "succeeded", startedAt: iso(2), durationMs: 1820, logs: ["Fetched 3 matching threads"], retries: 0, tokensUsed: 0 },
      { id: "s3", nodeId: "n3", nodeName: "Claude Extract", status: "succeeded", startedAt: iso(2), durationMs: 9800, logs: ["Extracted: vendor, total, due_date", "Confidence 0.97"], retries: 0, tokensUsed: 8420, cost: 0.31, reasoning: ["Identify invoice fields", "Parse totals", "Validate due date"] },
      { id: "s4", nodeId: "n5", nodeName: "Postgres", status: "succeeded", startedAt: iso(2), durationMs: 240, logs: ["INSERT 3 rows into invoices"], retries: 0 },
      { id: "s5", nodeId: "n7", nodeName: "Slack Notify", status: "succeeded", startedAt: iso(1), durationMs: 320, logs: ["Posted to #finance"], retries: 0 },
    ],
  },
  {
    id: "ex_8841",
    workflowId: "wf_support",
    workflowName: "Customer Support Triage",
    status: "running",
    startedAt: iso(0),
    durationMs: 0,
    trigger: "webhook",
    retried: 0,
    totalTokens: 0,
    totalCost: 0,
    steps: [],
  },
  {
    id: "ex_8840",
    workflowId: "wf_leadgen",
    workflowName: "Lead Generation",
    status: "failed",
    startedAt: iso(14),
    durationMs: 31200,
    trigger: "webhook",
    retried: 2,
    totalTokens: 6200,
    totalCost: 0.18,
    steps: [
      { id: "s1", nodeId: "n1", nodeName: "Webhook", status: "succeeded", startedAt: iso(14), durationMs: 8, logs: ["POST /hooks/lead"], retries: 0 },
      { id: "s2", nodeId: "n2", nodeName: "Research Agent", status: "failed", startedAt: iso(14), durationMs: 22000, logs: ["Browsing company site", "Rate limit hit on data provider"], retries: 2, reasoning: ["Search company domain", "Enrich with firmographics"] },
    ],
  },
  {
    id: "ex_8839",
    workflowId: "wf_crm",
    workflowName: "CRM Sync",
    status: "failed",
    startedAt: iso(31),
    durationMs: 9800,
    trigger: "schedule",
    retried: 1,
    totalTokens: 0,
    totalCost: 0,
    steps: [
      { id: "s1", nodeId: "n1", nodeName: "Supabase Fetch", status: "succeeded", startedAt: iso(31), durationMs: 410, logs: ["Fetched 240 rows"], retries: 0 },
      { id: "s2", nodeId: "n3", nodeName: "HubSpot Update", status: "failed", startedAt: iso(31), durationMs: 9300, logs: ["Quota exceeded (402)"], retries: 1 },
    ],
  },
  {
    id: "ex_8838",
    workflowId: "wf_email",
    workflowName: "AI Email Assistant",
    status: "succeeded",
    startedAt: iso(8),
    durationMs: 12400,
    trigger: "schedule",
    retried: 0,
    totalTokens: 12400,
    totalCost: 0.22,
    steps: [],
  },
];

export const templates: Template[] = [
  { id: "t1", name: "Lead Generation", description: "Capture, enrich, and route inbound leads with AI research.", category: "Sales", icon: "UserPlus", color: "#7c5cff", nodeCount: 6, installs: 12480, rating: 4.9, author: "AgentFlow", tags: ["sales", "ai"], featured: true },
  { id: "t2", name: "Invoice Processing", description: "Extract, validate, and archive invoices end-to-end.", category: "Finance", icon: "FileText", color: "#10a37f", nodeCount: 8, installs: 9820, rating: 4.8, author: "AgentFlow", tags: ["finance", "ocr"], featured: true },
  { id: "t3", name: "Customer Support", description: "Triage, summarize, and assign support tickets automatically.", category: "Support", icon: "Headphones", color: "#22d3ee", nodeCount: 7, installs: 15320, rating: 4.9, author: "AgentFlow", tags: ["support", "router"], featured: true },
  { id: "t4", name: "AI Email Assistant", description: "Personalized replies with long-term memory.", category: "Productivity", icon: "Mail", color: "#a855f7", nodeCount: 5, installs: 21400, rating: 4.7, author: "AgentFlow", tags: ["email", "memory"] },
  { id: "t5", name: "GitHub Automation", description: "Triage issues, label PRs, summarize diffs.", category: "DevOps", icon: "Github", color: "#64748b", nodeCount: 6, installs: 7210, rating: 4.6, author: "AgentFlow", tags: ["github", "devops"] },
  { id: "t6", name: "HR Onboarding", description: "Provision accounts and run welcome sequences.", category: "HR", icon: "Users", color: "#f59e0b", nodeCount: 9, installs: 5410, rating: 4.5, author: "AgentFlow", tags: ["hr"] },
  { id: "t7", name: "CRM Sync", description: "Two-way CRM sync with conflict resolution.", category: "Sales", icon: "RefreshCw", color: "#0ea5e9", nodeCount: 4, installs: 6120, rating: 4.4, author: "AgentFlow", tags: ["crm", "sync"] },
  { id: "t8", name: "Sales Outreach", description: "Multi-touch personalized outreach sequences.", category: "Sales", icon: "Send", color: "#ef4444", nodeCount: 7, installs: 8930, rating: 4.7, author: "AgentFlow", tags: ["sales", "outreach"] },
  { id: "t9", name: "Meeting Notes", description: "Transcribe, summarize, assign action items.", category: "Productivity", icon: "StickyNote", color: "#8b5cf6", nodeCount: 5, installs: 11200, rating: 4.6, author: "AgentFlow", tags: ["notes", "ai"] },
  { id: "t10", name: "Document Processing", description: "Parse, classify, and extract from mixed documents.", category: "Finance", icon: "Files", color: "#e11d48", nodeCount: 6, installs: 4720, rating: 4.5, author: "AgentFlow", tags: ["docs", "ocr"] },
  { id: "t11", name: "Financial Reports", description: "Aggregate and generate monthly financial reports.", category: "Finance", icon: "BarChart3", color: "#10a98f", nodeCount: 8, installs: 3210, rating: 4.4, author: "AgentFlow", tags: ["finance", "reports"] },
  { id: "t12", name: "Social Media Posting", description: "Plan, generate, and schedule cross-platform posts.", category: "Marketing", icon: "Share2", color: "#ec4899", nodeCount: 6, installs: 6780, rating: 4.5, author: "AgentFlow", tags: ["social", "marketing"] },
];

export const copilotSuggestions: CopilotSuggestion[] = [
  { id: "c1", kind: "missing-node", title: "Add error handling after Postgres", description: "Your write step has no failure path. A condition + retry node would prevent silent data loss.", severity: "warning", action: "Add branch" },
  { id: "c2", kind: "cost", title: "Switch routine extraction to Haiku", description: "94% of invoice extractions are low-complexity. Routing them to Claude Haiku saves ~62% on this workflow.", severity: "info", action: "Optimize" },
  { id: "c3", kind: "architecture", title: "Parallelize OCR and LLM extraction", description: "These two nodes are independent and currently run sequentially. Running them in parallel cuts latency ~40%.", severity: "info", action: "Refactor" },
  { id: "c4", kind: "security", title: "Slack token is not in Secrets Manager", description: "A workspace secret is referenced inline. Move it to the Secrets Manager to rotate safely.", severity: "critical", action: "Secure" },
  { id: "c5", kind: "performance", title: "Add caching to the Research Agent", description: "Repeated company lookups hit the provider every run. A 1h Redis cache reduces external calls ~70%.", severity: "info", action: "Add cache" },
  { id: "c6", kind: "self-heal", title: "Self-heal recovered 2 failures this week", description: "The Gmail node failed twice due to expired OAuth. Self-healing refreshed tokens and retried successfully.", severity: "info" },
];

export const agentRuns: AgentRun[] = [
  {
    id: "ar1",
    agent: "planner",
    status: "running",
    task: "Break down: 'Process all Q3 invoices and generate a summary report'",
    startedAt: iso(0),
    durationMs: 0,
    steps: [
      { label: "Parse request", detail: "Understood goal: invoice batch + report", status: "done" },
      { label: "Decompose into tasks", detail: "6 subtasks identified", status: "active" },
      { label: "Assign nodes", detail: "Map tasks to workflow nodes", status: "pending" },
      { label: "Estimate cost & time", detail: "~$4.20, ~3m", status: "pending" },
    ],
  },
  {
    id: "ar2",
    agent: "research",
    status: "done",
    task: "Summarize 12 Confluence docs on refund policy",
    startedAt: iso(12),
    durationMs: 24800,
    steps: [
      { label: "Browsed docs", detail: "Fetched 12 pages", status: "done" },
      { label: "Extract sections", detail: "48 sections parsed", status: "done" },
      { label: "Synthesize", detail: "1,200-word summary", status: "done" },
    ],
  },
  {
    id: "ar3",
    agent: "memory",
    status: "done",
    task: "Recall user preference: reports always in EUR",
    startedAt: iso(40),
    durationMs: 320,
    steps: [
      { label: "Query memory", detail: "Hit long-term store", status: "done" },
      { label: "Return context", detail: "currency=EUR", status: "done" },
    ],
  },
  {
    id: "ar4",
    agent: "router",
    status: "done",
    task: "Route: classify support ticket + draft reply",
    startedAt: iso(3),
    durationMs: 5200,
    steps: [
      { label: "Analyze task", detail: "Reasoning + drafting", status: "done" },
      { label: "Select model", detail: "Claude Opus (reasoning)", status: "done" },
      { label: "Execute", detail: "Routed to ai.claude", status: "done" },
    ],
  },
];

export const auditLogs: AuditLogEntry[] = [
  { id: "al1", actor: "Maya Chen", action: "Published workflow", target: "Invoice Processing v12", timestamp: iso(120), ip: "10.0.4.22" },
  { id: "al2", actor: "Jordan Pike", action: "Rotated secret", target: "SLACK_BOT_TOKEN", timestamp: iso(240), ip: "10.0.4.88" },
  { id: "al3", actor: "system", action: "Self-heal retried", target: "ex_8840 / Research Agent", timestamp: iso(31), ip: "internal" },
  { id: "al4", actor: "Sam Rivera", action: "Invited member", target: "alex@acme.io (Editor)", timestamp: iso(360), ip: "10.0.4.14" },
  { id: "al5", actor: "Maya Chen", action: "Changed role", target: "Sam Rivera → Admin", timestamp: iso(600), ip: "10.0.4.22" },
  { id: "al6", actor: "system", action: "API key created", target: "prod-key-2f8a", timestamp: iso(1440), ip: "internal" },
];

export const teamMembers: TeamMember[] = [
  { id: "u1", name: "Maya Chen", email: "maya@acme.io", role: "Owner", avatar: "MC", lastActive: iso(2) },
  { id: "u2", name: "Jordan Pike", email: "jordan@acme.io", role: "Admin", avatar: "JP", lastActive: iso(14) },
  { id: "u3", name: "Sam Rivera", email: "sam@acme.io", role: "Editor", avatar: "SR", lastActive: iso(45) },
  { id: "u4", name: "Alex Kim", email: "alex@acme.io", role: "Editor", avatar: "AK", lastActive: iso(360) },
  { id: "u5", name: "Priya Nair", email: "priya@acme.io", role: "Viewer", avatar: "PN", lastActive: iso(1440) },
];

export const notifications: Notification[] = [
  { id: "n1", title: "Workflow self-healed", body: "Invoice Processing recovered after Gmail token refresh.", type: "success", timestamp: iso(11), read: false },
  { id: "n2", title: "Action required", body: "CRM Sync failed: HubSpot quota exceeded. Review now.", type: "error", timestamp: iso(31), read: false },
  { id: "n3", title: "Credits low", body: "You've used 78% of your monthly credits.", type: "warning", timestamp: iso(60), read: false },
  { id: "n4", title: "New template", body: "Financial Reports template is now available.", type: "info", timestamp: iso(200), read: true },
];

export const orgInfo = {
  name: "Acme Robotics",
  plan: "Business",
  seats: 12,
  seatsUsed: 5,
  credits: 142500,
  region: "us-east-1",
  sso: false,
};