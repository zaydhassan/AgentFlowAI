// ============================================================
// Multi-Agent Runtime — LangGraph shared state (Annotation)
// ============================================================
// The graph state shared by every agent node. Reducers define how parallel
// branches merge:
//  - `results` uses an object-merge reducer so the research/memory/reasoning
//    agents (which run in parallel) can each write their subtask results without
//    clobbering each other.
//  - `trace`, `reasoning`, `errors`, `memories` use concat reducers so parallel
//    branches append rather than overwrite.
//  - scalar fields (objective, plan, review, finalAnswer, iterations) use a
//    last-writer-wins reducer.
//
// Server-only — pulls LangGraph (a server dependency).

import "server-only";
import { Annotation } from "@langchain/langgraph";
import type {
  AgentResult,
  AgentState,
  ReviewOutcome,
  Subtask,
  TraceEvent,
  ExecutionPlan,
} from "./types";
import type { MemoryHit } from "@/lib/memory/types";

type S = AgentState;

export const AgentStateAnnotation = Annotation.Root({
  objective: Annotation<string>({
    reducer: (_, y) => y,
    default: () => "",
  }),
  context: Annotation<string>({
    reducer: (_, y) => y,
    default: () => "",
  }),
  plan: Annotation<ExecutionPlan | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),
  subtasks: Annotation<Subtask[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  results: Annotation<Record<string, AgentResult>>({
    // object-merge so parallel worker agents combine their subtask results.
    reducer: (a, b) => ({ ...(a ?? {}), ...(b ?? {}) }),
    default: () => ({}),
  }),
  memories: Annotation<MemoryHit[]>({
    reducer: (a, b) => [...(a ?? []), ...(b ?? [])],
    default: () => [],
  }),
  reasoningTrail: Annotation<string[]>({
    // Named `reasoningTrail` (not `reasoning`) to avoid colliding with the
    // `reasoning` agent's LangGraph node name — LangGraph forbids a node name
    // that matches a state channel.
    reducer: (a, b) => [...(a ?? []), ...(b ?? [])],
    default: () => [],
  }),
  review: Annotation<ReviewOutcome | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),
  finalAnswer: Annotation<string>({
    reducer: (_, y) => y,
    default: () => "",
  }),
  iterations: Annotation<number>({
    // adder: each planner pass contributes +1 across revision loops.
    reducer: (a, b) => (a ?? 0) + (b ?? 0),
    default: () => 0,
  }),
  trace: Annotation<TraceEvent[]>({
    reducer: (a, b) => [...(a ?? []), ...(b ?? [])],
    default: () => [],
  }),
  errors: Annotation<string[]>({
    reducer: (a, b) => [...(a ?? []), ...(b ?? [])],
    default: () => [],
  }),
});

export type { S };
export type GraphState = typeof AgentStateAnnotation.State;