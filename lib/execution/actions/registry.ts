import "server-only";
import { runIntegrationAction } from "@/lib/integrations";
import { runMcpAction } from "./mcp";
import type { ActionLogEvent, ActionResult } from "@/lib/integrations/types";

export type { ActionLogEvent, ActionResult };

export interface ActionMeta {
  providerId: string;
  actionId: string;
}

// nodeType → provider + action. Keep in sync with lib/integrations/providers/gmail
// (GMAIL_ACTIONS) and lib/nodes.ts (the 12 gmail.* node defs).
const ACTION_MAP: Record<string, ActionMeta> = {
  "gmail.trigger.newEmail": { providerId: "gmail", actionId: "newEmail" },
  "gmail.send": { providerId: "gmail", actionId: "send" },
  "gmail.reply": { providerId: "gmail", actionId: "reply" },
  "gmail.forward": { providerId: "gmail", actionId: "forward" },
  "gmail.search": { providerId: "gmail", actionId: "search" },
  "gmail.read": { providerId: "gmail", actionId: "read" },
  "gmail.draft": { providerId: "gmail", actionId: "draft" },
  "gmail.label.add": { providerId: "gmail", actionId: "label.add" },
  "gmail.label.remove": { providerId: "gmail", actionId: "label.remove" },
  "gmail.archive": { providerId: "gmail", actionId: "archive" },
  "gmail.markRead": { providerId: "gmail", actionId: "markRead" },
  "gmail.delete": { providerId: "gmail", actionId: "delete" },
  // MCP nodes — routed to runMcpAction below (engine.ts unchanged).
  "mcp.tool": { providerId: "mcp", actionId: "tool" },
  "mcp.resource": { providerId: "mcp", actionId: "resource" },
};

/** Whether a node type has a real integration action (vs. simulated). */
export function resolveAction(nodeType: string): ActionMeta | undefined {
  return ACTION_MAP[nodeType];
}

/**
 * Run a node's real integration action as a streaming generator. Yields
 * `{ type: "log", log }` events for live execution logs and returns the final
 * ActionResult. The engine drains this, yielding each log as a `node:log`
 * SSE event, then reads the result to decide success/failure + retries.
 */
export async function* runAction(args: {
  userId: string;
  nodeType: string;
  config: Record<string, unknown>;
  inputs: unknown[];
  stopped: () => boolean;
}): AsyncGenerator<ActionLogEvent, ActionResult, unknown> {
  const meta = resolveAction(args.nodeType);
  if (!meta) {
    return { status: "failed", error: `No action handler for node type ${args.nodeType}`, retryable: false };
  }
  // MCP nodes go through the MCP runtime (Agent Runtime → MCP Runtime → servers).
  // Routed here so engine.ts keeps draining runAction generically with no change.
  if (meta.providerId === "mcp") {
    return yield* runMcpAction(args);
  }
  return yield* runIntegrationAction({
    userId: args.userId,
    nodeType: args.nodeType,
    actionId: meta.actionId,
    config: args.config,
    inputs: args.inputs,
    stopped: args.stopped,
  });
}