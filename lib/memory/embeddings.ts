import "server-only";
import type { EmbeddingProvider, EmbeddingProviderId, EmbeddingVector } from "./types";

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const EMBEDDING_PROVIDER = (process.env.MEMORY_EMBEDDING_PROVIDER ?? "openai") as EmbeddingProviderId;
const EMBEDDING_MODEL = process.env.MEMORY_EMBEDDING_MODEL ?? "text-embedding-3-small";
const EMBEDDING_DIM = Number(process.env.MEMORY_EMBEDDING_DIM ?? 1536);

// OpenAI accepts up to 2048 inputs per request; 64 is a sane batch that keeps
// payloads modest and lets us stream progress.
const OPENAI_BATCH = 64;

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly id = "openai" as const;
  readonly model = EMBEDDING_MODEL;
  readonly dims = EMBEDDING_DIM;
  readonly configured = Boolean(OPENAI_KEY);

  async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
    if (!OPENAI_KEY) throw new Error("OpenAI embeddings not configured (set OPENAI_API_KEY).");
    const out: EmbeddingVector[] = [];
    for (let i = 0; i < texts.length; i += OPENAI_BATCH) {
      const slice = texts.slice(i, i + OPENAI_BATCH);
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_KEY}`,
        },
        body: JSON.stringify({ model: this.model, input: slice }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => res.statusText);
        throw new Error(`OpenAI embeddings error ${res.status}: ${t.slice(0, 200)}`);
      }
      const json = (await res.json()) as { data: { embedding: number[] }[] };
      for (const d of json.data) out.push({ vector: d.embedding, dims: d.embedding.length, model: this.model });
    }
    return out;
  }

  async embedOne(text: string): Promise<EmbeddingVector> {
    const [v] = await this.embedBatch([text]);
    return v;
  }
}

const providers: Record<EmbeddingProviderId, EmbeddingProvider> = {
  openai: new OpenAIEmbeddingProvider(),
};

/** Active embedding provider, selected by MEMORY_EMBEDDING_PROVIDER (default openai). */
export function getEmbeddingProvider(): EmbeddingProvider {
  return providers[EMBEDDING_PROVIDER] ?? providers.openai;
}

/** True when the active provider has its credentials configured. */
export function embeddingConfigured(): boolean {
  return getEmbeddingProvider().configured;
}

export { EMBEDDING_MODEL, EMBEDDING_DIM };