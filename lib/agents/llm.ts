import "server-only";
import { completeText } from "@/lib/ai/provider";

export interface LlmCompletion {
  text: string;
  tokensUsed: number;
}

export interface JsonCompletion<T> {
  value: T;
  tokensUsed: number;
  /** True when the model output could not be parsed as JSON and we fell back. */
  fellBack: boolean;
}

export async function agentComplete(system: string, user: string, signal?: AbortSignal): Promise<LlmCompletion> {
  return completeText(system, user, signal);
}

export async function agentCompleteJson<T = Record<string, unknown>>(
  system: string,
  user: string,
  signal?: AbortSignal,
): Promise<JsonCompletion<T>> {
  const { text, tokensUsed } = await completeText(system, user, signal);
  const parsed = extractJson(text);
  if (parsed == null) {
    return { value: ({} as T), tokensUsed, fellBack: true };
  }
  return { value: parsed as T, tokensUsed, fellBack: false };
}

// Local copy of lib/ai/provider.extractJson's heuristic (kept private there).
// Parses a ```json fenced block, else the first balanced {...} span.

export function extractJson(text: string): Record<string, unknown> | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : text;
  const start = candidate.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    const c = candidate[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(candidate.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}