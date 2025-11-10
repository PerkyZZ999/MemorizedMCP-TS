import type { DocumentChunkDTO, DocumentIngestionResult } from "../schemas/document";
import type {
  MemoryRecordDTO,
  MemorySearchRequest,
  MemorySearchResult,
} from "../schemas/memory";
import type { KnowledgeEntityDTO, KnowledgeEntityDetailDTO, KnowledgeEdgeDTO, KnowledgeGraphSnapshotDTO, KnowledgeEntityContextDTO, ExtractedEntity, KnowledgeGetEntityRequest, KnowledgeCreateEntityRequest, KnowledgeUpdateEntityRequest, KnowledgeDeleteEntityRequest, KnowledgeCreateRelationRequest, KnowledgeGetRelationsRequest, KnowledgeDeleteRelationRequest, KnowledgeSearchRelationsRequest, KnowledgeSearchEntitiesRequest, KnowledgeGetEntitiesByTypeRequest, KnowledgeGetEntitiesByTagRequest, KnowledgeTagEntityRequest, KnowledgeRemoveTagRequest, KnowledgeGetTagsRequest, KnowledgeReadGraphRequest, KnowledgeGetRelatedEntitiesRequest, KnowledgeFindPathRequest, KnowledgeGetEntityContextRequest, KnowledgeGetEntitiesInDocumentRequest, KnowledgeGetEntitiesInMemoryRequest } from "../schemas/knowledge";
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
  updateDocument(input: { id: string; metadata?: Record<string, unknown>; title?: string }): Promise<DocumentIngestionResult["document"]>;
  deleteDocument(input: { id: string }): Promise<void>;
  searchDocuments(input: { query: string; limit?: number; offset?: number }): Promise<DocumentIngestionResult["document"][]>;
  getDocumentReferences(input: { docId: string }): Promise<any[]>;
  analyzeDocument(input: { docId: string }): Promise<any>;
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
  getMemory(input: { id: string }): Promise<MemoryRecordDTO | undefined>;
  getMemoriesByEntity(input: { entityId: string; limit?: number; offset?: number }): Promise<MemoryRecordDTO[]>;
  getMemoriesByDocument(input: { docId: string; limit?: number; offset?: number }): Promise<MemoryRecordDTO[]>;
}

export interface KnowledgeGraphService {
  ensureEntities(entities: ExtractedEntity[], context: { docId?: string }): Promise<KnowledgeEntityDTO[]>;
  listEntities(limit?: number, offset?: number): Promise<KnowledgeEntityDTO[]>;
  getEntity(request: KnowledgeGetEntityRequest): Promise<KnowledgeEntityDetailDTO | undefined>;
  createEntity(input: KnowledgeCreateEntityRequest): Promise<KnowledgeEntityDTO>;
  updateEntity(input: KnowledgeUpdateEntityRequest): Promise<KnowledgeEntityDTO>;
  deleteEntity(input: KnowledgeDeleteEntityRequest): Promise<void>;
  createRelation(input: KnowledgeCreateRelationRequest): Promise<KnowledgeEdgeDTO>;
  getEntityRelations(input: KnowledgeGetRelationsRequest): Promise<KnowledgeEdgeDTO[]>;
  deleteRelation(input: KnowledgeDeleteRelationRequest): Promise<void>;
  searchRelations(input: KnowledgeSearchRelationsRequest): Promise<KnowledgeEdgeDTO[]>;
  searchEntities(input: KnowledgeSearchEntitiesRequest): Promise<KnowledgeEntityDTO[]>;
  getEntitiesByType(input: KnowledgeGetEntitiesByTypeRequest): Promise<KnowledgeEntityDTO[]>;
  getEntitiesByTag(input: KnowledgeGetEntitiesByTagRequest): Promise<KnowledgeEntityDTO[]>;
  tagEntity(input: KnowledgeTagEntityRequest): Promise<KnowledgeEntityDTO>;
  removeTag(input: KnowledgeRemoveTagRequest): Promise<KnowledgeEntityDTO>;
  getTags(input: KnowledgeGetTagsRequest): Promise<string[]>;
  readGraph(input: KnowledgeReadGraphRequest): Promise<KnowledgeGraphSnapshotDTO>;
  getRelatedEntities(input: KnowledgeGetRelatedEntitiesRequest): Promise<KnowledgeEntityDTO[]>;
  findPath(input: KnowledgeFindPathRequest): Promise<KnowledgeEdgeDTO[]>;
  getEntityContext(input: KnowledgeGetEntityContextRequest): Promise<KnowledgeEntityContextDTO>;
  getEntitiesInDocument(input: KnowledgeGetEntitiesInDocumentRequest): Promise<KnowledgeEntityDTO[]>;
  getEntitiesInMemory(input: KnowledgeGetEntitiesInMemoryRequest): Promise<KnowledgeEntityDTO[]>;
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

