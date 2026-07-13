// ============================================================
// Multi-Agent Runtime — public facade
// ============================================================
// Server-only entry point. Re-exports the public API the execution engine and
// API routes use. Mirrors the lib/memory + lib/payments + lib/integrations
// facade pattern: one import surface, server-only.

import "server-only";

export { registerAgent, getAgent, allAgents, registeredAgentIds } from "./registry";
export { ensureAgentsRegistered } from "./agents";
export {
  startAgentRun,
  resumeAgentRun,
  runAgentsToCompletion,
  stopAgentRun,
  getAgentRun,
  timelineFor,
} from "./runtime";
export { buildGraph, WORKER_AGENTS, AGGREGATOR_NODE } from "./graph-builder";
export { AgentStateAnnotation } from "./state";
export { AgentMemoryGateway, PermissionError } from "./memory";
export { systemPromptFor, sharedPreamble } from "./prompts";
export { TraceCollector } from "./tracing";
export { agentComplete, agentCompleteJson } from "./llm";

export type {
  AgentId,
  InitialAgentId,
  AgentDefinition,
  AgentRunContext,
  AgentRunOptions,
  AgentRunResult,
  AgentEvent,
  AgentEventType,
  AgentState,
  AgentResult,
  AgentTimelineEntry,
  Subtask,
  WorkerAgent,
  ExecutionPlan,
  ReviewOutcome,
  RunTrace,
  TraceEvent,
  TraceKind,
  ExecutionGraphSnapshot,
  ToolId,
  InitialToolId,
  ToolPermission,
} from "./types";
// MCP agent-tool gateway — the ctx.tools surface (pure interface type; the
// concrete class lives in lib/mcp/gateway.ts and is constructed by the runtime).
export type { AgentToolGateway, McpToolDescriptor, InvokeOptions, McpCallResult } from "@/lib/mcp/types";

export type { GraphState } from "./state";