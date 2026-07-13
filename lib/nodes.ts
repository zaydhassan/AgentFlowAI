import type { NodeDef, ConfigField } from "./types";

// ============================================================
// Node Library — 12 categories, each node carries a configSchema
// that drives the inspector form, plus metrics flags.
// `type` strings keep their original prefixes so existing seed
// workflows and the execution engine keep resolving them.
// ============================================================

const f = (
  key: string,
  label: string,
  type: ConfigField["type"],
  extra: Partial<ConfigField> = {},
): ConfigField => ({ key, label, type, ...extra });

// Long-term memory config appended to every AI node. Opt-in: useMemory defaults
// off so existing workflows are unchanged. The execution engine gates the
// retrieve→inject→generate→store branch on config.useMemory === true.
const MEMORY_FIELDS: ConfigField[] = [
  f("useMemory", "Use memory", "boolean", { default: false, help: "Retrieve relevant long-term memories before generating, then store this exchange." }),
  f("memoryScope", "Memory scope", "select", { options: [
    { label: "Short-term", value: "short_term" },
    { label: "Conversation", value: "conversation" },
    { label: "Long-term", value: "long_term" },
    { label: "Workflow", value: "workflow" },
    { label: "Agent", value: "agent" },
    { label: "Workspace", value: "workspace" },
  ], default: "long_term" }),
  f("memoryImportance", "Importance", "select", { options: [
    { label: "Low", value: "0.3" },
    { label: "Medium", value: "0.6" },
    { label: "High", value: "0.8" },
    { label: "Critical", value: "1.0" },
  ], default: "0.6", help: "Weight used by the memory manager to promote/expire this memory." }),
];

