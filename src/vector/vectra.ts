import { ensureDir } from "fs-extra";
import path from "node:path";
import {
  LocalIndex,
  type MetadataFilter,
  type QueryResult,
} from "vectra";
import type { MemoryLayer } from "../repositories/types";

type MemoryVectorMetadata = {
  memoryId: string;
  layer: MemoryLayer;
  importance: number;
};

type DocumentVectorMetadata = {
  chunkId: string;
  docId: string;
  positionStart: number;
  positionEnd: number;
  page?: number;
  layer?: string;
};

export interface VectraAdapterOptions {
  dataRoot: string;
  memoryCollection?: string;
  documentCollection?: string;
}

export interface UpsertMemoryVectorInput {
  memoryId: string;
  vector: number[];
  layer: MemoryLayer;
  importance: number;
}

export interface UpsertDocumentVectorInput {
  chunkId: string;
  docId: string;
  vector: number[];
  positionStart: number;
  positionEnd: number;
  page?: number;
  layer?: string;
}

export interface MemoryQueryOptions {
  topK?: number;
  layer?: MemoryLayer;
  minImportance?: number;
  metadataFilter?: MetadataFilter;
  query?: string;
  useKeywordFallback?: boolean;
}

export interface DocumentQueryOptions {
  topK?: number;
  docId?: string;
  layer?: string;
  metadataFilter?: MetadataFilter;
  query?: string;
  useKeywordFallback?: boolean;
}

export interface VectorQueryResult<TMetadata> {
  id: string;
  score: number;
  metadata: TMetadata;
}

export class VectraAdapter {
  readonly #options: Required<VectraAdapterOptions>;
  #memoryIndex!: LocalIndex<MemoryVectorMetadata>;
  #documentIndex!: LocalIndex<DocumentVectorMetadata>;
  #initialized = false;

  constructor(options: VectraAdapterOptions) {
    this.#options = {
      dataRoot: options.dataRoot,
      memoryCollection: options.memoryCollection ?? "memories",
      documentCollection: options.documentCollection ?? "doc_chunks",
    };
  }

  async initialize(): Promise<void> {
    if (this.#initialized) {
      return;
    }

    const vectorsRoot = path.resolve(this.#options.dataRoot, "vectors");
    const memoryPath = path.join(vectorsRoot, this.#options.memoryCollection);
    const documentPath = path.join(vectorsRoot, this.#options.documentCollection);

    await ensureDir(memoryPath);
    await ensureDir(documentPath);

    this.#memoryIndex = new LocalIndex<MemoryVectorMetadata>(memoryPath);
    this.#documentIndex = new LocalIndex<DocumentVectorMetadata>(documentPath);

    if (!(await this.#memoryIndex.isIndexCreated())) {
      await this.#memoryIndex.createIndex({ version: 1 });
    }

    if (!(await this.#documentIndex.isIndexCreated())) {
      await this.#documentIndex.createIndex({ version: 1 });
    }

    this.#initialized = true;
  }

  async upsertMemoryVector(input: UpsertMemoryVectorInput): Promise<void> {
    await this.initialize();

    await this.#memoryIndex.upsertItem({
      id: input.memoryId,
      metadata: {
        memoryId: input.memoryId,
        layer: input.layer,
        importance: input.importance,
      },
      vector: input.vector,
    });
  }

  async upsertDocumentVector(input: UpsertDocumentVectorInput): Promise<void> {
    await this.initialize();

    await this.#documentIndex.upsertItem({
      id: input.chunkId,
      metadata: {
        chunkId: input.chunkId,
        docId: input.docId,
        positionStart: input.positionStart,
        positionEnd: input.positionEnd,
        ...(typeof input.page === "number" ? { page: input.page } : {}),
        ...(input.layer ? { layer: input.layer } : {}),
      },
      vector: input.vector,
    });
  }

  async deleteMemoryVector(memoryId: string): Promise<void> {
    await this.initialize();
    await this.#memoryIndex.deleteItem(memoryId);
  }

  async deleteDocumentVector(chunkId: string): Promise<void> {
    await this.initialize();
    await this.#documentIndex.deleteItem(chunkId);
  }

  async queryMemories(
    vector: number[],
    options: MemoryQueryOptions = {},
  ): Promise<VectorQueryResult<MemoryVectorMetadata>[]> {
    await this.initialize();

    const topK = options.topK ?? 20;
    const filter = mergeFilters([
      options.metadataFilter,
      options.layer ? makeEqFilter("layer", options.layer) : undefined,
      typeof options.minImportance === "number"
        ? makeGteFilter("importance", options.minImportance)
        : undefined,
    ]);

    const results = await this.#memoryIndex.queryItems(
      vector,
      options.query ?? "",
      topK,
      filter,
      options.useKeywordFallback ?? false,
    );

    return mapResults(results);
  }

  async queryDocumentChunks(
    vector: number[],
    options: DocumentQueryOptions = {},
  ): Promise<VectorQueryResult<DocumentVectorMetadata>[]> {
    await this.initialize();

    const topK = options.topK ?? 20;
    const filter = mergeFilters([
      options.metadataFilter,
      options.docId ? makeEqFilter("docId", options.docId) : undefined,
      options.layer ? makeEqFilter("layer", options.layer) : undefined,
    ]);

    const results = await this.#documentIndex.queryItems(
      vector,
      options.query ?? "",
      topK,
      filter,
      options.useKeywordFallback ?? false,
    );

    return mapResults(results);
  }

  async stats(): Promise<{
    memories: number;
    docChunks: number;
  }> {
    await this.initialize();
    const memoryStats = await this.#memoryIndex.getIndexStats();
    const documentStats = await this.#documentIndex.getIndexStats();
    return {
      memories: memoryStats.items,
      docChunks: documentStats.items,
    };
  }

  async healthCheck(): Promise<{
    ok: boolean;
    memoryIndex: boolean;
    documentIndex: boolean;
  }> {
    await this.initialize();
    const memoryIndex = await this.#memoryIndex.isIndexCreated();
    const documentIndex = await this.#documentIndex.isIndexCreated();
    return {
      ok: memoryIndex && documentIndex,
      memoryIndex,
      documentIndex,
    };
  }
}

function mapResults<TMetadata>(
  results: QueryResult<TMetadata>[],
): VectorQueryResult<TMetadata>[] {
  return results.map((result) => ({
    id: result.item.id,
    score: result.score,
    metadata: result.item.metadata as TMetadata,
  }));
}

function makeEqFilter(
  key: string,
  value: string | number | boolean,
): MetadataFilter {
  return { [key]: { $eq: value } } as MetadataFilter;
}

function makeGteFilter(
  key: string,
  value: number,
): MetadataFilter {
  return { [key]: { $gte: value } } as MetadataFilter;
}

function mergeFilters(filters: Array<MetadataFilter | undefined>): MetadataFilter | undefined {
  const defined = filters.filter(
    (filter): filter is MetadataFilter => Boolean(filter),
  );

  if (defined.length === 0) {
    return undefined;
  }

  if (defined.length === 1) {
    return defined[0];
  }

  return { $and: defined } as MetadataFilter;
}

