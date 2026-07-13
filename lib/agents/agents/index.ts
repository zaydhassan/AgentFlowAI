// ============================================================
// Agent registrations
// ============================================================
// Imports register the six initial agents into the registry at module load.
// To add a new agent later: write a new AgentDefinition file and register it
// here (or call registerAgent at your import site). The runtime picks it up
// automatically — no runtime edits.
//
// Server-only.

import "server-only";
import { registerAgent } from "../registry";
import { plannerAgent } from "./planner";
import { researchAgent } from "./research";
import { memoryAgent } from "./memory";
import { reasoningAgent } from "./reasoning";
import { reviewerAgent } from "./reviewer";
import { executorAgent } from "./executor";

let registered = false;

/** Register all built-in agents once (idempotent). */
export function ensureAgentsRegistered(): void {
  if (registered) return;
  registerAgent(plannerAgent);
  registerAgent(researchAgent);
  registerAgent(memoryAgent);
  registerAgent(reasoningAgent);
  registerAgent(reviewerAgent);
  registerAgent(executorAgent);
  registered = true;
}

export { plannerAgent, researchAgent, memoryAgent, reasoningAgent, reviewerAgent, executorAgent };