export const NODE_LIBRARY: NodeDef[] = [
  // ---- Scheduling (triggers) ----
  {
    type: "trigger.schedule", label: "Schedule", category: "scheduling",
    description: "Run on a cron schedule", icon: "Clock", color: "#f472b6", inputs: 0, outputs: 1,
    defaultConfig: { cron: "0 9 * * *" },
    configSchema: [
      f("cron", "Cron expression", "text", { required: true, default: "0 9 * * *", placeholder: "0 9 * * *", help: "Standard 5-field cron (min hour dom month dow)" }),
      f("timezone", "Timezone", "text", { default: "UTC", placeholder: "America/New_York" }),
    ],
  },
  {
    type: "trigger.webhook", label: "Webhook", category: "scheduling",
    description: "Start on an incoming HTTP webhook", icon: "Webhook", color: "#f472b6", inputs: 0, outputs: 1,
    configSchema: [
      f("method", "Method", "select", { options: ["GET", "POST", "PUT", "DELETE"].map((v) => ({ label: v, value: v })), default: "POST" }),
      f("path", "Path", "text", { default: "/hook", placeholder: "/incoming" }),
      f("secret", "Signing secret", "secret", { help: "Verifies the X-Signature header" }),
    ],
  },
  {
    type: "trigger.manual", label: "Manual", category: "scheduling",
    description: "Run on demand", icon: "Play", color: "#f472b6", inputs: 0, outputs: 1,
    configSchema: [f("payload", "Run payload (JSON)", "code", { default: "{}" })],
  },
  {
    type: "trigger.event", label: "Event", category: "scheduling",
    description: "React to a platform event", icon: "Zap", color: "#f472b6", inputs: 0, outputs: 1,
    configSchema: [
      f("event", "Event name", "select", { options: ["workflow.completed", "workflow.failed", "node.error", "manual"].map((v) => ({ label: v, value: v })) }),
    ],
  },
  {
    type: "trigger.interval", label: "Interval", category: "scheduling",
    description: "Run every N seconds", icon: "Repeat", color: "#f472b6", inputs: 0, outputs: 1,
    defaultConfig: { seconds: 300 },
    configSchema: [f("seconds", "Interval (seconds)", "number", { required: true, default: 300 })],
  },

  // ---- Gmail (native integration) ----
  // Real OAuth-backed Gmail nodes. Each action node resolves the connected
  // account from `accountId` (the inspector renders an `account` dropdown that
  // fetches /api/integrations/accounts?provider=gmail). Message-id fields fall
  // back to the upstream node's output (so Search/New Email/Read → Reply/
  // Forward/Label chain without config). See lib/integrations/providers/gmail.
  {
    type: "gmail.trigger.newEmail", label: "New Email", category: "gmail",
    description: "Start when a new email arrives (polling)", icon: "Inbox", color: "#ea4335", inputs: 0, outputs: 1,
    defaultConfig: { query: "is:unread", maxResults: 10 },
    configSchema: [
      f("accountId", "Gmail account", "account", { provider: "gmail", required: true, help: "Connect an account in Settings → Integrations" }),
      f("query", "Search query", "text", { default: "is:unread", help: "Gmail search; polled for messages newer than the last run" }),
      f("maxResults", "Max results", "number", { default: 10 }),
    ],
  },
  {
    type: "gmail.send", label: "Send Email", category: "gmail",
    description: "Send a Gmail message", icon: "Send", color: "#ea4335", inputs: 1, outputs: 1,
    configSchema: [
      f("accountId", "Gmail account", "account", { provider: "gmail", required: true }),
      f("to", "To", "text", { required: true, placeholder: "user@example.com" }),
      f("subject", "Subject", "text", { required: true }),
      f("body", "Body", "textarea", { required: true }),
      f("cc", "Cc", "text", { placeholder: "optional" }),
      f("bcc", "Bcc", "text", { placeholder: "optional" }),
    ],
  },
  {
    type: "gmail.reply", label: "Reply to Email", category: "gmail",
    description: "Reply to a Gmail thread", icon: "Reply", color: "#ea4335", inputs: 1, outputs: 1,
    configSchema: [
      f("accountId", "Gmail account", "account", { provider: "gmail", required: true }),
      f("messageId", "Message ID", "text", { help: "ID of the message to reply to. Leave blank to use the output of an upstream Gmail node (Search/New Email/Read)." }),
      f("body", "Body", "textarea", { required: true }),
      f("replyAll", "Reply all", "boolean", { default: false }),
    ],
  },
  {
    type: "gmail.forward", label: "Forward Email", category: "gmail",
    description: "Forward a Gmail message", icon: "Forward", color: "#ea4335", inputs: 1, outputs: 1,
    configSchema: [
      f("accountId", "Gmail account", "account", { provider: "gmail", required: true }),
      f("messageId", "Message ID", "text", { help: "ID of the message to forward. Leave blank to use an upstream Gmail node's output." }),
      f("to", "To", "text", { required: true, placeholder: "user@example.com" }),
      f("body", "Intro note", "textarea", { help: "Optional intro prepended to the forwarded message" }),
    ],
  },
  {
    type: "gmail.search", label: "Search Emails", category: "gmail",
    description: "Search Gmail with a query", icon: "Search", color: "#ea4335", inputs: 1, outputs: 1,
    defaultConfig: { query: "is:unread", maxResults: 25 },
    configSchema: [
      f("accountId", "Gmail account", "account", { provider: "gmail", required: true }),
      f("query", "Search query", "text", { required: true, default: "is:unread", placeholder: "from:billing@stripe.com subject:invoice" }),
      f("maxResults", "Max results", "number", { default: 25 }),
    ],
  },
  {
    type: "gmail.read", label: "Read Email", category: "gmail",
    description: "Fetch a full Gmail message", icon: "MailOpen", color: "#ea4335", inputs: 1, outputs: 1,
    configSchema: [
      f("accountId", "Gmail account", "account", { provider: "gmail", required: true }),
      f("messageId", "Message ID", "text", { help: "ID of the message to read. Leave blank to use an upstream Gmail node's output." }),
    ],
  },
  {
    type: "gmail.draft", label: "Create Draft", category: "gmail",
    description: "Create a Gmail draft", icon: "FileEdit", color: "#ea4335", inputs: 1, outputs: 1,
    configSchema: [
      f("accountId", "Gmail account", "account", { provider: "gmail", required: true }),
      f("to", "To", "text", { required: true, placeholder: "user@example.com" }),
      f("subject", "Subject", "text"),
      f("body", "Body", "textarea"),
    ],
  },
  {
    type: "gmail.label.add", label: "Add Label", category: "gmail",
    description: "Add a Gmail label to a message", icon: "Tag", color: "#ea4335", inputs: 1, outputs: 1,
    configSchema: [
      f("accountId", "Gmail account", "account", { provider: "gmail", required: true }),
      f("messageId", "Message ID", "text", { help: "ID of the message to label. Leave blank to use an upstream Gmail node's output." }),
      f("label", "Label", "text", { required: true, placeholder: "Invoices", help: "Label name; created if it doesn't exist" }),
    ],
  },
  {
    type: "gmail.label.remove", label: "Remove Label", category: "gmail",
    description: "Remove a Gmail label from a message", icon: "MinusCircle", color: "#ea4335", inputs: 1, outputs: 1,
    configSchema: [
      f("accountId", "Gmail account", "account", { provider: "gmail", required: true }),
      f("messageId", "Message ID", "text", { help: "ID of the message to unlabel. Leave blank to use an upstream Gmail node's output." }),
      f("label", "Label", "text", { required: true, placeholder: "Invoices" }),
    ],
  },
  {
    type: "gmail.archive", label: "Archive Email", category: "gmail",
    description: "Archive a Gmail message (remove from Inbox)", icon: "Archive", color: "#ea4335", inputs: 1, outputs: 1,
    configSchema: [
      f("accountId", "Gmail account", "account", { provider: "gmail", required: true }),
      f("messageId", "Message ID", "text", { help: "ID of the message to archive. Leave blank to use an upstream Gmail node's output." }),
    ],
  },
  {
    type: "gmail.markRead", label: "Mark as Read", category: "gmail",
    description: "Mark a Gmail message as read", icon: "MailCheck", color: "#ea4335", inputs: 1, outputs: 1,
    configSchema: [
      f("accountId", "Gmail account", "account", { provider: "gmail", required: true }),
      f("messageId", "Message ID", "text", { help: "ID of the message to mark. Leave blank to use an upstream Gmail node's output." }),
    ],
  },
  {
    type: "gmail.delete", label: "Delete Email", category: "gmail",
    description: "Move a Gmail message to Trash", icon: "Trash2", color: "#ea4335", inputs: 1, outputs: 1,
    configSchema: [
      f("accountId", "Gmail account", "account", { provider: "gmail", required: true }),
      f("messageId", "Message ID", "text", { help: "ID of the message to delete. Leave blank to use an upstream Gmail node's output." }),
    ],
  },

  // ---- Communication ----
  {
    type: "comm.outlook", label: "Outlook", category: "communication",
    description: "Microsoft 365 mail", icon: "Mail", color: "#3b82f6", inputs: 1, outputs: 1,
    configSchema: [f("action", "Action", "select", { options: [{ label: "Read", value: "read" }, { label: "Send", value: "send" }] }), f("folder", "Folder", "text", { default: "Inbox" })],
  },
  {
    type: "comm.slack", label: "Slack", category: "communication",
    description: "Post to Slack channels", icon: "MessageSquare", color: "#a855f7", inputs: 1, outputs: 1,
    defaultConfig: { channel: "#general" },
    configSchema: [f("channel", "Channel", "text", { required: true, default: "#general" }), f("message", "Message", "textarea", { required: true })],
  },
  {
    type: "comm.discord", label: "Discord", category: "communication",
    description: "Send Discord messages", icon: "MessagesSquare", color: "#6366f1", inputs: 1, outputs: 1,
    configSchema: [f("webhookUrl", "Webhook URL", "secret", { required: true }), f("message", "Message", "textarea", { required: true })],
  },
  {
    type: "comm.telegram", label: "Telegram", category: "communication",
    description: "Telegram bot messages", icon: "Send", color: "#0ea5e9", inputs: 1, outputs: 1,
    configSchema: [f("chatId", "Chat ID", "text", { required: true }), f("token", "Bot token", "secret", { required: true }), f("message", "Message", "textarea", { required: true })],
  },
  {
    type: "comm.whatsapp", label: "WhatsApp", category: "communication",
    description: "WhatsApp Business API", icon: "Phone", color: "#22c55e", inputs: 1, outputs: 1,
    configSchema: [f("to", "Phone number", "text", { required: true }), f("template", "Template", "text", { placeholder: "hello_world" })],
  },

  // ---- AI ----
  {
    type: "ai.openai", label: "OpenAI", category: "ai",
    description: "GPT models for text, vision, code", icon: "Sparkles", color: "#10a37f", inputs: 1, outputs: 1,
    defaultConfig: { model: "gpt-4o", temperature: 0.7, useMemory: false },
    metrics: { tokens: true, cost: true },
    configSchema: [
      f("model", "Model", "select", { options: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "o4-mini"].map((v) => ({ label: v, value: v })), default: "gpt-4o" }),
      f("temperature", "Temperature", "number", { default: 0.7 }),
      f("maxTokens", "Max tokens", "number", { default: 1024 }),
      f("system", "System prompt", "textarea"),
      ...MEMORY_FIELDS,
    ],
  },
  {
    type: "ai.claude", label: "Claude", category: "ai",
    description: "Anthropic Claude reasoning", icon: "Sparkles", color: "#d97706", inputs: 1, outputs: 1,
    defaultConfig: { model: "claude-opus-4-8", temperature: 0.7, useMemory: false },
    metrics: { tokens: true, cost: true },
    configSchema: [
      f("model", "Model", "select", { options: ["claude-opus-4-8", "claude-sonnet-5", "claude-haiku-4-5-20251001"].map((v) => ({ label: v, value: v })), default: "claude-sonnet-5" }),
      f("temperature", "Temperature", "number", { default: 0.7 }),
      f("maxTokens", "Max tokens", "number", { default: 1024 }),
      f("system", "System prompt", "textarea"),
      ...MEMORY_FIELDS,
    ],
  },
  {
    type: "ai.gemini", label: "Gemini", category: "ai",
    description: "Google Gemini multimodal", icon: "Sparkles", color: "#4285f4", inputs: 1, outputs: 1,
    defaultConfig: { model: "gemini-2.5-pro", useMemory: false },
    metrics: { tokens: true, cost: true },
    configSchema: [f("model", "Model", "select", { options: ["gemini-2.5-pro", "gemini-2.5-flash"].map((v) => ({ label: v, value: v })), default: "gemini-2.5-pro" }), f("temperature", "Temperature", "number", { default: 0.7 }), ...MEMORY_FIELDS],
  },
  {
    type: "ai.local", label: "Local LLM", category: "ai",
    description: "Self-hosted / Ollama models", icon: "Cpu", color: "#64748b", inputs: 1, outputs: 1,
    metrics: { tokens: true },
    configSchema: [f("endpoint", "Endpoint", "text", { default: "http://localhost:11434" }), f("model", "Model", "text", { default: "llama3" }), ...MEMORY_FIELDS],
  },
  {
    type: "ai.prompt", label: "Prompt", category: "ai",
    description: "Templated prompt node", icon: "PenLine", color: "#8b5cf6", inputs: 1, outputs: 1,
    configSchema: [f("template", "Prompt template", "code", { required: true, default: "Summarize: {{input}}" }), f("variables", "Variables (JSON)", "code", { default: "{}" }), ...MEMORY_FIELDS],
  },
  {
    type: "ai.agent", label: "AI Agent", category: "ai",
    description: "Autonomous agent with tools", icon: "Bot", color: "#7c5cff", inputs: 1, outputs: 1,
    metrics: { tokens: true, cost: true },
    configSchema: [
      f("goal", "Goal", "textarea", { required: true }),
      f("tools", "Tools", "select", { options: ["search", "code", "browser", "none"].map((v) => ({ label: v, value: v })) }),
      f("maxSteps", "Max steps", "number", { default: 10 }),
      ...MEMORY_FIELDS,
    ],
  },
  {
    type: "ai.multiAgent", label: "Multi-Agent", category: "ai",
    description: "Orchestrate the LangGraph multi-agent runtime (planner → workers → reviewer → executor)", icon: "Users", color: "#7c5cff", inputs: 1, outputs: 1,
    metrics: { tokens: true, cost: true },
    defaultConfig: { objective: "", maxIterations: 2, requireApproval: false, memoryScope: "long_term", timeoutMs: 120000, guidance: "" },
    configSchema: [
      f("objective", "Objective", "textarea", { required: true, help: "What the agent team should accomplish. Leave blank to use the upstream node's output as the objective." }),
      f("maxIterations", "Max revision loops", "number", { default: 2, help: "Planner↔reviewer revision rounds before forcing completion." }),
      f("timeoutMs", "Timeout (ms)", "number", { default: 120000 }),
      f("requireApproval", "Require human approval", "boolean", { default: false, help: "Pause for operator sign-off before the reviewer (LangGraph checkpoint)." }),
      f("guidance", "Guidance", "textarea", { help: "Extra instructions prepended to every agent's prompt." }),
      f("memoryScope", "Memory scope", "select", { options: [
        { label: "Short-term", value: "short_term" },
        { label: "Conversation", value: "conversation" },
        { label: "Long-term", value: "long_term" },
        { label: "Workflow", value: "workflow" },
        { label: "Agent", value: "agent" },
        { label: "Workspace", value: "workspace" },
      ], default: "long_term" }),
      ...MEMORY_FIELDS,
    ],
  },
  {
    type: "ai.router", label: "AI Router", category: "ai",
    description: "Route to the best model per task", icon: "Route", color: "#22d3ee", inputs: 1, outputs: 4,
    metrics: { tokens: true, cost: true },
    configSchema: [f("strategy", "Strategy", "select", { options: [{ label: "Cost/quality", value: "balanced" }, { label: "Cheapest", value: "cost" }, { label: "Highest quality", value: "quality" }], default: "balanced" }), ...MEMORY_FIELDS],
  },

  // ---- Memory ----
  {
    type: "ai.memory", label: "Memory Store", category: "memory",
    description: "Long-term memory store", icon: "Brain", color: "#f59e0b", inputs: 1, outputs: 1,
    configSchema: [f("namespace", "Namespace", "text", { default: "default" }), f("key", "Key", "text", { required: true }), f("operation", "Operation", "select", { options: [{ label: "Write", value: "write" }, { label: "Read", value: "read" }, { label: "Append", value: "append" }], default: "write" })],
  },
  {
    type: "memory.recall", label: "Memory Recall", category: "memory",
    description: "Retrieve relevant memories by query", icon: "Brain", color: "#f59e0b", inputs: 1, outputs: 1,
    configSchema: [f("query", "Query", "textarea", { required: true }), f("topK", "Top K", "number", { default: 5 })],
  },
  {
    type: "memory.scope", label: "Scoped Memory", category: "memory",
    description: "Per-session / per-user memory window", icon: "Braces", color: "#f59e0b", inputs: 1, outputs: 1,
    configSchema: [f("scope", "Scope by", "select", { options: ["user", "session", "workflow"].map((v) => ({ label: v, value: v })), default: "session" }), f("ttl", "TTL (seconds)", "number", { default: 3600 })],
  },

  // ---- RAG ----
  {
    type: "ai.rag", label: "RAG Retrieve", category: "rag",
    description: "Retrieval over your documents", icon: "Library", color: "#14b8a6", inputs: 1, outputs: 1,
    configSchema: [f("index", "Index", "text", { required: true, default: "knowledge" }), f("query", "Query", "textarea", { required: true }), f("topK", "Top K", "number", { default: 4 })],
  },
  {
    type: "rag.embed", label: "Embed", category: "rag",
    description: "Embed text into a vector index", icon: "Boxes", color: "#14b8a6", inputs: 1, outputs: 1,
    configSchema: [f("index", "Index", "text", { required: true, default: "knowledge" }), f("model", "Embedding model", "text", { default: "text-embedding-3-small" })],
  },
  {
    type: "rag.index", label: "Index Source", category: "rag",
    description: "Ingest a file or URL into an index", icon: "FileInput", color: "#14b8a6", inputs: 1, outputs: 1,
    configSchema: [f("index", "Index", "text", { required: true, default: "knowledge" }), f("source", "Source URL / path", "text", { required: true }), f("chunkSize", "Chunk size", "number", { default: 800 })],
  },

  // ---- Database ----
  {
    type: "store.postgres", label: "PostgreSQL", category: "database",
    description: "Query / insert into Postgres", icon: "Database", color: "#336791", inputs: 1, outputs: 1,
    defaultConfig: { table: "invoices" },
    configSchema: [f("connection", "Connection (ref)", "secret", { required: true }), f("table", "Table", "text", { required: true }), f("operation", "Operation", "select", { options: ["select", "insert", "update", "delete"].map((v) => ({ label: v, value: v })), default: "insert" }), f("query", "SQL", "code", { help: "Used when operation = select" })],
  },
  {
    type: "store.mysql", label: "MySQL", category: "database",
    description: "MySQL database operations", icon: "Database", color: "#00758f", inputs: 1, outputs: 1,
    configSchema: [f("connection", "Connection (ref)", "secret", { required: true }), f("table", "Table", "text", { required: true }), f("operation", "Operation", "select", { options: ["select", "insert", "update", "delete"].map((v) => ({ label: v, value: v })) })],
  },
  {
    type: "store.mongo", label: "MongoDB", category: "database",
    description: "Document store operations", icon: "Database", color: "#47a248", inputs: 1, outputs: 1,
    configSchema: [f("connection", "Connection (ref)", "secret", { required: true }), f("collection", "Collection", "text", { required: true }), f("operation", "Operation", "select", { options: ["find", "insert", "update", "delete"].map((v) => ({ label: v, value: v })) })],
  },
  {
    type: "store.redis", label: "Redis", category: "database",
    description: "Cache & queue ops", icon: "Server", color: "#dc382d", inputs: 1, outputs: 1,
    configSchema: [f("connection", "Connection (ref)", "secret", { required: true }), f("key", "Key", "text", { required: true }), f("operation", "Operation", "select", { options: ["get", "set", "incr", "delete"].map((v) => ({ label: v, value: v })) })],
  },
  {
    type: "store.supabase", label: "Supabase", category: "database",
    description: "Supabase tables & auth", icon: "Database", color: "#3ecf8e", inputs: 1, outputs: 1,
    defaultConfig: { table: "leads" },
    configSchema: [f("project", "Project ref", "text", { required: true }), f("anonKey", "Anon key", "secret", { required: true }), f("table", "Table", "text", { required: true }), f("operation", "Operation", "select", { options: ["select", "insert", "update"].map((v) => ({ label: v, value: v })) })],
  },
  {
    type: "store.firebase", label: "Firebase", category: "database",
    description: "Firestore & realtime", icon: "Flame", color: "#ffca28", inputs: 1, outputs: 1,
    configSchema: [f("collection", "Collection", "text", { required: true }), f("operation", "Operation", "select", { options: ["get", "add", "set", "delete"].map((v) => ({ label: v, value: v })) })],
  },

  // ---- Files ----
  {
    type: "doc.pdf", label: "PDF", category: "files",
    description: "Read & generate PDFs", icon: "FileText", color: "#e11d48", inputs: 1, outputs: 1,
    configSchema: [f("action", "Action", "select", { options: [{ label: "Read", value: "read" }, { label: "Generate", value: "generate" }] }), f("path", "Path / URL", "text", { required: true })],
  },
  {
    type: "doc.docx", label: "DOCX", category: "files",
    description: "Word document processing", icon: "FileType", color: "#2563eb", inputs: 1, outputs: 1,
    configSchema: [f("action", "Action", "select", { options: [{ label: "Read", value: "read" }, { label: "Generate", value: "generate" }] }), f("path", "Path / URL", "text", { required: true })],
  },
  {
    type: "doc.excel", label: "Excel", category: "files",
    description: "Spreadsheet read & write", icon: "Sheet", color: "#16a34a", inputs: 1, outputs: 1,
    configSchema: [f("action", "Action", "select", { options: [{ label: "Read", value: "read" }, { label: "Write", value: "write" }] }), f("sheet", "Sheet", "text", { default: "Sheet1" })],
  },
  {
    type: "doc.csv", label: "CSV", category: "files",
    description: "Parse & transform CSV", icon: "Table", color: "#0ea5e9", inputs: 1, outputs: 1,
    configSchema: [f("delimiter", "Delimiter", "text", { default: "," }), f("header", "Has header", "boolean", { default: true })],
  },
  {
    type: "doc.ocr", label: "OCR", category: "files",
    description: "Extract text from images", icon: "ScanText", color: "#a855f7", inputs: 1, outputs: 1,
    configSchema: [f("engine", "Engine", "select", { options: ["tesseract", "google-vision", "aws-textract"].map((v) => ({ label: v, value: v })) }), f("image", "Image path / URL", "text", { required: true })],
  },

  // ---- Cloud ----
  {
    type: "cloud.aws", label: "AWS", category: "cloud",
    description: "AWS service integrations", icon: "Cloud", color: "#ff9900", inputs: 1, outputs: 1,
    configSchema: [f("service", "Service", "select", { options: ["s3", "lambda", "sqs", "dynamodb"].map((v) => ({ label: v, value: v })) }), f("region", "Region", "text", { default: "us-east-1" }), f("credentials", "Credentials (ref)", "secret", { required: true })],
  },
  {
    type: "cloud.azure", label: "Azure", category: "cloud",
    description: "Microsoft Azure ops", icon: "Cloud", color: "#0078d4", inputs: 1, outputs: 1,
    configSchema: [f("service", "Service", "select", { options: ["blob", "queue", "functions"].map((v) => ({ label: v, value: v })) }), f("credentials", "Credentials (ref)", "secret", { required: true })],
  },
  {
    type: "cloud.gcp", label: "GCP", category: "cloud",
    description: "Google Cloud ops", icon: "Cloud", color: "#4285f4", inputs: 1, outputs: 1,
    configSchema: [f("service", "Service", "select", { options: ["storage", "pubsub", "functions"].map((v) => ({ label: v, value: v })) }), f("credentials", "Credentials (ref)", "secret", { required: true })],
  },
  {
    type: "cloud.s3", label: "S3", category: "cloud",
    description: "Upload / fetch S3 objects", icon: "HardDrive", color: "#ff9900", inputs: 1, outputs: 1,
    defaultConfig: { bucket: "invoices" },
    configSchema: [f("bucket", "Bucket", "text", { required: true }), f("key", "Key", "text", { required: true }), f("operation", "Operation", "select", { options: [{ label: "Upload", value: "upload" }, { label: "Fetch", value: "fetch" }] })],
  },

  // ---- Integrations ----
  {
    type: "integrations.stripe", label: "Stripe", category: "integrations",
    description: "Create charges, invoices, customers", icon: "CreditCard", color: "#635bff", inputs: 1, outputs: 1,
    configSchema: [f("secretKey", "Secret key", "secret", { required: true }), f("resource", "Resource", "select", { options: ["charge", "invoice", "customer", "subscription"].map((v) => ({ label: v, value: v })) }), f("operation", "Operation", "select", { options: ["create", "retrieve", "list"].map((v) => ({ label: v, value: v })) })],
  },
  {
    type: "integrations.github", label: "GitHub", category: "integrations",
    description: "Issues, PRs, and repo events", icon: "Github", color: "#8b949e", inputs: 1, outputs: 1,
    configSchema: [f("token", "Token", "secret", { required: true }), f("repo", "Repository", "text", { placeholder: "owner/repo" }), f("resource", "Resource", "select", { options: ["issue", "pull", "commit", "release"].map((v) => ({ label: v, value: v })) })],
  },
  {
    type: "integrations.notion", label: "Notion", category: "integrations",
    description: "Read & write Notion pages", icon: "BookOpen", color: "#111827", inputs: 1, outputs: 1,
    configSchema: [f("token", "Integration token", "secret", { required: true }), f("database", "Database ID", "text"), f("operation", "Operation", "select", { options: ["query", "create", "update"].map((v) => ({ label: v, value: v })) })],
  },
  {
    type: "integrations.hubspot", label: "HubSpot", category: "integrations",
    description: "Contacts, deals, and CRM sync", icon: "Users", color: "#ff7a59", inputs: 1, outputs: 1,
    configSchema: [f("token", "Private key", "secret", { required: true }), f("object", "Object", "select", { options: ["contacts", "deals", "companies"].map((v) => ({ label: v, value: v })) })],
  },
  {
    type: "integrations.linear", label: "Linear", category: "integrations",
    description: "Issues and project tracking", icon: "Workflow", color: "#5e6ad2", inputs: 1, outputs: 1,
    configSchema: [f("token", "API key", "secret", { required: true }), f("team", "Team ID", "text"), f("operation", "Operation", "select", { options: ["create", "list", "update"].map((v) => ({ label: v, value: v })) })],
  },
  {
    type: "integrations.salesforce", label: "Salesforce", category: "integrations",
    description: "Leads, opportunities, accounts", icon: "CloudLightning", color: "#00a1e0", inputs: 1, outputs: 1,
    configSchema: [f("instance", "Instance URL", "text", { required: true }), f("token", "Session token", "secret", { required: true }), f("object", "Object", "text", { default: "Lead" })],
  },

  // ---- Developer ----
  {
    type: "dev.rest", label: "REST API", category: "developer",
    description: "Call any REST endpoint", icon: "Globe", color: "#0ea5e9", inputs: 1, outputs: 1,
    defaultConfig: { method: "GET", url: "https://api.example.com" },
    configSchema: [
      f("method", "Method", "select", { options: ["GET", "POST", "PUT", "PATCH", "DELETE"].map((v) => ({ label: v, value: v })), default: "GET" }),
      f("url", "URL", "text", { required: true, default: "https://api.example.com" }),
      f("headers", "Headers (JSON)", "code", { default: "{}" }),
      f("body", "Body", "code"),
      f("auth", "Auth header", "secret", { help: "Sent as Authorization" }),
    ],
  },
  {
    type: "dev.graphql", label: "GraphQL", category: "developer",
    description: "Execute GraphQL queries", icon: "Code2", color: "#e10098", inputs: 1, outputs: 1,
    configSchema: [f("endpoint", "Endpoint", "text", { required: true }), f("query", "Query", "code", { required: true }), f("variables", "Variables (JSON)", "code", { default: "{}" })],
  },
  {
    type: "dev.webhook", label: "Webhook Out", category: "developer",
    description: "Send an outbound webhook", icon: "Webhook", color: "#f472b6", inputs: 1, outputs: 1,
    configSchema: [f("url", "URL", "text", { required: true }), f("secret", "Signing secret", "secret")],
  },
  {
    type: "dev.javascript", label: "JavaScript", category: "developer",
    description: "Run JS sandbox code", icon: "Code", color: "#eab308", inputs: 1, outputs: 1,
    configSchema: [f("code", "Code", "code", { required: true, default: "return input;" }), f("timeout", "Timeout (ms)", "number", { default: 5000 })],
  },
  {
    type: "dev.python", label: "Python", category: "developer",
    description: "Run Python sandbox", icon: "Code", color: "#3776ab", inputs: 1, outputs: 1,
    configSchema: [f("code", "Code", "code", { required: true, default: "def run(input):\n  return input" }), f("runtime", "Runtime", "select", { options: ["cpython", "micropython"].map((v) => ({ label: v, value: v })) })],
  },
  {
    type: "dev.http", label: "HTTP Request", category: "developer",
    description: "Raw HTTP request", icon: "Network", color: "#64748b", inputs: 1, outputs: 1,
    configSchema: [f("url", "URL", "text", { required: true }), f("method", "Method", "text", { default: "GET" })],
  },

  // ---- Logic ----
  {
    type: "util.condition", label: "Condition", category: "logic",
    description: "If / then branching", icon: "GitBranch", color: "#f59e0b", inputs: 1, outputs: 2,
    configSchema: [f("expression", "Condition (JS)", "code", { required: true, default: "input.value > 0", help: "Truthy → output 1, falsy → output 2" })],
  },
  {
    type: "util.switch", label: "Switch", category: "logic",
    description: "Multi-branch routing", icon: "Shuffle", color: "#f59e0b", inputs: 1, outputs: 4,
    configSchema: [f("key", "Key path", "text", { default: "type" }), f("cases", "Cases (JSON array)", "code", { default: '["a","b","c","default"]' })],
  },
  {
    type: "util.merge", label: "Merge", category: "logic",
    description: "Combine multiple branches", icon: "Combine", color: "#64748b", inputs: 4, outputs: 1,
    configSchema: [f("strategy", "Strategy", "select", { options: ["all", "first", "concat"].map((v) => ({ label: v, value: v })), default: "all", help: "all = wait for every input" })],
  },
  {
    type: "util.split", label: "Split", category: "logic",
    description: "Fan out to parallel branches", icon: "Split", color: "#64748b", inputs: 1, outputs: 4,
    configSchema: [f("batchSize", "Batch size", "number", { default: 1 })],
  },
  {
    type: "util.loop", label: "Loop", category: "logic",
    description: "Iterate over a list", icon: "Repeat", color: "#64748b", inputs: 1, outputs: 1,
    configSchema: [f("items", "Items path", "text", { default: "input.items" }), f("concurrency", "Concurrency", "number", { default: 1 })],
  },
  {
    type: "logic.filter", label: "Filter", category: "logic",
    description: "Drop items that fail a predicate", icon: "Filter", color: "#f59e0b", inputs: 1, outputs: 1,
    configSchema: [f("expression", "Predicate (JS)", "code", { required: true, default: "item.score > 0.5" })],
  },

  // ---- Utilities ----
  {
    type: "util.delay", label: "Delay", category: "utilities",
    description: "Wait for a duration", icon: "Timer", color: "#64748b", inputs: 1, outputs: 1,
    defaultConfig: { ms: 5000 },
    configSchema: [f("ms", "Milliseconds", "number", { required: true, default: 5000 })],
  },
  {
    type: "util.transform", label: "Transform", category: "utilities",
    description: "Map / reshape data", icon: "Wand2", color: "#8b5cf6", inputs: 1, outputs: 1,
    configSchema: [f("expression", "Transform (JS)", "code", { required: true, default: "return { ...input, ok: true }" })],
  },
  {
    type: "util.formatter", label: "Formatter", category: "utilities",
    description: "Format dates, numbers, strings", icon: "Type", color: "#64748b", inputs: 1, outputs: 1,
    configSchema: [f("format", "Format", "select", { options: ["date", "number", "currency", "uppercase", "lowercase"].map((v) => ({ label: v, value: v })) }), f("template", "Template", "text", { default: "YYYY-MM-DD" })],
  },
  // ─────────────────────────── MCP (Model Context Protocol) ────────────────
  // Discover + invoke external tools/resources through connected MCP servers.
  // Routed to the MCP runtime via lib/execution/actions/{registry,mcp}.ts; the
  // engine itself is unchanged. The selector field type renders a discovered-
  // tool/resource dropdown in the inspector (components/workflow/inspector.tsx).
  {
    type: "mcp.tool", label: "MCP Tool", category: "mcp",
    description: "Invoke a tool from a connected MCP server (discovered dynamically via the Model Context Protocol).", icon: "Plug", color: "#8b5cf6", inputs: 1, outputs: 1,
    metrics: { tokens: true, cost: true },
    defaultConfig: { tool: "", arguments: "{}", timeoutMs: 30000 },
    configSchema: [
      f("tool", "Tool", "mcp.tool", { required: true, help: "Pick a tool discovered from your connected MCP servers (Settings → MCP). Register a server and run Discover first." }),
      f("arguments", "Arguments (JSON)", "code", { default: "{}", help: "JSON object passed as the tool's input arguments, per its schema." }),
      f("timeoutMs", "Timeout (ms)", "number", { default: 30000, help: "Per-call timeout. Long-running tools that emit progress reset the timer." }),
    ],
  },
  {
    type: "mcp.resource", label: "MCP Resource", category: "mcp",
    description: "Read a resource (file, data, template) exposed by a connected MCP server.", icon: "FileInput", color: "#8b5cf6", inputs: 1, outputs: 1,
    defaultConfig: { resource: "", arguments: "{}" },
    configSchema: [
      f("resource", "Resource", "mcp.resource", { required: true, help: "Pick a resource discovered from your connected MCP servers." }),
      f("arguments", "Arguments (JSON)", "code", { default: "{}", help: "JSON object — for resource templates, used to fill the URI template variables." }),
    ],
  },
];

