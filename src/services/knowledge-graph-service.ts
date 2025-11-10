import { randomUUID } from "node:crypto";
import type nlp from "compromise";
import { KnowledgeGraphRepository } from "../repositories/knowledge-graph-repository";
import type { KnowledgeEdgeRecord } from "../repositories/types";
import {
  KnowledgeEntitySchema,
  KnowledgeEntityDetailSchema,
  KnowledgeEdgeSchema,
  KnowledgeGraphSnapshotSchema,
  KnowledgeEntityContextSchema,
  KnowledgeGetEntityRequestSchema,
  KnowledgeCreateEntityRequestSchema,
  KnowledgeUpdateEntityRequestSchema,
  KnowledgeDeleteEntityRequestSchema,
  KnowledgeCreateRelationRequestSchema,
  KnowledgeGetRelationsRequestSchema,
  KnowledgeDeleteRelationRequestSchema,
  KnowledgeSearchRelationsRequestSchema,
  KnowledgeSearchEntitiesRequestSchema,
  KnowledgeGetEntitiesByTypeRequestSchema,
  KnowledgeGetEntitiesByTagRequestSchema,
  KnowledgeTagEntityRequestSchema,
  KnowledgeRemoveTagRequestSchema,
  KnowledgeGetTagsRequestSchema,
  KnowledgeReadGraphRequestSchema,
  KnowledgeGetRelatedEntitiesRequestSchema,
  KnowledgeFindPathRequestSchema,
  KnowledgeGetEntityContextRequestSchema,
  KnowledgeGetEntitiesInDocumentRequestSchema,
  KnowledgeGetEntitiesInMemoryRequestSchema,
  type ExtractedEntity,
  type KnowledgeEntityDTO,
  type KnowledgeEntityDetailDTO,
  type KnowledgeEdgeDTO,
  type KnowledgeGraphSnapshotDTO,
  type KnowledgeEntityContextDTO,
  type KnowledgeGetEntityRequest,
  type KnowledgeCreateEntityRequest,
  type KnowledgeUpdateEntityRequest,
  type KnowledgeDeleteEntityRequest,
  type KnowledgeCreateRelationRequest,
  type KnowledgeGetRelationsRequest,
  type KnowledgeDeleteRelationRequest,
  type KnowledgeSearchRelationsRequest,
  type KnowledgeSearchEntitiesRequest,
  type KnowledgeGetEntitiesByTypeRequest,
  type KnowledgeGetEntitiesByTagRequest,
  type KnowledgeTagEntityRequest,
  type KnowledgeRemoveTagRequest,
  type KnowledgeGetTagsRequest,
  type KnowledgeReadGraphRequest,
  type KnowledgeGetRelatedEntitiesRequest,
  type KnowledgeFindPathRequest,
  type KnowledgeGetEntityContextRequest,
  type KnowledgeGetEntitiesInDocumentRequest,
  type KnowledgeGetEntitiesInMemoryRequest,
} from "../schemas/knowledge";
import type { EntityExtractor, KnowledgeGraphService } from "./types";

export interface KnowledgeGraphServiceDependencies {
  repository: KnowledgeGraphRepository;
  documentRepository?: any; // DocumentRepository - avoid circular dependency
  memoryRepository?: any; // MemoryRepository - avoid circular dependency
  documentChunkRepository?: any; // DocumentChunkRepository - avoid circular dependency
  entityExtractor?: EntityExtractor;
}

export class DefaultKnowledgeGraphService implements KnowledgeGraphService {
  #repository: KnowledgeGraphRepository;
  #documentRepository?: any;
  #memoryRepository?: any;
  #documentChunkRepository?: any;
  #entityExtractor?: EntityExtractor;

  constructor(deps: KnowledgeGraphServiceDependencies) {
    this.#repository = deps.repository;
    this.#documentRepository = deps.documentRepository;
    this.#memoryRepository = deps.memoryRepository;
    this.#documentChunkRepository = deps.documentChunkRepository;
    this.#entityExtractor = deps.entityExtractor;
  }

