import { randomUUID } from "node:crypto";
import type nlp from "compromise";
import { KnowledgeGraphRepository } from "../repositories/knowledge-graph-repository";
import {
  KnowledgeEntitySchema,
  type ExtractedEntity,
  type KnowledgeEntityDTO,
} from "../schemas/knowledge";
import type { EntityExtractor, KnowledgeGraphService } from "./types";

export interface KnowledgeGraphServiceDependencies {
  repository: KnowledgeGraphRepository;
}

export class DefaultKnowledgeGraphService implements KnowledgeGraphService {
  #repository: KnowledgeGraphRepository;

  constructor(deps: KnowledgeGraphServiceDependencies) {
    this.#repository = deps.repository;
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

