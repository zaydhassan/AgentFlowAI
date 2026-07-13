// ============================================================
// Multi-Agent Runtime — LangGraph graph builder
// ============================================================
// Builds the orchestration graph from the agent registry:
//
//   START → planner ─┬→ research ─┐
//                    ├→ memory   ─┤→ aggregator → reviewer ──→ executor → END
//                    └→ reasoning ┘                    │
//                                          (revise) ←──┘
//
// Topology:
//  • planner fans out to the three worker agents in PARALLEL (plain edges —
//    LangGraph runs all successors of a node concurrently).
//  • research / memory / reasoning all edge into `aggregator`, which is a
//    join barrier — it runs once after all three complete. The `results`
//    channel's object-merge reducer combines their parallel writes.
//  • aggregator → reviewer.
//  • reviewer → conditional router:
//      - approved OR iterations >= maxIterations  → executor (terminates)
//      - otherwise                                → planner (revision loop)
//  • executor → END.
//
// Loop prevention: the planner increments `iterations` (adder reducer) on
// every pass; the router force-routes to executor once maxIterations is hit,
// and LangGraph's recursionLimit (passed at stream time) is a hard backstop.
//
// Human approval: when requireApproval, the graph compiles with
// interruptBefore:["reviewer"] so the run pauses for an operator decision
// before review. The runtime resumes via the thread_id (see runtime.ts).
//
// The builder is pure w.r.t. agent logic — it accepts pre-wrapped node
// functions, so it stays testable and the runtime owns retry/timeout/tracing.
//
// NOTE: LangGraph's StateGraph narrows node-name types statically, which
// breaks for our registry-driven (string-keyed) node set. We wire the graph
// through a permissive `WireableGraph` interface so adding agents never
// requires a type change here.

import "server-only";
import { END, MemorySaver, START, StateGraph } from "@langchain/langgraph";
import { AgentStateAnnotation, type GraphState } from "./state";
import type { ExecutionGraphSnapshot } from "./types";

export type NodeFn = (state: GraphState, config?: unknown) => Promise<Partial<GraphState>>;

export interface BuildGraphOptions {
  /** Pre-wrapped node functions keyed by node id. */
  nodes: Record<string, NodeFn>;
  /** Max planner↔reviewer revision loops. */
  maxIterations: number;
  /** Pause for human approval before the reviewer. */
  requireApproval: boolean;
  /** Fresh checkpointer per run (isolates thread state). */
  checkpointer?: MemorySaver;
}

export interface BuiltGraph {
  // The compiled graph is accessed through a permissive interface so the
  // runtime doesn't fight LangGraph's internal generics.
  compiled: {
    stream: (input: unknown, config: unknown) => AsyncIterable<unknown>;
    getState: (config: unknown) => Promise<{ next?: string[]; values?: GraphState }>;
  };
  snapshot: ExecutionGraphSnapshot;
}

// The static worker agents that run in parallel after the planner.
export const WORKER_AGENTS = ["research", "memory", "reasoning"] as const;
export const AGGREGATOR_NODE = "aggregator";

// Permissive wiring interface — sidesteps LangGraph's static node-name narrowing.
interface WireableGraph {
  addNode(id: string, fn: NodeFn): unknown;
  addEdge(from: string, to: string): unknown;
  addConditionalEdges(from: string, router: (state: GraphState) => string, mapping?: Record<string, string>): unknown;
  compile(opts?: Record<string, unknown>): BuiltGraph["compiled"];
}

export function buildGraph(opts: BuildGraphOptions): BuiltGraph {
  const raw = new StateGraph(AgentStateAnnotation);
  const graph = raw as unknown as WireableGraph;

  for (const [id, fn] of Object.entries(opts.nodes)) {
    graph.addNode(id, fn);
  }

  // planner fans out to the three workers in parallel.
  graph.addEdge(START, "planner");
  for (const w of WORKER_AGENTS) {
    if (opts.nodes[w]) graph.addEdge("planner", w);
  }

  // Workers join at the aggregator (barrier).
  for (const w of WORKER_AGENTS) {
    if (opts.nodes[w]) graph.addEdge(w, AGGREGATOR_NODE);
  }
  if (opts.nodes[AGGREGATOR_NODE]) graph.addEdge(AGGREGATOR_NODE, "reviewer");

  const maxIter = opts.maxIterations;
  graph.addConditionalEdges(
    "reviewer",
    (state: GraphState): "executor" | "planner" => {
      const approved = state.review?.approved === true;
      const exceeded = (state.iterations ?? 0) >= maxIter;
      if (approved || exceeded) return "executor";
      return "planner";
    },
    { executor: "executor", planner: "planner" },
  );

  graph.addEdge("executor", END);

  const compileOpts: Record<string, unknown> = {
    checkpointer: opts.checkpointer ?? new MemorySaver(),
  };
  if (opts.requireApproval) compileOpts.interruptBefore = ["reviewer"];

  const compiled = graph.compile(compileOpts);
  return { compiled, snapshot: graphSnapshot() };
}

/** Static execution-graph snapshot (for observability) — does not require a build. */
export const EXECUTION_GRAPH_SNAPSHOT: ExecutionGraphSnapshot = graphSnapshot();

function graphSnapshot(): ExecutionGraphSnapshot {
  return {
    nodes: [
      { id: "planner", label: "Planner" },
      { id: "research", label: "Research" },
      { id: "memory", label: "Memory" },
      { id: "reasoning", label: "Reasoning" },
      { id: "aggregator", label: "Aggregator" },
      { id: "reviewer", label: "Reviewer" },
      { id: "executor", label: "Executor" },
    ],
    edges: [
      { source: "START", target: "planner" },
      { source: "planner", target: "research" },
      { source: "planner", target: "memory" },
      { source: "planner", target: "reasoning" },
      { source: "research", target: "aggregator" },
      { source: "memory", target: "aggregator" },
      { source: "reasoning", target: "aggregator" },
      { source: "aggregator", target: "reviewer" },
      { source: "reviewer", target: "executor" },
      { source: "reviewer", target: "planner" },
      { source: "executor", target: "END" },
    ],
  };
}