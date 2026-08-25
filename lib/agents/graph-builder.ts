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

  graph.addEdge(START, "planner");
  for (const w of WORKER_AGENTS) {
    if (opts.nodes[w]) graph.addEdge("planner", w);
  }

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