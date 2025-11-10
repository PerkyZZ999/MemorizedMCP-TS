import { z } from "zod";

export const KnowledgeEntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  count: z.number().int().nonnegative(),
  firstSeen: z.number(),
  lastSeen: z.number(),
  tags: z.array(z.string()).default([]),
});

export const KnowledgeEdgeSchema = z.object({
  id: z.string(),
  src: z.string(),
  dst: z.string(),
  relation: z.string(),
  weight: z.number().optional(),
  createdAt: z.number(),
  metadata: z.object({}).catchall(z.unknown()),
});

export const KnowledgeListEntitiesRequestSchema = z.object({
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
});

export const ExtractedEntitySchema = z.object({
  name: z.string(),
  type: z.string().default("other"),
  confidence: z.number().min(0).max(1).default(0.5),
});

// Entity Management Schemas
export const KnowledgeGetEntityRequestSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
}).refine((value) => value.id || value.name, {
  message: "Provide either id or name",
});

export const KnowledgeCreateEntityRequestSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  tags: z.array(z.string()).optional(),
});

export const KnowledgeUpdateEntityRequestSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  type: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const KnowledgeDeleteEntityRequestSchema = z.object({
  id: z.string(),
});

export const KnowledgeEntityDetailSchema = KnowledgeEntitySchema.extend({
  relationCount: z.number().int().nonnegative().default(0),
});

// Relationship Management Schemas
export const KnowledgeCreateRelationRequestSchema = z.object({
  src: z.string(),
  dst: z.string(),
  relation: z.string().min(1),
  weight: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const KnowledgeGetRelationsRequestSchema = z.object({
  entityId: z.string(),
  relationType: z.string().optional(),
});

export const KnowledgeDeleteRelationRequestSchema = z.object({
  id: z.string(),
});

export const KnowledgeSearchRelationsRequestSchema = z.object({
  query: z.string().optional(),
  relationType: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

// Entity Search Schemas
export const KnowledgeSearchEntitiesRequestSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
});

export const KnowledgeGetEntitiesByTypeRequestSchema = z.object({
  type: z.string().min(1),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
});

export const KnowledgeGetEntitiesByTagRequestSchema = z.object({
  tag: z.string().min(1),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
});

// Entity Tagging Schemas
export const KnowledgeTagEntityRequestSchema = z.object({
  entityId: z.string(),
  tags: z.array(z.string().min(1)),
});

export const KnowledgeRemoveTagRequestSchema = z.object({
  entityId: z.string(),
  tag: z.string().min(1),
});

export const KnowledgeGetTagsRequestSchema = z.object({});

// Graph Traversal Schemas
export const KnowledgeReadGraphRequestSchema = z.object({
  entityId: z.string(),
  depth: z.number().int().min(1).max(5).optional().default(1),
  relationType: z.string().optional(),
});

export const KnowledgeGraphSnapshotSchema = z.object({
  entity: KnowledgeEntitySchema,
  relations: z.array(KnowledgeEdgeSchema),
  neighbors: z.array(KnowledgeEntitySchema),
});

export const KnowledgeGetRelatedEntitiesRequestSchema = z.object({
  entityId: z.string(),
  relationType: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const KnowledgeFindPathRequestSchema = z.object({
  src: z.string(),
  dst: z.string(),
  maxDepth: z.number().int().min(1).max(10).optional().default(5),
});

// Entity Context Schemas
export const KnowledgeGetEntityContextRequestSchema = z.object({
  entityId: z.string(),
});

export const KnowledgeEntityContextSchema = z.object({
  documents: z.array(z.any()), // DocumentRecordDTO
  memories: z.array(z.any()), // MemoryRecordDTO
  chunks: z.array(z.any()), // DocumentChunkDTO
});

export const KnowledgeGetEntitiesInDocumentRequestSchema = z.object({
  docId: z.string(),
});

export const KnowledgeGetEntitiesInMemoryRequestSchema = z.object({
  memoryId: z.string(),
});

export type KnowledgeEntityDTO = z.infer<typeof KnowledgeEntitySchema>;
export type KnowledgeEdgeDTO = z.infer<typeof KnowledgeEdgeSchema>;
export type ExtractedEntity = z.infer<typeof ExtractedEntitySchema>;
export type KnowledgeListEntitiesRequest = z.infer<typeof KnowledgeListEntitiesRequestSchema>;
export type KnowledgeGetEntityRequest = z.infer<typeof KnowledgeGetEntityRequestSchema>;
export type KnowledgeCreateEntityRequest = z.infer<typeof KnowledgeCreateEntityRequestSchema>;
export type KnowledgeUpdateEntityRequest = z.infer<typeof KnowledgeUpdateEntityRequestSchema>;
export type KnowledgeDeleteEntityRequest = z.infer<typeof KnowledgeDeleteEntityRequestSchema>;
export type KnowledgeEntityDetailDTO = z.infer<typeof KnowledgeEntityDetailSchema>;
export type KnowledgeCreateRelationRequest = z.infer<typeof KnowledgeCreateRelationRequestSchema>;
export type KnowledgeGetRelationsRequest = z.infer<typeof KnowledgeGetRelationsRequestSchema>;
export type KnowledgeDeleteRelationRequest = z.infer<typeof KnowledgeDeleteRelationRequestSchema>;
export type KnowledgeSearchRelationsRequest = z.infer<typeof KnowledgeSearchRelationsRequestSchema>;
export type KnowledgeSearchEntitiesRequest = z.infer<typeof KnowledgeSearchEntitiesRequestSchema>;
export type KnowledgeGetEntitiesByTypeRequest = z.infer<typeof KnowledgeGetEntitiesByTypeRequestSchema>;
export type KnowledgeGetEntitiesByTagRequest = z.infer<typeof KnowledgeGetEntitiesByTagRequestSchema>;
export type KnowledgeTagEntityRequest = z.infer<typeof KnowledgeTagEntityRequestSchema>;
export type KnowledgeRemoveTagRequest = z.infer<typeof KnowledgeRemoveTagRequestSchema>;
export type KnowledgeGetTagsRequest = z.infer<typeof KnowledgeGetTagsRequestSchema>;
export type KnowledgeReadGraphRequest = z.infer<typeof KnowledgeReadGraphRequestSchema>;
export type KnowledgeGraphSnapshotDTO = z.infer<typeof KnowledgeGraphSnapshotSchema>;
export type KnowledgeGetRelatedEntitiesRequest = z.infer<typeof KnowledgeGetRelatedEntitiesRequestSchema>;
export type KnowledgeFindPathRequest = z.infer<typeof KnowledgeFindPathRequestSchema>;
export type KnowledgeGetEntityContextRequest = z.infer<typeof KnowledgeGetEntityContextRequestSchema>;
export type KnowledgeEntityContextDTO = z.infer<typeof KnowledgeEntityContextSchema>;
export type KnowledgeGetEntitiesInDocumentRequest = z.infer<typeof KnowledgeGetEntitiesInDocumentRequestSchema>;
export type KnowledgeGetEntitiesInMemoryRequest = z.infer<typeof KnowledgeGetEntitiesInMemoryRequestSchema>;

