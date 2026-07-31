// AI Cost Optimizer — preflight estimator.
//
// Computes a per-provider estimate (tokens, latency, cost, confidence) for a
// workflow graph BEFORE execution, plus cheapest/fastest/balanced
// recommendations. Reuses the execution engine's deterministic estimators
// (nodeTokens, nodeDurationMs, topoOrder) so the estimate aligns with what the
// engine actually accounts on a run — it never invents numbers. Cost is
// computed from the real per-model pricing in lib/ai/optimizer/providers.ts;
// any value that cannot be determined is null and renders as "Unknown".
//
// Server-only (imports the execution engine, which is server-only).

import "server-only";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types";
import { getNodeDef } from "@/lib/nodes";
import { nodeTokens, nodeDurationMs, topoOrder } from "@/lib/execution/engine";
import {
  PROVIDERS,
  getProvider,
  providerByNodeType,
  findModel,
  type ProviderDescriptor,
  type ModelPricing,
  type ProviderId,
  type Availability,
  type ModelTier,
} from "./providers";

export type Strategy = "cost" | "fast" | "balanced";

export interface NodeEstimate {
  nodeId: string;
  label: string;
  nodeType: string;
  providerId: ProviderId;
  providerLabel: string;
  model: string;
  modelKnown: boolean;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  latencyMs: number | null;
}

export interface ProviderEstimate {
  providerId: ProviderId;
  providerLabel: string;
  accent: string;
  modelId: string;
  modelLabel: string;
  available: Availability;
  tokens: number;
  costUsd: number | null;
  latencyMs: number | null;
  confidence: number; // 0..1
  eligible: boolean; // considered for recommendations (available !== false)
}

export interface Recommendation {
  providerId: ProviderId;
  providerLabel: string;
  modelId: string;
  modelLabel: string;
  costUsd: number | null;
  latencyMs: number | null;
  confidence: number;
}

export interface EstimateResponse {
  strategy: Strategy;
  aiNodeCount: number;
  totals: {
    tokens: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number | null;
    latencyMs: number | null;
    confidence: number;
  };
  current: {
    costUsd: number | null;
    latencyMs: number | null;
    confidence: number;
    note?: string;
  };
  estimates: ProviderEstimate[];
  recommendations: {
    cheapest: Recommendation | null;
    fastest: Recommendation | null;
    balanced: Recommendation | null;
  };
  recommended: Recommendation | null;
  nodes: NodeEstimate[];
  unknown: boolean; // no AI nodes / nothing to estimate
}

const CANVAS_TYPES = new Set(["sticky", "comment", "group"]);

function isAiNode(n: WorkflowNode): boolean {
  if (CANVAS_TYPES.has(n.type)) return false;
  const def = getNodeDef(n.type);
  return def?.category === "ai";
}

// Output tokens for a node: use configured maxTokens when set, else a 40%
// share of the engine's token estimate (the standard input/output heuristic).
function outputTokensFor(node: WorkflowNode, total: number): number {
  const mt = node.data.config?.maxTokens;
  if (typeof mt === "number" && mt > 0) return Math.min(mt, total);
  return Math.round(total * 0.4);
}

// Per-node latency under a specific provider model (AI nodes only). Returns
// null when throughput/TTFT are unknown for that model.
function aiLatencyMs(model: ModelPricing | undefined, outputTokens: number): number | null {
  if (!model || model.throughputTps == null || model.ttftMs == null) return null;
  return Math.round(model.ttftMs + (outputTokens / model.throughputTps) * 1000);
}

// Cost for a node under a specific model. null when prices are unknown.
function costFor(model: ModelPricing | undefined, inputTokens: number, outputTokens: number): number | null {
  if (!model || model.inputPer1M == null || model.outputPer1M == null) return null;
  return (inputTokens * model.inputPer1M + outputTokens * model.outputPer1M) / 1_000_000;
}

// Critical-path latency through the DAG. Each node's latency is provider-aware
// for AI nodes (under a given model) and provider-agnostic (nodeDurationMs) for
// everything else. Returns null if any AI node on the critical path has unknown
// latency under this provider/model — we can't give a confident total.
function criticalPathLatency(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  aiLatency: (node: WorkflowNode) => number | null,
): number | null {
  const order = topoOrder(nodes, edges);
  const finish = new Map<string, number>();
  for (const n of order) {
    let predMax = 0;
    for (const e of edges) {
      if (e.target === n.id) {
        const p = finish.get(e.source) ?? 0;
        if (p > predMax) predMax = p;
      }
    }
    let dur: number | null;
    if (isAiNode(n)) {
      dur = aiLatency(n);
    } else {
      dur = nodeDurationMs(n);
    }
    if (dur == null) {
      // Unknown latency on a node that's on every path through it; we can't
      // produce a confident critical-path total.
      return null;
    }
    finish.set(n.id, predMax + dur);
  }
  let max = 0;
  for (const v of finish.values()) if (v > max) max = v;
  return max;
}

