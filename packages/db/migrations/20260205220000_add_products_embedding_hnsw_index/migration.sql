-- Add HNSW index for vector similarity search on products.embedding
-- This enables index-accelerated approximate nearest neighbor search using cosine distance (<=>)
-- Per issue #202: Without this index, vector search does full scan + sort

-- Step 1: Alter column to have explicit dimensions (required for HNSW index)
-- The embedding model (text-embedding-3-small) produces 1536-dimensional vectors
ALTER TABLE products ALTER COLUMN embedding TYPE vector(1536);

-- Step 2: Create HNSW index for cosine distance searches
-- HNSW parameters (using defaults):
-- m = 16 (connections per node - higher = better recall, more memory)
-- ef_construction = 64 (build-time search depth - higher = better recall, slower build)
CREATE INDEX IF NOT EXISTS products_embedding_hnsw_idx
ON products
USING hnsw (embedding vector_cosine_ops);
