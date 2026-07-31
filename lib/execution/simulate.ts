// Workflow Simulation Mode — a pure, side-effect-free dry run.
//
// Reuses the execution engine's DETERMINISTIC graph-analysis helpers
// (topoOrder, nodeDurationMs, nodeTokens, nodeFailsOn) so the estimate matches
// what a real run would account — but NEVER calls runWorkflow, the integration
// action registry, the LLM provider, the multi-agent runtime, or the memory
// engine. Simulation therefore:
//   • never calls external APIs   • never sends emails
//   • never executes MCP tools      • never modifies the database
//   • never charges credits
// It is a static analysis of the graph: one plausible execution path, the
// conditional branches taken/skipped, and the nodes that might fail.
//
// Server-only (imports the execution engine, which is server-only). `Date.now`
// is not used — the estimate is fully deterministic from the graph.

import "server-only";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types";
import { getNodeDef } from "@/lib/nodes";
import { topoOrder, nodeDurationMs, nodeTokens, nodeFailsOn } from "@/lib/execution/engine";

export type SimNodeStatus = "executed" | "potential_failure" | "skipped_branch" | "skipped";

export interface SimPathNode {
  nodeId: string;
  label: string;
  type: string;
  category?: string;
  status: SimNodeStatus;
  durationMs: number;
  tokens: number;
  costUsd: number;
  isBranch?: boolean;
  branchTakenTargetId?: string;
  branchTakenTargetLabel?: string;
  reason?: string;
}

export interface SimBranch {
  nodeId: string;
  label: string;
  type: string;
  takenTargetId: string;
  takenTargetLabel: string;
  alternatives: { targetId: string; targetLabel: string }[];
}

export interface SimFailure {
  nodeId: string;
  label: string;
  type: string;
  severity: "retryable" | "hard";
  reason: string;
}

export interface SimulationResult {
  status: "completed" | "potential_failure";
  banner: "Simulation Complete" | "Potential Failure";
  nodeCount: number;
  executedCount: number;
  skippedCount: number;
  estimatedRuntimeMs: number;
  estimatedTokens: number;
  estimatedCostUsd: number;
  path: SimPathNode[];
  branches: SimBranch[];
  failures: SimFailure[];
  empty: boolean;
}

// Mirrors lib/execution/engine.ts TOKEN_RATE (illustrative $/token). Kept as a
// local constant so simulate.ts stays decoupled from the engine's internals
// while producing cost estimates consistent with real-run accounting.
const TOKEN_RATE = 0.002 / 1000;

// Node types whose outputs are MUTUALLY EXCLUSIVE (conditional branching): only
// one outgoing edge is taken, the rest are skipped. util.split is parallel
// fan-out (all edges taken) — deliberately NOT in this set.
const BRANCH_TYPES = new Set(["util.condition", "util.switch", "ai.router"]);

const CANVAS_TYPES = new Set(["sticky", "comment", "group"]);

// FNV-1a hash — mirrors the engine's own `hash` so branch selection is
// deterministic and stable across runs (a "potential" path, not a random one).
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function labelOf(n: WorkflowNode): string {
  return n.data.label || getNodeDef(n.type)?.label || n.type;
}

/**
 * Run a static simulation of a workflow graph. Pure: no I/O, no DB, no external
 * calls, no credits. Returns one plausible execution path, the branches taken,
 * estimated runtime/tokens/cost, and any potential failures.
 */