export const CATEGORY_META: Record<NodeDef["category"], { label: string; color: string; icon: string }> = {
  ai: { label: "AI", color: "#7c5cff", icon: "Sparkles" },
  communication: { label: "Communication", color: "#a855f7", icon: "MessageSquare" },
  gmail: { label: "Gmail", color: "#ea4335", icon: "Mail" },
  database: { label: "Database", color: "#10b981", icon: "Database" },
  logic: { label: "Logic", color: "#f59e0b", icon: "GitBranch" },
  files: { label: "Files", color: "#0ea5e9", icon: "FileText" },
  cloud: { label: "Cloud", color: "#ff9900", icon: "Cloud" },
  integrations: { label: "Integrations", color: "#22d3ee", icon: "Blocks" },
  developer: { label: "Developer", color: "#eab308", icon: "Code" },
  utilities: { label: "Utilities", color: "#64748b", icon: "Wrench" },
  scheduling: { label: "Scheduling", color: "#f472b6", icon: "Clock" },
  memory: { label: "Memory", color: "#f59e0b", icon: "Brain" },
  rag: { label: "RAG", color: "#14b8a6", icon: "Library" },
  mcp: { label: "MCP", color: "#8b5cf6", icon: "Plug" },
};

// Display order for the palette (matches the brief).
export const CATEGORY_ORDER: NodeDef["category"][] = [
  "ai", "communication", "gmail", "database", "logic", "files", "cloud",
  "integrations", "developer", "utilities", "scheduling", "memory", "rag", "mcp",
];