// Confidence for a provider estimate. Lowered by: unavailability, unknown
// configured models, and the inherent heuristic nature of pre-run estimation.
function confidenceFor(provider: ProviderDescriptor, available: Availability, unknownModelCount: number): number {
  let c = 0.82;
  if (available === false) c -= 0.25;
  else if (available === "unknown") c -= 0.12;
  c -= 0.08 * unknownModelCount;
  c -= 0.05; // token estimate is heuristic (engine deterministic model)
  return Math.max(0, Math.min(1, c));
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Estimate a workflow's AI cost/latency/tokens per provider, with recommendations.
 * `strategy` selects which tier's representative model each provider's what-if
 * row uses (cost→cheap, fast→fast, balanced→balanced) and which recommendation
 * is returned as `recommended`.
 */
export function estimateWorkflow(graph: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }, strategy: Strategy = "balanced"): EstimateResponse {
  const aiNodes = graph.nodes.filter(isAiNode);

  if (aiNodes.length === 0) {
    return {
      strategy,
      aiNodeCount: 0,
      totals: { tokens: 0, inputTokens: 0, outputTokens: 0, costUsd: null, latencyMs: 0, confidence: 1 },
      current: { costUsd: null, latencyMs: 0, confidence: 1, note: "No AI nodes — nothing to estimate." },
      estimates: [],
      recommendations: { cheapest: null, fastest: null, balanced: null },
      recommended: null,
      nodes: [],
      unknown: true,
    };
  }

  // ── per-node token split (reuses the engine's token estimate) ──
  const nodeTok = new Map<string, { total: number; in: number; out: number }>();
  let totalTokens = 0;
  let totalIn = 0;
  let totalOut = 0;
  for (const n of aiNodes) {
    const total = nodeTokens(n);
    const out = outputTokensFor(n, total);
    const inp = Math.max(0, total - out);
    nodeTok.set(n.id, { total, in: inp, out });
    totalTokens += total;
    totalIn += inp;
    totalOut += out;
  }

  // ── per-node breakdown (configured provider/model) ──
  const nodes: NodeEstimate[] = aiNodes.map((n) => {
    const provider = providerByNodeType(n.type) ?? PROVIDERS[0];
    const modelId = typeof n.data.config?.model === "string" ? (n.data.config.model as string) : provider.representative.balanced;
    const model = findModel(provider, modelId);
    const { total, in: inp, out } = nodeTok.get(n.id)!;
    return {
      nodeId: n.id,
      label: n.data.label || getNodeDef(n.type)?.label || n.type,
      nodeType: n.type,
      providerId: provider.id,
      providerLabel: provider.label,
      model: modelId,
      modelKnown: Boolean(model),
      tokens: total,
      inputTokens: inp,
      outputTokens: out,
      costUsd: costFor(model, inp, out),
      latencyMs: aiLatencyMs(model, out),
    };
  });

  // ── current configuration aggregate ──
  const currentCost = nodes.every((n) => n.costUsd != null) ? nodes.reduce((s, n) => s + (n.costUsd ?? 0), 0) : null;
  const currentLatency = criticalPathLatency(graph.nodes, graph.edges, (n) => {
    const ne = nodes.find((x) => x.nodeId === n.id);
    return ne?.latencyMs ?? null;
  });
  const unknownModelsCurrent = nodes.filter((n) => !n.modelKnown).length;
  const currentConfidence = clamp01(0.82 - 0.08 * unknownModelsCurrent - 0.05);
  const currentNote = currentCost == null ? "Some AI nodes use models with unknown pricing." : undefined;

  // ── per-provider what-if (representative model for the selected strategy) ──
  const tierFor: Record<Strategy, ModelTier> = { cost: "cheap", fast: "fast", balanced: "balanced" };
  const tier = tierFor[strategy];

  const estimates: ProviderEstimate[] = PROVIDERS.map((provider) => {
    const modelId = provider.representative[tier];
    const model = findModel(provider, modelId)!; // representative ids are always in-table
    const available = provider.availability();

    // Cost: price the SAME workload (totalIn/totalOut) under this provider's
    // representative model. Always a number here (representative models are known).
    const cost = costFor(model, totalIn, totalOut);

    // Latency: AI nodes under this model; non-AI via nodeDurationMs.
    const latency = criticalPathLatency(graph.nodes, graph.edges, (n) => aiLatencyMs(model, nodeTok.get(n.id)?.out ?? 0));

    // Unknown-model penalty: configured models on this provider's nodes that
    // aren't in the table lower confidence.
    const unknownForProvider = nodes.filter((n) => n.providerId === provider.id && !n.modelKnown).length;
    const conf = confidenceFor(provider, available, unknownForProvider);

    return {
      providerId: provider.id,
      providerLabel: provider.label,
      accent: provider.accent,
      modelId,
      modelLabel: model.label,
      available,
      tokens: totalTokens,
      costUsd: cost,
      latencyMs: latency,
      confidence: conf,
      eligible: available !== false,
    };
  });

  const eligible = estimates.filter((e) => e.eligible && e.costUsd != null && e.latencyMs != null);

  // ── recommendations (each uses its own representative tier) ──
  const recForTier = (t: ModelTier, pick: "cost" | "latency"): Recommendation | null => {
    const rows = PROVIDERS.map((p) => {
      const m = findModel(p, p.representative[t])!;
      const c = costFor(m, totalIn, totalOut);
      const l = aiLatencyMs(m, totalOut); // single-model latency proxy for ranking
      const av = p.availability();
      return { p, m, c, l, av };
    }).filter((r) => r.av !== false && r.c != null && r.l != null);
    if (rows.length === 0) return null;
    const metric = pick === "cost" ? "c" : "l";
    const best = rows.reduce((best, r) => ((r[metric] ?? 0) < (best[metric] ?? 0) ? r : best));
    const est = estimates.find((e) => e.providerId === best.p.id)!;
    return {
      providerId: best.p.id,
      providerLabel: best.p.label,
      modelId: best.m.id,
      modelLabel: best.m.label,
      costUsd: est.costUsd,
      latencyMs: est.latencyMs,
      confidence: est.confidence,
    };
  };

  const cheapest = recForTier("cheap", "cost");
  const fastest = recForTier("fast", "latency");

  // Balanced = best rank-sum of cost and latency among eligible providers
  // (using their balanced representative models), robust to scale differences.
  const balanced = (() => {
    const rows = eligible.map((e) => ({ e }));
    const byCost = [...rows].sort((a, b) => (a.e.costUsd ?? 0) - (b.e.costUsd ?? 0));
    const byLat = [...rows].sort((a, b) => (a.e.latencyMs ?? 0) - (b.e.latencyMs ?? 0));
    const rank = new Map<ProviderId, number>();
    byCost.forEach((r, i) => rank.set(r.e.providerId, i));
    byLat.forEach((r, i) => rank.set(r.e.providerId, (rank.get(r.e.providerId) ?? 0) + i));
    if (rows.length === 0) return null;
    let best: ProviderEstimate | null = null;
    let bestRank = Infinity;
    for (const r of rows) {
      const rk = rank.get(r.e.providerId) ?? Infinity;
      if (rk < bestRank) { bestRank = rk; best = r.e; }
    }
    if (!best) return null;
    const p = getProvider(best.providerId)!;
    return {
      providerId: best.providerId,
      providerLabel: best.providerLabel,
      modelId: best.modelId,
      modelLabel: best.modelLabel,
      costUsd: best.costUsd,
      latencyMs: best.latencyMs,
      confidence: best.confidence,
    } satisfies Recommendation;
  })();

  const recommended: Recommendation | null = strategy === "cost" ? cheapest : strategy === "fast" ? fastest : balanced;

  return {
    strategy,
    aiNodeCount: aiNodes.length,
    totals: {
      tokens: totalTokens,
      inputTokens: totalIn,
      outputTokens: totalOut,
      costUsd: currentCost,
      latencyMs: currentLatency,
      confidence: currentConfidence,
    },
    current: { costUsd: currentCost, latencyMs: currentLatency, confidence: currentConfidence, ...(currentNote ? { note: currentNote } : {}) },
    estimates,
    recommendations: { cheapest, fastest, balanced },
    recommended,
    nodes,
    unknown: false,
  };
}