  async ensureEntities(
    entities: ExtractedEntity[],
    context: { docId?: string },
  ): Promise<KnowledgeEntityDTO[]> {
    const ensured: KnowledgeEntityDTO[] = [];
    for (const entity of entities) {
      const stored = this.#repository.upsertEntity({
        name: entity.name,
        type: entity.type,
        tags: [],
      });

      // Track activity bump
      this.#repository.updateEntityActivity(stored.id, Date.now(), 1);

      ensured.push(KnowledgeEntitySchema.parse(stored));
    }

    return ensured;
  }

  async listEntities(limit = 50, offset = 0): Promise<KnowledgeEntityDTO[]> {
    const entities = this.#repository.listEntities(limit, offset);
    return entities.map((entity) => KnowledgeEntitySchema.parse(entity));
  }

  async getEntity(request: KnowledgeGetEntityRequest): Promise<KnowledgeEntityDetailDTO | undefined> {
    const parsed = KnowledgeGetEntityRequestSchema.parse(request);
    
    let entity;
    if (parsed.id) {
      entity = this.#repository.findById(parsed.id);
    } else if (parsed.name) {
      entity = this.#repository.findByName(parsed.name);
    } else {
      return undefined;
    }

    if (!entity) {
      return undefined;
    }

    // Get relation count
    const relations = this.#repository.listEdgesForEntity(entity.id);
    const relationCount = relations.length;

    return KnowledgeEntityDetailSchema.parse({
      ...entity,
      relationCount,
    });
  }

  async createEntity(input: KnowledgeCreateEntityRequest): Promise<KnowledgeEntityDTO> {
    const parsed = KnowledgeCreateEntityRequestSchema.parse(input);
    
    const entity = this.#repository.upsertEntity({
      name: parsed.name,
      type: parsed.type,
      tags: parsed.tags ?? [],
    });

    return KnowledgeEntitySchema.parse(entity);
  }

  async updateEntity(input: KnowledgeUpdateEntityRequest): Promise<KnowledgeEntityDTO> {
    const parsed = KnowledgeUpdateEntityRequestSchema.parse(input);
    
    const existing = this.#repository.findById(parsed.id);
    if (!existing) {
      throw new Error(`Entity ${parsed.id} not found`);
    }

    // Build update record
    const updateData: {
      name?: string;
      type?: string;
      tags?: string[];
    } = {};

    if (parsed.name !== undefined) {
      updateData.name = parsed.name;
    }
    if (parsed.type !== undefined) {
      updateData.type = parsed.type;
    }
    if (parsed.tags !== undefined) {
      updateData.tags = parsed.tags;
    }

    // Use repository update method
    const updated = this.#repository.updateEntity(parsed.id, updateData);

    return KnowledgeEntitySchema.parse(updated);
  }

  async deleteEntity(input: KnowledgeDeleteEntityRequest): Promise<void> {
    const parsed = KnowledgeDeleteEntityRequestSchema.parse(input);
    
    const existing = this.#repository.findById(parsed.id);
    if (!existing) {
      throw new Error(`Entity ${parsed.id} not found`);
    }

    // Delete entity (cascade deletes edges via foreign key)
    this.#repository.deleteEntity(parsed.id);
  }

  async createRelation(input: KnowledgeCreateRelationRequest): Promise<KnowledgeEdgeDTO> {
    const parsed = KnowledgeCreateRelationRequestSchema.parse(input);
    
    // Validate that both entities exist
    const srcEntity = this.#repository.findById(parsed.src);
    if (!srcEntity) {
      throw new Error(`Source entity ${parsed.src} not found`);
    }
    
    const dstEntity = this.#repository.findById(parsed.dst);
    if (!dstEntity) {
      throw new Error(`Destination entity ${parsed.dst} not found`);
    }

    const edge = this.#repository.upsertEdge({
      src: parsed.src,
      dst: parsed.dst,
      relation: parsed.relation,
      weight: parsed.weight,
      metadata: parsed.metadata ?? {},
    });

    return KnowledgeEdgeSchema.parse(edge);
  }

  async getEntityRelations(input: KnowledgeGetRelationsRequest): Promise<KnowledgeEdgeDTO[]> {
    const parsed = KnowledgeGetRelationsRequestSchema.parse(input);
    
    // Validate entity exists
    const entity = this.#repository.findById(parsed.entityId);
    if (!entity) {
      throw new Error(`Entity ${parsed.entityId} not found`);
    }

    const edges = parsed.relationType
      ? this.#repository.getEdgesByEntityAndType(parsed.entityId, parsed.relationType)
      : this.#repository.listEdgesForEntity(parsed.entityId);

    return edges.map((edge) => KnowledgeEdgeSchema.parse(edge));
  }

  async deleteRelation(input: KnowledgeDeleteRelationRequest): Promise<void> {
    const parsed = KnowledgeDeleteRelationRequestSchema.parse(input);
    
    const existing = this.#repository.findEdgeById(parsed.id);
    if (!existing) {
      throw new Error(`Relation ${parsed.id} not found`);
    }

    this.#repository.deleteEdge(parsed.id);
  }

  async searchRelations(input: KnowledgeSearchRelationsRequest): Promise<KnowledgeEdgeDTO[]> {
    const parsed = KnowledgeSearchRelationsRequestSchema.parse(input);
    
    let edges: KnowledgeEdgeRecord[];

    if (parsed.relationType) {
      // Search by relation type
      edges = this.#repository.searchEdgesByRelation(
        parsed.relationType,
        parsed.limit ?? 100,
        parsed.offset ?? 0,
      );
    } else {
      // If no specific search, return empty (or we could implement FTS search later)
      edges = [];
    }

    return edges.map((edge) => KnowledgeEdgeSchema.parse(edge));
  }

  async searchEntities(input: KnowledgeSearchEntitiesRequest): Promise<KnowledgeEntityDTO[]> {
    const parsed = KnowledgeSearchEntitiesRequestSchema.parse(input);
    const limit = parsed.limit ?? 100;
    const offset = parsed.offset ?? 0;

    let entities: KnowledgeEntityRecord[];

    if (parsed.name) {
      // Search by name using FTS5
      entities = this.#repository.searchEntitiesByName(parsed.name, limit, offset);
    } else {
      // Start with all entities
      entities = this.#repository.listEntities(limit * 2, offset); // Get more to filter
    }

    // Filter by type if specified
    if (parsed.type) {
      entities = entities.filter((e) => e.type === parsed.type);
    }

    // Filter by tags if specified
    if (parsed.tags && parsed.tags.length > 0) {
      entities = entities.filter((e) =>
        parsed.tags!.some((tag) => e.tags.includes(tag)),
      );
    }

    // Apply limit after filtering
    return entities.slice(0, limit).map((entity) => KnowledgeEntitySchema.parse(entity));
  }

  async getEntitiesByType(input: KnowledgeGetEntitiesByTypeRequest): Promise<KnowledgeEntityDTO[]> {
    const parsed = KnowledgeGetEntitiesByTypeRequestSchema.parse(input);
    const entities = this.#repository.findEntitiesByType(
      parsed.type,
      parsed.limit ?? 100,
      parsed.offset ?? 0,
    );
    return entities.map((entity) => KnowledgeEntitySchema.parse(entity));
  }

  async getEntitiesByTag(input: KnowledgeGetEntitiesByTagRequest): Promise<KnowledgeEntityDTO[]> {
    const parsed = KnowledgeGetEntitiesByTagRequestSchema.parse(input);
    const entities = this.#repository.findEntitiesByTag(
      parsed.tag,
      parsed.limit ?? 100,
      parsed.offset ?? 0,
    );
    return entities.map((entity) => KnowledgeEntitySchema.parse(entity));
  }

  async tagEntity(input: KnowledgeTagEntityRequest): Promise<KnowledgeEntityDTO> {
    const parsed = KnowledgeTagEntityRequestSchema.parse(input);
    
    const entity = this.#repository.findById(parsed.entityId);
    if (!entity) {
      throw new Error(`Entity ${parsed.entityId} not found`);
    }

    // Merge new tags with existing tags
    const existingTags = entity.tags;
    const newTags = [...new Set([...existingTags, ...parsed.tags])];

    const updated = this.#repository.setEntityTags(parsed.entityId, newTags);
    return KnowledgeEntitySchema.parse(updated);
  }

  async removeTag(input: KnowledgeRemoveTagRequest): Promise<KnowledgeEntityDTO> {
    const parsed = KnowledgeRemoveTagRequestSchema.parse(input);
    
    const entity = this.#repository.findById(parsed.entityId);
    if (!entity) {
      throw new Error(`Entity ${parsed.entityId} not found`);
    }

    // Remove the tag from existing tags
    const updatedTags = entity.tags.filter((tag) => tag !== parsed.tag);

    const updated = this.#repository.setEntityTags(parsed.entityId, updatedTags);
    return KnowledgeEntitySchema.parse(updated);
  }

  async getTags(input: KnowledgeGetTagsRequest): Promise<string[]> {
    KnowledgeGetTagsRequestSchema.parse(input);
    
    // Get all unique tags from entities
    return this.#repository.getAllTags();
  }

  async readGraph(input: KnowledgeReadGraphRequest): Promise<KnowledgeGraphSnapshotDTO> {
    const parsed = KnowledgeReadGraphRequestSchema.parse(input);
    
    const entity = this.#repository.findById(parsed.entityId);
    if (!entity) {
      throw new Error(`Entity ${parsed.entityId} not found`);
    }

    const relations = parsed.relationType
      ? this.#repository.getEdgesByEntityAndType(parsed.entityId, parsed.relationType)
      : this.#repository.listEdgesForEntity(parsed.entityId);

    // Collect neighbor entities up to specified depth using BFS
    const visited = new Set<string>([parsed.entityId]);
    const neighbors: KnowledgeEntityDTO[] = [];
    let currentLevel: string[] = [parsed.entityId];
    let depth = 0;

    while (depth < parsed.depth && currentLevel.length > 0) {
      const nextLevel: string[] = [];
      
      for (const entityId of currentLevel) {
        const edges = parsed.relationType
          ? this.#repository.getEdgesByEntityAndType(entityId, parsed.relationType)
          : this.#repository.listEdgesForEntity(entityId);

        for (const edge of edges) {
          const neighborId = edge.src === entityId ? edge.dst : edge.src;
          
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            const neighbor = this.#repository.findById(neighborId);
            if (neighbor) {
              neighbors.push(KnowledgeEntitySchema.parse(neighbor));
              if (depth < parsed.depth - 1) {
                nextLevel.push(neighborId);
              }
            }
          }
        }
      }

      currentLevel = nextLevel;
      depth++;
    }

    return KnowledgeGraphSnapshotSchema.parse({
      entity: KnowledgeEntitySchema.parse(entity),
      relations: relations.map((edge) => KnowledgeEdgeSchema.parse(edge)),
      neighbors,
    });
  }

  async getRelatedEntities(input: KnowledgeGetRelatedEntitiesRequest): Promise<KnowledgeEntityDTO[]> {
    const parsed = KnowledgeGetRelatedEntitiesRequestSchema.parse(input);
    
    const entity = this.#repository.findById(parsed.entityId);
    if (!entity) {
      throw new Error(`Entity ${parsed.entityId} not found`);
    }

    const edges = parsed.relationType
      ? this.#repository.getEdgesByEntityAndType(parsed.entityId, parsed.relationType)
      : this.#repository.listEdgesForEntity(parsed.entityId);

    const relatedEntityIds = new Set<string>();
    for (const edge of edges) {
      if (edge.src === parsed.entityId) {
        relatedEntityIds.add(edge.dst);
      } else {
        relatedEntityIds.add(edge.src);
      }
    }

    const entities: KnowledgeEntityDTO[] = [];
    for (const entityId of relatedEntityIds) {
      const relatedEntity = this.#repository.findById(entityId);
      if (relatedEntity) {
        entities.push(KnowledgeEntitySchema.parse(relatedEntity));
      }
    }

    // Apply limit
    const limit = parsed.limit ?? 100;
    return entities.slice(0, limit);
  }

  async findPath(input: KnowledgeFindPathRequest): Promise<KnowledgeEdgeDTO[]> {
    const parsed = KnowledgeFindPathRequestSchema.parse(input);
    
    // Validate both entities exist
    const srcEntity = this.#repository.findById(parsed.src);
    if (!srcEntity) {
      throw new Error(`Source entity ${parsed.src} not found`);
    }
    
    const dstEntity = this.#repository.findById(parsed.dst);
    if (!dstEntity) {
      throw new Error(`Destination entity ${parsed.dst} not found`);
    }

    // BFS to find shortest path
    const queue: Array<{ entityId: string; path: KnowledgeEdgeRecord[] }> = [
      { entityId: parsed.src, path: [] },
    ];
    const visited = new Set<string>([parsed.src]);

    while (queue.length > 0) {
      const { entityId, path } = queue.shift()!;

      if (entityId === parsed.dst) {
        // Found path
        return path.map((edge) => KnowledgeEdgeSchema.parse(edge));
      }

      if (path.length >= parsed.maxDepth) {
        continue;
      }

      // Get all edges from current entity
      const edges = this.#repository.listEdgesForEntity(entityId);
      
      for (const edge of edges) {
        const nextEntityId = edge.src === entityId ? edge.dst : edge.src;
        
        if (!visited.has(nextEntityId)) {
          visited.add(nextEntityId);
          queue.push({
            entityId: nextEntityId,
            path: [...path, edge],
          });
        }
      }
    }

    // No path found
    return [];
  }

  async getEntityContext(input: KnowledgeGetEntityContextRequest): Promise<KnowledgeEntityContextDTO> {
    const parsed = KnowledgeGetEntityContextRequestSchema.parse(input);
    
    const entity = this.#repository.findById(parsed.entityId);
    if (!entity) {
      throw new Error(`Entity ${parsed.entityId} not found`);
    }

    const documents: any[] = [];
    const memories: any[] = [];
    const chunks: any[] = [];

    // Search for entity mentions in document chunks using FTS
    if (this.#documentChunkRepository) {
      const matchingChunks = this.#documentChunkRepository.searchByEntityName(entity.name, 100);
      const docIds = new Set<string>();
      
      for (const chunk of matchingChunks) {
        chunks.push(chunk);
        docIds.add(chunk.docId);
      }

      // Get documents for matching chunks
      if (this.#documentRepository) {
        for (const docId of docIds) {
          const doc = this.#documentRepository.findById(docId);
          if (doc) {
            documents.push(doc);
          }
        }
      }
    }

    // Search for entity mentions in memories using FTS
    if (this.#memoryRepository) {
      const matchingMemories = this.#memoryRepository.searchByEntityName(entity.name, 100);
      memories.push(...matchingMemories);
    }

    return KnowledgeEntityContextSchema.parse({
      documents,
      memories,
      chunks,
    });
  }

  async getEntitiesInDocument(input: KnowledgeGetEntitiesInDocumentRequest): Promise<KnowledgeEntityDTO[]> {
    const parsed = KnowledgeGetEntitiesInDocumentRequestSchema.parse(input);
    
    if (!this.#documentRepository) {
      throw new Error("Document repository not available");
    }

    const document = this.#documentRepository.findById(parsed.docId);
    if (!document) {
      throw new Error(`Document ${parsed.docId} not found`);
    }

    // Get chunks for the document
    if (!this.#documentChunkRepository) {
      throw new Error("Document chunk repository not available");
    }

    const chunks = this.#documentChunkRepository.listByDocument(parsed.docId);
    
    // Extract entities from all chunks
    if (!this.#entityExtractor) {
      throw new Error("Entity extractor not available");
    }

    const allEntities = new Map<string, ExtractedEntity>();
    
    for (const chunk of chunks) {
      const extracted = await this.#entityExtractor.extract(chunk.content);
      for (const entity of extracted) {
        const key = entity.name.toLowerCase();
        if (!allEntities.has(key)) {
          allEntities.set(key, entity);
        }
      }
    }

    // Ensure entities exist and return them
    const entities = Array.from(allEntities.values());
    const ensured = await this.ensureEntities(entities, { docId: parsed.docId });
    
    return ensured;
  }

  async getEntitiesInMemory(input: KnowledgeGetEntitiesInMemoryRequest): Promise<KnowledgeEntityDTO[]> {
    const parsed = KnowledgeGetEntitiesInMemoryRequestSchema.parse(input);
    
    if (!this.#memoryRepository) {
      throw new Error("Memory repository not available");
    }

    const memory = this.#memoryRepository.findById(parsed.memoryId);
    if (!memory) {
      throw new Error(`Memory ${parsed.memoryId} not found`);
    }

    // Extract entities from memory content
    if (!this.#entityExtractor) {
      throw new Error("Entity extractor not available");
    }

    const extracted = await this.#entityExtractor.extract(memory.content);
    const ensured = await this.ensureEntities(extracted, {});
    
    return ensured;
  }
}

