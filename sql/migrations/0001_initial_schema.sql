CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  layer TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  importance REAL NOT NULL DEFAULT 0.5 CHECK (importance BETWEEN 0.0 AND 1.0),
  session_id TEXT,
  episode_id TEXT,
  summary TEXT,
  embedding_id TEXT
);

CREATE TABLE IF NOT EXISTS memory_refs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  memory_id TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  chunk_id TEXT,
  score REAL,
  relation TEXT,
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
  FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE,
  UNIQUE (memory_id, doc_id, chunk_id)
);

CREATE TABLE IF NOT EXISTS episodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  session_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  hash TEXT NOT NULL UNIQUE,
  source_path TEXT,
  mime TEXT,
  title TEXT,
  metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
  ingested_at INTEGER NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0 CHECK (size_bytes >= 0)
);

CREATE TABLE IF NOT EXISTS doc_chunks (
  id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL,
  position_start INTEGER NOT NULL,
  position_end INTEGER NOT NULL,
  page INTEGER,
  content TEXT NOT NULL,
  summary TEXT,
  embedding_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
  FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE,
  CHECK (position_end >= position_start)
);

CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags))
);

CREATE TABLE IF NOT EXISTS kg_edges (
  id TEXT PRIMARY KEY,
  src TEXT NOT NULL,
  dst TEXT NOT NULL,
  relation TEXT NOT NULL,
  weight REAL,
  created_at INTEGER NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
  FOREIGN KEY (src) REFERENCES entities(id) ON DELETE CASCADE,
  FOREIGN KEY (dst) REFERENCES entities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tags (
  name TEXT PRIMARY KEY,
  description TEXT
);

CREATE TABLE IF NOT EXISTS memory_metrics (
  timestamp INTEGER NOT NULL,
  query_ms REAL NOT NULL,
  cache_hit INTEGER NOT NULL DEFAULT 0,
  result_count INTEGER NOT NULL,
  PRIMARY KEY (timestamp)
);

CREATE TABLE IF NOT EXISTS jobs (
  name TEXT PRIMARY KEY,
  last_run INTEGER,
  status TEXT NOT NULL DEFAULT 'idle',
  metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata))
);

CREATE INDEX IF NOT EXISTS idx_memories_layer_created_at ON memories(layer, created_at);
CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id);
CREATE INDEX IF NOT EXISTS idx_memories_episode ON memories(episode_id);
CREATE INDEX IF NOT EXISTS idx_memory_refs_memory ON memory_refs(memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_refs_doc ON memory_refs(doc_id);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_doc ON doc_chunks(doc_id, position_start);
CREATE INDEX IF NOT EXISTS idx_kg_edges_src ON kg_edges(src);
CREATE INDEX IF NOT EXISTS idx_kg_edges_dst ON kg_edges(dst);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_memories USING fts5(
  memory_id UNINDEXED,
  content,
  summary,
  layer,
  tokenize='porter'
);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_doc_chunks USING fts5(
  chunk_id UNINDEXED,
  doc_id UNINDEXED,
  content,
  tokenize='porter'
);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_entities USING fts5(
  entity_id UNINDEXED,
  name,
  type,
  tags,
  tokenize='porter'
);

CREATE TRIGGER IF NOT EXISTS trg_memories_ai AFTER INSERT ON memories BEGIN
  INSERT INTO fts_memories(memory_id, content, summary, layer)
  VALUES (new.id, new.content, COALESCE(new.summary, ''), new.layer);
END;

CREATE TRIGGER IF NOT EXISTS trg_memories_au AFTER UPDATE ON memories BEGIN
  UPDATE fts_memories
  SET content = new.content,
      summary = COALESCE(new.summary, ''),
      layer = new.layer
  WHERE memory_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_memories_ad AFTER DELETE ON memories BEGIN
  DELETE FROM fts_memories WHERE memory_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_doc_chunks_ai AFTER INSERT ON doc_chunks BEGIN
  INSERT INTO fts_doc_chunks(chunk_id, doc_id, content)
  VALUES (new.id, new.doc_id, new.content);
END;

CREATE TRIGGER IF NOT EXISTS trg_doc_chunks_au AFTER UPDATE ON doc_chunks BEGIN
  UPDATE fts_doc_chunks
  SET content = new.content,
      doc_id = new.doc_id
  WHERE chunk_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_doc_chunks_ad AFTER DELETE ON doc_chunks BEGIN
  DELETE FROM fts_doc_chunks WHERE chunk_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_entities_ai AFTER INSERT ON entities BEGIN
  INSERT INTO fts_entities(entity_id, name, type, tags)
  VALUES (new.id, new.name, new.type, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS trg_entities_au AFTER UPDATE ON entities BEGIN
  UPDATE fts_entities
  SET name = new.name,
      type = new.type,
      tags = new.tags
  WHERE entity_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_entities_ad AFTER DELETE ON entities BEGIN
  DELETE FROM fts_entities WHERE entity_id = old.id;
END;

