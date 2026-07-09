import type { NodeDef } from "./types";

// ============================================================
// Node Library — the marketplace of nodes
// ============================================================

export const NODE_LIBRARY: NodeDef[] = [
  // Triggers
  { type: "trigger.webhook", label: "Webhook", category: "trigger", description: "Start on an incoming HTTP webhook", icon: "Webhook", color: "#f472b6", inputs: 0, outputs: 1 },
  { type: "trigger.schedule", label: "Schedule", category: "trigger", description: "Run on a cron schedule", icon: "Clock", color: "#f472b6", inputs: 0, outputs: 1, defaultConfig: { cron: "0 9 * * *" } },
  { type: "trigger.manual", label: "Manual", category: "trigger", description: "Run on demand", icon: "Play", color: "#f472b6", inputs: 0, outputs: 1 },

  // Communication
  { type: "comm.gmail", label: "Gmail", category: "communication", description: "Send or read Gmail messages", icon: "Mail", color: "#ef4444", inputs: 1, outputs: 1 },
  { type: "comm.outlook", label: "Outlook", category: "communication", description: "Microsoft 365 mail", icon: "Mail", color: "#3b82f6", inputs: 1, outputs: 1 },
  { type: "comm.slack", label: "Slack", category: "communication", description: "Post to Slack channels", icon: "MessageSquare", color: "#a855f7", inputs: 1, outputs: 1 },
  { type: "comm.discord", label: "Discord", category: "communication", description: "Send Discord messages", icon: "MessagesSquare", color: "#6366f1", inputs: 1, outputs: 1 },
  { type: "comm.telegram", label: "Telegram", category: "communication", description: "Telegram bot messages", icon: "Send", color: "#0ea5e9", inputs: 1, outputs: 1 },
  { type: "comm.whatsapp", label: "WhatsApp", category: "communication", description: "WhatsApp Business API", icon: "Phone", color: "#22c55e", inputs: 1, outputs: 1 },

  // AI
  { type: "ai.openai", label: "OpenAI", category: "ai", description: "GPT models for text, vision, code", icon: "Sparkles", color: "#10a37f", inputs: 1, outputs: 1, defaultConfig: { model: "gpt-4o", temperature: 0.7 } },
  { type: "ai.claude", label: "Claude", category: "ai", description: "Anthropic Claude reasoning", icon: "Sparkles", color: "#d97706", inputs: 1, outputs: 1, defaultConfig: { model: "claude-opus-4-8", temperature: 0.7 } },
  { type: "ai.gemini", label: "Gemini", category: "ai", description: "Google Gemini multimodal", icon: "Sparkles", color: "#4285f4", inputs: 1, outputs: 1, defaultConfig: { model: "gemini-2.5-pro" } },
  { type: "ai.local", label: "Local LLM", category: "ai", description: "Self-hosted / Ollama models", icon: "Cpu", color: "#64748b", inputs: 1, outputs: 1 },
  { type: "ai.prompt", label: "Prompt", category: "ai", description: "Templated prompt node", icon: "PenLine", color: "#8b5cf6", inputs: 1, outputs: 1 },
  { type: "ai.agent", label: "AI Agent", category: "ai", description: "Autonomous agent with tools", icon: "Bot", color: "#7c5cff", inputs: 1, outputs: 1 },
  { type: "ai.router", label: "AI Router", category: "ai", description: "Route to the best model per task", icon: "Route", color: "#22d3ee", inputs: 1, outputs: 4 },
  { type: "ai.memory", label: "Memory", category: "ai", description: "Long-term memory store", icon: "Brain", color: "#f59e0b", inputs: 1, outputs: 1 },
  { type: "ai.rag", label: "RAG", category: "ai", description: "Retrieval over your documents", icon: "Library", color: "#14b8a6", inputs: 1, outputs: 1 },

  // Storage
  { type: "store.postgres", label: "PostgreSQL", category: "storage", description: "Query / insert into Postgres", icon: "Database", color: "#336791", inputs: 1, outputs: 1 },
  { type: "store.mysql", label: "MySQL", category: "storage", description: "MySQL database operations", icon: "Database", color: "#00758f", inputs: 1, outputs: 1 },
  { type: "store.mongo", label: "MongoDB", category: "storage", description: "Document store operations", icon: "Database", color: "#47a248", inputs: 1, outputs: 1 },
  { type: "store.redis", label: "Redis", category: "storage", description: "Cache & queue ops", icon: "Server", color: "#dc382d", inputs: 1, outputs: 1 },
  { type: "store.supabase", label: "Supabase", category: "storage", description: "Supabase tables & auth", icon: "Database", color: "#3ecf8e", inputs: 1, outputs: 1 },
  { type: "store.firebase", label: "Firebase", category: "storage", description: "Firestore & realtime", icon: "Flame", color: "#ffca28", inputs: 1, outputs: 1 },

  // Documents
  { type: "doc.pdf", label: "PDF", category: "documents", description: "Read & generate PDFs", icon: "FileText", color: "#e11d48", inputs: 1, outputs: 1 },
  { type: "doc.docx", label: "DOCX", category: "documents", description: "Word document processing", icon: "FileType", color: "#2563eb", inputs: 1, outputs: 1 },
  { type: "doc.excel", label: "Excel", category: "documents", description: "Spreadsheet read & write", icon: "Sheet", color: "#16a34a", inputs: 1, outputs: 1 },
  { type: "doc.csv", label: "CSV", category: "documents", description: "Parse & transform CSV", icon: "Table", color: "#0ea5e9", inputs: 1, outputs: 1 },
  { type: "doc.ocr", label: "OCR", category: "documents", description: "Extract text from images", icon: "ScanText", color: "#a855f7", inputs: 1, outputs: 1 },

  // Developer
  { type: "dev.rest", label: "REST API", category: "developer", description: "Call any REST endpoint", icon: "Globe", color: "#0ea5e9", inputs: 1, outputs: 1, defaultConfig: { method: "GET" } },
  { type: "dev.graphql", label: "GraphQL", category: "developer", description: "Execute GraphQL queries", icon: "Code2", color: "#e10098", inputs: 1, outputs: 1 },
  { type: "dev.webhook", label: "Webhook", category: "developer", description: "Send outbound webhook", icon: "Webhook", color: "#f472b6", inputs: 1, outputs: 1 },
  { type: "dev.javascript", label: "JavaScript", category: "developer", description: "Run JS sandbox code", icon: "Code", color: "#eab308", inputs: 1, outputs: 1 },
  { type: "dev.python", label: "Python", category: "developer", description: "Run Python sandbox", icon: "Code", color: "#3776ab", inputs: 1, outputs: 1 },
  { type: "dev.http", label: "HTTP Request", category: "developer", description: "Raw HTTP request", icon: "Network", color: "#64748b", inputs: 1, outputs: 1 },

  // Cloud
  { type: "cloud.aws", label: "AWS", category: "cloud", description: "AWS service integrations", icon: "Cloud", color: "#ff9900", inputs: 1, outputs: 1 },
  { type: "cloud.azure", label: "Azure", category: "cloud", description: "Microsoft Azure ops", icon: "Cloud", color: "#0078d4", inputs: 1, outputs: 1 },
  { type: "cloud.gcp", label: "GCP", category: "cloud", description: "Google Cloud ops", icon: "Cloud", color: "#4285f4", inputs: 1, outputs: 1 },
  { type: "cloud.s3", label: "S3", category: "cloud", description: "Upload / fetch S3 objects", icon: "HardDrive", color: "#ff9900", inputs: 1, outputs: 1 },

  // Utilities
  { type: "util.delay", label: "Delay", category: "utilities", description: "Wait for a duration", icon: "Timer", color: "#64748b", inputs: 1, outputs: 1, defaultConfig: { ms: 5000 } },
  { type: "util.loop", label: "Loop", category: "utilities", description: "Iterate over a list", icon: "Repeat", color: "#64748b", inputs: 1, outputs: 1 },
  { type: "util.condition", label: "Condition", category: "utilities", description: "If / then branching", icon: "GitBranch", color: "#f59e0b", inputs: 1, outputs: 2 },
  { type: "util.switch", label: "Switch", category: "utilities", description: "Multi-branch routing", icon: "Shuffle", color: "#f59e0b", inputs: 1, outputs: 4 },
  { type: "util.merge", label: "Merge", category: "utilities", description: "Combine multiple branches", icon: "Combine", color: "#64748b", inputs: 4, outputs: 1 },
  { type: "util.split", label: "Split", category: "utilities", description: "Fan out to parallel branches", icon: "Split", color: "#64748b", inputs: 1, outputs: 4 },
  { type: "util.transform", label: "Transform", category: "utilities", description: "Map / reshape data", icon: "Wand2", color: "#8b5cf6", inputs: 1, outputs: 1 },
  { type: "util.formatter", label: "Formatter", category: "utilities", description: "Format dates, numbers, strings", icon: "Type", color: "#64748b", inputs: 1, outputs: 1 },
];

export const CATEGORY_META: Record<string, { label: string; color: string }> = {
  trigger: { label: "Triggers", color: "#f472b6" },
  communication: { label: "Communication", color: "#a855f7" },
  ai: { label: "AI", color: "#7c5cff" },
  storage: { label: "Storage", color: "#10b981" },
  documents: { label: "Documents", color: "#0ea5e9" },
  developer: { label: "Developer", color: "#eab308" },
  cloud: { label: "Cloud", color: "#ff9900" },
  utilities: { label: "Utilities", color: "#64748b" },
};

export function getNodeDef(type: string): NodeDef | undefined {
  return NODE_LIBRARY.find((n) => n.type === type);
}