// In-process TTL memo for node-definition lookups. Node defs are static module
// data, so this is a cheap synchronous memoization (not a Redis round-trip —
// the call sites in the builder/inspector are synchronous and can't await the
// async CacheProvider). The TTL lets dev edits surface without a full process
// restart. The dynamic caches (memory retrievals, workflow metadata, MCP tool
// discovery) go through the Redis-backed layer in lib/cache. See lib/cache.
const NODE_DEF_TTL_MS = 60_000;
const nodeDefCache = new Map<string, { def: NodeDef | undefined; expiresAt: number }>();

export function getNodeDef(type: string): NodeDef | undefined {
  const now = Date.now();
  const hit = nodeDefCache.get(type);
  if (hit && hit.expiresAt > now) return hit.def;
  const def = NODE_LIBRARY.find((n) => n.type === type);
  nodeDefCache.set(type, { def, expiresAt: now + NODE_DEF_TTL_MS });
  return def;
}

// Validate a node's config against its schema. Returns field-level errors.
export function validateNodeConfig(type: string, config: Record<string, unknown>): string[] {
  const def = getNodeDef(type);
  if (!def?.configSchema) return [];
  const errors: string[] = [];
  for (const field of def.configSchema) {
    const v = config[field.key];
    if (field.required && (v === undefined || v === "" || v === null)) {
      errors.push(`${field.label} is required`);
    }
  }
  return errors;
}