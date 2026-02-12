-- Add explicit dimensions to the embedding column (required for HNSW index).
-- The embedding model (text-embedding-3-small) produces 1536-dimensional vectors.
ALTER TABLE products ALTER COLUMN embedding TYPE vector(1536);

-- NOTE: The HNSW index (products_embedding_hnsw_idx) is managed outside Prisma.
-- Prisma's introspection engine cannot recognize pgvector HNSW indexes, which
-- causes permanent drift detection. The index is created/maintained via manual SQL:
--
--   CREATE INDEX IF NOT EXISTS products_embedding_hnsw_idx
--   ON products USING hnsw (embedding vector_cosine_ops);
