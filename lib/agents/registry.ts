// ============================================================
// Multi-Agent Runtime — agent registry
// ============================================================
// A simple plugin registry. Agents register an AgentDefinition; the graph
// builder iterates the registry to wire LangGraph nodes. Adding an agent later
// = call registerAgent(...) at import time — no runtime edits required.
//
// Server-only (agents pull server-only tools).

import "server-only";
import type { AgentDefinition, AgentId } from "./types";

const REGISTRY = new Map<AgentId, AgentDefinition>();
const ORDER: AgentId[] = [];

/** Register (or replace) an agent definition. Idempotent per id. */
export function registerAgent(def: AgentDefinition): void {
  if (!REGISTRY.has(def.id)) ORDER.push(def.id);
  REGISTRY.set(def.id, def);
}

export function getAgent(id: AgentId): AgentDefinition | undefined {
  return REGISTRY.get(id);
}

export function allAgents(): AgentDefinition[] {
  return ORDER.map((id) => REGISTRY.get(id)!).filter(Boolean);
}

export function registeredAgentIds(): AgentId[] {
  return [...ORDER];
}

export function isRegistered(id: AgentId): boolean {
  return REGISTRY.has(id);
}

/** Test-only: clear the registry between unit runs. */
export function _resetRegistry(): void {
  REGISTRY.clear();
  ORDER.length = 0;
}