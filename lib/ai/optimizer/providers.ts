// AI Cost Optimizer — provider registry.
//
// Each provider is a self-contained descriptor: identity, the workflow node
// type it maps to, a table of real per-model pricing/latency, which model
// represents each tier (cheap/fast/balanced/quality), and an availability
// reader (env keys). Adding a provider = appending one object to PROVIDERS;
// the estimator and UI pick it up with no other changes.
//
// Prices are real public list prices (USD per 1M tokens) at time of writing,
// sourced from each provider's pricing page. Throughput (output tokens/sec)
// and TTFT (time-to-first-token) are representative ballpark figures used only
// for LATENCY ESTIMATION — they are estimates, not measured guarantees, and
// the UI labels them as estimates. Any value we cannot determine is null and
// surfaces as "Unknown" in the UI (see lib/ai/optimizer/estimate.ts).
//
// This module is imported transitively by server-only estimate.ts (via the
// execution engine), so reading process.env here is safe.

export type ProviderId = "openai" | "anthropic" | "gemini" | "local";
export type Availability = true | false | "unknown";
export type ModelTier = "cheap" | "fast" | "balanced" | "quality";

export interface ModelPricing {
  id: string;
  label: string;
  contextWindow: number; // max tokens (input+output)
  inputPer1M: number | null; // USD per 1M input tokens; null = unknown
  outputPer1M: number | null; // USD per 1M output tokens; null = unknown
  throughputTps: number | null; // output tokens/sec (latency estimate); null = unknown
  ttftMs: number | null; // time to first token (latency estimate); null = unknown
  tier: ModelTier;
}

export interface ProviderDescriptor {
  id: ProviderId;
  label: string;
  nodeType: string; // "ai.openai" | "ai.claude" | "ai.gemini" | "ai.local"
  accent: string; // hex accent for the UI
  models: ModelPricing[];
  /** model id chosen to represent each tier (used for per-provider what-if). */
  representative: Record<ModelTier, string>;
  /** Whether this provider is configured/runnable in the current environment. */
  availability: () => Availability;
}

// ─────────────────────────── OpenAI ────────────────────────────
const OPENAI_MODELS: ModelPricing[] = [
  // Prices: https://openai.com/api/pricing/ (per 1M tokens)
  { id: "gpt-4o", label: "GPT-4o", contextWindow: 128_000, inputPer1M: 2.5, outputPer1M: 10.0, throughputTps: 80, ttftMs: 800, tier: "quality" },
  { id: "gpt-4o-mini", label: "GPT-4o mini", contextWindow: 128_000, inputPer1M: 0.15, outputPer1M: 0.6, throughputTps: 150, ttftMs: 400, tier: "cheap" },
  { id: "gpt-4.1", label: "GPT-4.1", contextWindow: 1_000_000, inputPer1M: 2.0, outputPer1M: 8.0, throughputTps: 90, ttftMs: 700, tier: "balanced" },
  { id: "o4-mini", label: "o4-mini", contextWindow: 200_000, inputPer1M: 1.1, outputPer1M: 4.4, throughputTps: 60, ttftMs: 1500, tier: "balanced" },
];

// ─────────────────────────── Anthropic Claude ────────────────────────────
const CLAUDE_MODELS: ModelPricing[] = [
  // Prices: https://www.anthropic.com/pricing (per 1M tokens)
  { id: "claude-opus-4-8", label: "Claude Opus 4.8", contextWindow: 200_000, inputPer1M: 15.0, outputPer1M: 75.0, throughputTps: 50, ttftMs: 1200, tier: "quality" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", contextWindow: 200_000, inputPer1M: 3.0, outputPer1M: 15.0, throughputTps: 70, ttftMs: 900, tier: "balanced" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", contextWindow: 200_000, inputPer1M: 1.0, outputPer1M: 5.0, throughputTps: 120, ttftMs: 500, tier: "cheap" },
];