export interface CompromiseEntityExtractorOptions {
  /**
   * Custom compromise instance (for testability). Default uses dynamic import.
   */
  nlp?: typeof nlp;
}

export class CompromiseEntityExtractor implements EntityExtractor {
  #nlp?: typeof nlp;

  constructor(private readonly options: CompromiseEntityExtractorOptions = {}) {}

  async extract(text: string): Promise<ExtractedEntity[]> {
    if (!text.trim()) {
      return [];
    }

    const engine = await this.#loadEngine();
    const doc = engine(text);
    const people = doc.people().out("array") as string[];
    const places = doc.places().out("array") as string[];
    const organizations = doc.organizations().out("array") as string[];

    const seen = new Map<string, ExtractedEntity>();

    for (const name of people) {
      this.#remember(seen, name, "person");
    }

    for (const name of places) {
      this.#remember(seen, name, "place");
    }

    for (const name of organizations) {
      this.#remember(seen, name, "organization");
    }

    // fallback: simple noun extraction for remaining tokens
    if (seen.size === 0) {
      const nouns = doc.nouns().isSingular().out("array") as string[];
      for (const noun of nouns.slice(0, 5)) {
        this.#remember(seen, noun, "concept");
      }
    }

    return Array.from(seen.values());
  }

  async #loadEngine(): Promise<typeof nlp> {
    if (this.options.nlp) {
      return this.options.nlp;
    }
    if (!this.#nlp) {
      const mod = await import("compromise");
      this.#nlp = mod.default;
    }
    return this.#nlp!;
  }

  #remember(cache: Map<string, ExtractedEntity>, name: string, type: string) {
    const normalized = name.trim();
    if (!normalized) {
      return;
    }
    const key = normalized.toLowerCase();
    if (!cache.has(key)) {
      cache.set(key, { name: normalized, type, confidence: 0.6 });
    }
  }
}