export function simulateWorkflow(graph: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }): SimulationResult {
  const nodes = graph.nodes.filter((n) => !CANVAS_TYPES.has(n.type));
  const edges = graph.edges;
  const byId = new Map(nodes.map((n) => [n.id, n] as const));

  if (nodes.length === 0) {
    return {
      status: "completed",
      banner: "Simulation Complete",
      nodeCount: 0,
      executedCount: 0,
      skippedCount: 0,
      estimatedRuntimeMs: 0,
      estimatedTokens: 0,
      estimatedCostUsd: 0,
      path: [],
      branches: [],
      failures: [],
      empty: true,
    };
  }

  // Outgoing + incoming edges per node.
  const out = new Map<string, WorkflowEdge[]>();
  for (const e of edges) {
    if (!out.has(e.source)) out.set(e.source, []);
    out.get(e.source)!.push(e);
  }
  const inEdges = new Map<string, WorkflowEdge[]>();
  for (const e of edges) {
    if (!inEdges.has(e.target)) inEdges.set(e.target, []);
    inEdges.get(e.target)!.push(e);
  }

  // ── branch decisions: which outgoing edge each branch node "takes" ──
  const takenEdgeIds = new Set<string>();
  const branchInfo = new Map<string, { taken: WorkflowEdge; alts: WorkflowEdge[] }>();
  for (const n of nodes) {
    const outs = out.get(n.id) ?? [];
    if (BRANCH_TYPES.has(n.type) && outs.length > 1) {
      const idx = hash(n.id + ":branch") % outs.length;
      const taken = outs[idx];
      takenEdgeIds.add(taken.id);
      branchInfo.set(n.id, { taken, alts: outs.filter((_, i) => i !== idx) });
    } else {
      // non-branch (incl. util.split parallel fan-out): every edge is followed
      for (const e of outs) takenEdgeIds.add(e.id);
    }
  }

  // ── reachability from roots, flowing only along taken edges ──
  const roots = nodes.filter((n) => (inEdges.get(n.id) ?? []).length === 0);
  const reachable = new Set<string>();
  const stack = roots.map((r) => r.id);
  while (stack.length) {
    const id = stack.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const e of out.get(id) ?? []) {
      if (takenEdgeIds.has(e.id) && byId.has(e.target) && !reachable.has(e.target)) {
        stack.push(e.target);
      }
    }
  }

  // Targets that are direct successors of a branch via a NON-taken edge →
  // "skipped_branch" (an alternative that wasn't taken this run).
  const branchAltTargets = new Set<string>();
  for (const { alts } of branchInfo.values()) {
    for (const e of alts) if (byId.has(e.target)) branchAltTargets.add(e.target);
  }

  // ── per-node classification + aggregates ──
  const order = topoOrder(nodes, edges);
  const path: SimPathNode[] = [];
  const failures: SimFailure[] = [];
  let runtimeMs = 0;
  let tokens = 0;
  let cost = 0;
  let executed = 0;
  let skipped = 0;

  for (const n of order) {
    const isReachable = reachable.has(n.id);
    const def = getNodeDef(n.type);
    const dur = nodeDurationMs(n);
    const tok = nodeTokens(n);
    const nodeCost = tok * TOKEN_RATE;

    if (!isReachable) {
      skipped++;
      const status: SimNodeStatus = branchAltTargets.has(n.id) ? "skipped_branch" : "skipped";
      path.push({ nodeId: n.id, label: labelOf(n), type: n.type, category: def?.category, status, durationMs: 0, tokens: 0, costUsd: 0 });
      continue;
    }

    // Reachable node — it WILL execute. Detect potential failure risk.
    let reason: string | undefined;
    let severity: "retryable" | "hard" | undefined;
    if (!def) {
      reason = "Unknown node type — may not execute correctly";
      severity = "hard";
    } else if (nodeFailsOn(n, 2)) {
      reason = "May fail after auto-retries";
      severity = "hard";
    } else if (nodeFailsOn(n, 0)) {
      reason = "May fail on first attempt (auto-retries)";
      severity = "retryable";
    }

    // util.merge with strategy "all" stalls if any predecessor is on a skipped
    // branch — a real deadlock risk only a path simulation surfaces.
    if (n.type === "util.merge") {
      const strategy = (n.data.config?.strategy as string) ?? "all";
      if (strategy === "all") {
        const preds = (inEdges.get(n.id) ?? []).map((e) => e.source);
        const unreachablePreds = preds.filter((p) => !reachable.has(p));
        if (unreachablePreds.length > 0) {
          reason = `Merge (strategy: all) waiting on ${unreachablePreds.length} skipped-branch input(s) — may stall`;
          severity = "hard";
        }
      }
    }

    runtimeMs += dur;
    tokens += tok;
    cost += nodeCost;
    executed++;

    const status: SimNodeStatus = reason ? "potential_failure" : "executed";
    const bi = branchInfo.get(n.id);
    path.push({
      nodeId: n.id,
      label: labelOf(n),
      type: n.type,
      category: def?.category,
      status,
      durationMs: dur,
      tokens: tok,
      costUsd: nodeCost,
      ...(bi ? { isBranch: true, branchTakenTargetId: bi.taken.target, branchTakenTargetLabel: byId.get(bi.taken.target) ? labelOf(byId.get(bi.taken.target)!) : bi.taken.target } : {}),
      ...(reason ? { reason } : {}),
    });

    if (reason && severity) {
      failures.push({ nodeId: n.id, label: labelOf(n), type: n.type, severity, reason });
    }
  }

  // ── branch summary ──
  const branches: SimBranch[] = [];
  for (const n of order) {
    const bi = branchInfo.get(n.id);
    if (!bi) continue;
    const takenLabel = byId.get(bi.taken.target) ? labelOf(byId.get(bi.taken.target)!) : bi.taken.target;
    const alts = bi.alts
      .filter((e) => byId.has(e.target))
      .map((e) => ({ targetId: e.target, targetLabel: byId.get(e.target) ? labelOf(byId.get(e.target)!) : e.target }));
    branches.push({ nodeId: n.id, label: labelOf(n), type: n.type, takenTargetId: bi.taken.target, takenTargetLabel: takenLabel, alternatives: alts });
  }

  const hasFailure = failures.length > 0;
  return {
    status: hasFailure ? "potential_failure" : "completed",
    banner: hasFailure ? "Potential Failure" : "Simulation Complete",
    nodeCount: nodes.length,
    executedCount: executed,
    skippedCount: skipped,
    estimatedRuntimeMs: runtimeMs,
    estimatedTokens: tokens,
    estimatedCostUsd: cost,
    path,
    branches,
    failures,
    empty: false,
  };
}