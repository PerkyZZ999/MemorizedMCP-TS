import type { EmbeddingProvider } from "./types";

type FeatureExtractionPipeline =
  | ((inputs: string[], options?: Record<string, unknown>) => Promise<any>)
  | undefined;

/**
 * Embedding provider that prefers Transformers.js for high-quality embeddings and
 * falls back to a deterministic hashing strategy when the model cannot be loaded.
 */
export class TransformersEmbeddingProvider implements EmbeddingProvider {
  #modelId: string;
  #pipelinePromise?: Promise<FeatureExtractionPipeline>;

  constructor(modelId: string) {
    this.#modelId = modelId;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (this.#modelId === "hash" || this.#modelId === "none" || this.#modelId === "local") {
      return texts.map((text, index) => this.#hashEmbedding(text, index));
    }

    const pipeline = await this.#getPipeline();

    if (pipeline) {
      try {
        const output = await pipeline(texts, {
          pooling: "mean",
          normalize: true,
        });

        // Transformers.js may return a single tensor or an array of tensors depending on batching.
        if (Array.isArray(output)) {
          return output.map((item) => this.#tensorToArray(item));
        }

        return [this.#tensorToArray(output)];
      } catch (error) {
        console.warn(
          "[TransformersEmbeddingProvider] Failed to compute embeddings via Transformers.js. Falling back to hashing.",
          error,
        );
      }
    }

    return texts.map((text, index) => this.#hashEmbedding(text, index));
  }

  async #getPipeline(): Promise<FeatureExtractionPipeline> {
    if (this.#pipelinePromise) {
      return this.#pipelinePromise;
    }

    this.#pipelinePromise = (async () => {
      try {
        const { pipeline } = await import("@xenova/transformers");
        return pipeline("feature-extraction", this.#modelId);
      } catch (error) {
        console.warn(
          `[TransformersEmbeddingProvider] Unable to load model "${this.#modelId}".`,
          error,
        );
        return undefined;
      }
    })();

    return this.#pipelinePromise;
  }

  #tensorToArray(result: any): number[] {
    if (!result) {
      return [];
    }
    if (typeof result.tolist === "function") {
      return result.tolist();
    }
    if (Array.isArray(result)) {
      return result.map((value) => Number(value) || 0);
    }
    if (Array.isArray(result.data)) {
      return result.data.map((value: unknown) => Number(value) || 0);
    }
    if (Array.isArray(result.output)) {
      return result.output.map((value: unknown) => Number(value) || 0);
    }
    if (Array.isArray(result.raw)) {
      return result.raw.map((value: unknown) => Number(value) || 0);
    }
    return [];
  }

  #hashEmbedding(text: string, seed = 0): number[] {
    const vectorLength = 32;
    const vector = new Array<number>(vectorLength).fill(0);
    const normalized = text ?? "";
    for (let index = 0; index < normalized.length; index += 1) {
      const charCode = normalized.charCodeAt(index);
      const position = (index + seed) % vectorLength;
      vector[position] = (vector[position] + charCode) % 1_000;
    }
    // Normalize to unit vector to mimic cosine semantics.
    const magnitude = Math.sqrt(
      vector.reduce((sum, value) => sum + value * value, 0),
    );
    if (magnitude === 0) {
      return vector;
    }
    return vector.map((value) => value / magnitude);
  }
}

