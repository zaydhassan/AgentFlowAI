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