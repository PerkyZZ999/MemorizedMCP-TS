export type MemoryLayer =
  | "stm"
  | "ltm"
  | "episodic"
  | "semantic"
  | "documentary";

export interface MemoryReferenceInput {
  docId: string;
  chunkId?: string | null;
  score?: number | null;
  relation?: string | null;
}

export interface MemoryRecord {
  id: string;
  layer: MemoryLayer;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  importance: number;
  sessionId?: string | null;
  episodeId?: string | null;
  summary?: string | null;
  embeddingId?: string | null;
}

export interface NewMemoryRecord
  extends Omit<MemoryRecord, "createdAt" | "updatedAt"> {
  createdAt?: number;
  updatedAt?: number;
}

export interface DocumentRecord {
  id: string;
  hash: string;
  sourcePath?: string | null;
  mime?: string | null;
  title?: string | null;
  metadata: Record<string, unknown>;
  ingestedAt: number;
  sizeBytes: number;
}

export interface NewDocumentRecord
  extends Omit<DocumentRecord, "ingestedAt" | "sizeBytes"> {
  ingestedAt?: number;
  sizeBytes?: number;
  metadata?: Record<string, unknown>;
}

export interface DocumentChunkRecord {
  id: string;
  docId: string;
  positionStart: number;
  positionEnd: number;
  page?: number | null;
  content: string;
  summary?: string | null;
  embeddingId?: string | null;
  metadata: Record<string, unknown>;
}

export interface NewDocumentChunkRecord
  extends Omit<DocumentChunkRecord, "id"> {
  id?: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeEntityRecord {
  id: string;
  name: string;
  type: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  tags: string[];
}

export interface KnowledgeEdgeRecord {
  id: string;
  src: string;
  dst: string;
  relation: string;
  weight?: number | null;
  createdAt: number;
  metadata: Record<string, unknown>;
}

export interface NewKnowledgeEntityRecord
  extends Omit<KnowledgeEntityRecord, "id" | "count" | "firstSeen" | "lastSeen" | "tags"> {
  id?: string;
  count?: number;
  firstSeen?: number;
  lastSeen?: number;
  tags?: string[];
}

export interface NewKnowledgeEdgeRecord
  extends Omit<KnowledgeEdgeRecord, "id" | "createdAt" | "metadata"> {
  id?: string;
  createdAt?: number;
  metadata?: Record<string, unknown>;
}

export interface TagRecord {
  name: string;
  description?: string | null;
}

export interface MemoryMetricRecord {
  timestamp: number;
  queryMs: number;
  cacheHit: boolean;
  resultCount: number;
}

export interface JobRecord {
  name: string;
  lastRun?: number | null;
  status: string;
  metadata: Record<string, unknown>;
}