// ─────────────────────────── Google Gemini ────────────────────────────
const GEMINI_MODELS: ModelPricing[] = [
  // Prices: https://ai.google.dev/pricing (per 1M tokens; ≤200k context tier)
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", contextWindow: 2_000_000, inputPer1M: 1.25, outputPer1M: 10.0, throughputTps: 90, ttftMs: 800, tier: "balanced" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", contextWindow: 1_000_000, inputPer1M: 0.075, outputPer1M: 0.3, throughputTps: 200, ttftMs: 450, tier: "cheap" },
];

// ─────────────────────────── Local (Ollama / self-hosted) ────────────────────────────
// Local models have no per-token cost (self-hosted). Pricing is $0. Latency and
// availability depend entirely on the user's hardware/endpoint, which we can't
// verify pre-run without a network probe — so availability is "unknown" and
// throughput/TTFT are conservative placeholders used only for latency estimates.
const LOCAL_MODELS: ModelPricing[] = [
  { id: "llama3", label: "Llama 3 (local)", contextWindow: 8_000, inputPer1M: 0, outputPer1M: 0, throughputTps: 35, ttftMs: 600, tier: "balanced" },
  { id: "mistral", label: "Mistral (local)", contextWindow: 32_000, inputPer1M: 0, outputPer1M: 0, throughputTps: 40, ttftMs: 500, tier: "balanced" },
];

export const PROVIDERS: ProviderDescriptor[] = [
  {
    id: "openai",
    label: "OpenAI",
    nodeType: "ai.openai",
    accent: "#10a37f",
    models: OPENAI_MODELS,
    representative: { cheap: "gpt-4o-mini", fast: "gpt-4o-mini", balanced: "gpt-4.1", quality: "gpt-4o" },
    availability: () => Boolean(process.env.OPENAI_API_KEY),
  },
  {
    id: "anthropic",
    label: "Claude",
    nodeType: "ai.claude",
    accent: "#d97706",
    models: CLAUDE_MODELS,
    representative: { cheap: "claude-haiku-4-5-20251001", fast: "claude-haiku-4-5-20251001", balanced: "claude-sonnet-5", quality: "claude-opus-4-8" },
    availability: () => Boolean(process.env.ANTHROPIC_API_KEY),
  },
  {
    id: "gemini",
    label: "Gemini",
    nodeType: "ai.gemini",
    accent: "#4285f4",
    models: GEMINI_MODELS,
    representative: { cheap: "gemini-2.5-flash", fast: "gemini-2.5-flash", balanced: "gemini-2.5-pro", quality: "gemini-2.5-pro" },
    // Gemini isn't wired for execution in the engine yet, but pricing is public
    // so we still estimate. Availability reflects a configured key (standard
    // Google AI Studio env names); absent → false (not runnable today).
    availability: () => Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY),
  },
  {
    id: "local",
    label: "Local",
    nodeType: "ai.local",
    accent: "#64748b",
    models: LOCAL_MODELS,
    representative: { cheap: "llama3", fast: "mistral", balanced: "llama3", quality: "llama3" },
    // Self-hosted endpoint reachability can't be verified pre-run without a
    // network probe, so we report "unknown" rather than a misleading true/false.
    availability: () => "unknown" as Availability,
  },
];

const PROVIDER_MAP = new Map<ProviderId, ProviderDescriptor>(PROVIDERS.map((p) => [p.id, p]));

export function getProvider(id: ProviderId): ProviderDescriptor | undefined {
  return PROVIDER_MAP.get(id);
}

/** Resolve a provider descriptor from an AI node type ("ai.openai" → OpenAI). */
export function providerByNodeType(nodeType: string): ProviderDescriptor | undefined {
  return PROVIDERS.find((p) => p.nodeType === nodeType);
}

/** Find a model within a provider by id (case-insensitive, returns undefined if unknown). */
export function findModel(provider: ProviderDescriptor, modelId: string | undefined): ModelPricing | undefined {
  if (!modelId) return undefined;
  const id = modelId.toLowerCase();
  return provider.models.find((m) => m.id.toLowerCase() === id);
}