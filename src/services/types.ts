import type { DocumentChunkDTO, DocumentIngestionResult } from "../schemas/document";
import type {
  MemoryRecordDTO,
  MemorySearchRequest,
  MemorySearchResult,
} from "../schemas/memory";
import type { KnowledgeEntityDTO, ExtractedEntity } from "../schemas/knowledge";
import type { HybridSearchResult } from "../schemas/search";
import type { MemoryMetricDTO } from "../schemas/analytics";

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}

export interface TextSplitterChunk {
  text: string;
  start: number;
  end: number;
}

export interface TextSplitter {
  split(
    text: string,
    options: { chunkSize: number; chunkOverlap: number },
  ): TextSplitterChunk[];
}

export interface SummaryGenerator {
  summarize(text: string): Promise<string | undefined>;
}

export interface EntityExtractor {
  extract(text: string): Promise<ExtractedEntity[]>;
}

export interface DocumentService {
  ingest(request: {
    path?: string;
    mime?: string;
    content?: string;
    metadata?: Record<string, unknown>;
    hashOverride?: string;
    references?: Array<{
      docId: string;
      chunkId?: string;
      score?: number;
      relation?: string;
    }>;
    options?: {
      chunkSize?: number;
      chunkOverlap?: number;
      generateSummary?: boolean;
      detectEntities?: boolean;
    };
  }): Promise<DocumentIngestionResult>;

  getDocument(id: string): Promise<DocumentIngestionResult["document"] | undefined>;
  listDocuments(limit?: number, offset?: number): Promise<DocumentIngestionResult["document"][]>;
}

export interface MemoryService {
  addMemory(input: {
    content: string;
    layer: MemoryRecordDTO["layer"];
    metadata?: Record<string, unknown>;
    importance?: number;
    sessionId?: string;
    episodeId?: string;
    summary?: string;
    queryVector?: number[];
  }): Promise<MemoryRecordDTO>;

  updateMemory(id: string, patch: Partial<MemoryRecordDTO>): Promise<MemoryRecordDTO>;
  deleteMemory(id: string): Promise<void>;
  searchMemories(request: MemorySearchRequest): Promise<MemorySearchResult[]>;
}

export interface KnowledgeGraphService {
  ensureEntities(entities: ExtractedEntity[], context: { docId?: string }): Promise<KnowledgeEntityDTO[]>;
  listEntities(limit?: number, offset?: number): Promise<KnowledgeEntityDTO[]>;
}

export interface SearchService {
  searchMemories(request: MemorySearchRequest): Promise<HybridSearchResult[]>;
}

export interface AnalyticsService {
  recordMetric(metric: MemoryMetricDTO): void;
  listRecentMetrics(limit?: number): MemoryMetricDTO[];
}

export interface SystemServiceStatus {
  env: string;
  logLevel: string;
  dataRoot: string;
  vectra: {
    ok: boolean;
    memoryIndex: boolean;
    documentIndex: boolean;
    counts: {
      memories: number;
      docChunks: number;
    };
  };
}

export interface SystemService {
  status(): Promise<SystemServiceStatus>;
}

export interface ServiceRegistry {
  document: DocumentService;
  memory: MemoryService;
  knowledge: KnowledgeGraphService;
  search: SearchService;
  analytics: AnalyticsService;
  system: SystemService;
}

