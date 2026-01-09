/**
 * Text Similarity Module
 *
 * Provides TF-IDF cosine similarity for comparing product titles.
 *
 * Design notes:
 * - TF-IDF cosine is the primary similarity measure (semantic relevance)
 * - Roadmap: Ensemble with Jaccard for edge cases (exact token overlap)
 * - Roadmap: Levenshtein as a cleanup/typo filter (character-level similarity)
 */

/**
 * Tokenize and normalize text for similarity comparison
 *
 * Normalizations:
 * - Lowercase
 * - Remove punctuation (except hyphens within words)
 * - Split on whitespace
 * - Split "digit-digit" hyphenated patterns (e.g., "9mm-124gr" → ["9mm", "124gr"])
 * - Preserve word-word hyphens (e.g., "full-metal-jacket" stays together)
 * - Filter empty tokens
 */
export function tokenize(text: string): string[] {
  // Pattern: starts with digit(s) + optional letters, hyphen, then alphanumeric
  // Matches: "9mm-124gr", "50-round", "7-62" but NOT "full-metal-jacket"
  const digitHyphenPattern = /^(\d+[a-z]*)-([a-z0-9]+)$/i

  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ') // Remove punctuation except hyphens
    .split(/\s+/)
    .filter((token) => token.length > 0)

  // Split tokens matching digit-hyphen-digit pattern
  return tokens.flatMap((token) => {
    const match = token.match(digitHyphenPattern)
    return match ? [match[1], match[2]] : [token]
  })
}

/**
 * Compute term frequency (TF) for a document
 *
 * TF(t) = (count of t in document) / (total terms in document)
 */
export function computeTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  const total = tokens.length

  if (total === 0) return tf

  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1)
  }

  // Normalize by document length
  for (const [term, count] of tf.entries()) {
    tf.set(term, count / total)
  }

  return tf
}

/**
 * Compute inverse document frequency (IDF) for a corpus
 *
 * IDF(t) = log(N / df(t)) where:
 * - N = total documents
 * - df(t) = number of documents containing term t
 *
 * Uses smoothed IDF: log((N + 1) / (df(t) + 1)) + 1
 * to avoid division by zero and dampen extreme values
 */
export function computeIDF(documents: string[][]): Map<string, number> {
  const idf = new Map<string, number>()
  const N = documents.length

  // Count document frequency for each term
  const df = new Map<string, number>()
  for (const doc of documents) {
    const uniqueTerms = new Set(doc)
    for (const term of uniqueTerms) {
      df.set(term, (df.get(term) ?? 0) + 1)
    }
  }

  // Compute smoothed IDF
  for (const [term, docFreq] of df.entries()) {
    idf.set(term, Math.log((N + 1) / (docFreq + 1)) + 1)
  }

  return idf
}

/**
 * Compute TF-IDF vector for a document given pre-computed IDF
 */
export function computeTFIDF(
  tokens: string[],
  idf: Map<string, number>
): Map<string, number> {
  const tf = computeTF(tokens)
  const tfidf = new Map<string, number>()

  for (const [term, tfValue] of tf.entries()) {
    const idfValue = idf.get(term) ?? 1.0 // Default IDF for unseen terms
    tfidf.set(term, tfValue * idfValue)
  }

  return tfidf
}

/**
 * Compute cosine similarity between two vectors
 *
 * cos(A, B) = (A · B) / (||A|| × ||B||)
 *
 * Returns 0 if either vector is empty/zero-magnitude
 */
export function cosineSimilarity(
  vec1: Map<string, number>,
  vec2: Map<string, number>
): number {
  if (vec1.size === 0 || vec2.size === 0) return 0

  let dotProduct = 0
  let magnitude1 = 0
  let magnitude2 = 0

  // Compute dot product (only terms in both vectors contribute)
  for (const [term, value1] of vec1.entries()) {
    const value2 = vec2.get(term)
    if (value2 !== undefined) {
      dotProduct += value1 * value2
    }
    magnitude1 += value1 * value1
  }

  for (const value2 of vec2.values()) {
    magnitude2 += value2 * value2
  }

  magnitude1 = Math.sqrt(magnitude1)
  magnitude2 = Math.sqrt(magnitude2)

  if (magnitude1 === 0 || magnitude2 === 0) return 0

  return dotProduct / (magnitude1 * magnitude2)
}

/**
 * Compute TF-IDF cosine similarity between two texts
 *
 * For pairwise comparison, we treat the two texts as a mini-corpus
 * to compute IDF, then compute cosine similarity of their TF-IDF vectors.
 */
export function tfidfCosineSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0

  const tokens1 = tokenize(text1)
  const tokens2 = tokenize(text2)

  if (tokens1.length === 0 || tokens2.length === 0) return 0

  // Compute IDF over the mini-corpus of two documents
  const idf = computeIDF([tokens1, tokens2])

  // Compute TF-IDF vectors
  const tfidf1 = computeTFIDF(tokens1, idf)
  const tfidf2 = computeTFIDF(tokens2, idf)

  return cosineSimilarity(tfidf1, tfidf2)
}

/**
 * Compute TF-IDF cosine similarity with pre-tokenized input
 *
 * Performance optimization: when comparing one input against many candidates,
 * pre-tokenize the input once and reuse tokens across comparisons.
 *
 * Note: Uses pairwise IDF (2-doc corpus) for consistency with tfidfCosineSimilarity.
 * This is intentional for v1 - see ADR-019 for rationale.
 */
export function tfidfCosineSimilarityWithTokens(
  inputTokens: string[],
  candidateText: string
): number {
  if (inputTokens.length === 0 || !candidateText) return 0

  const candidateTokens = tokenize(candidateText)

  if (candidateTokens.length === 0) return 0

  // Compute IDF over the mini-corpus of two documents
  const idf = computeIDF([inputTokens, candidateTokens])

  // Compute TF-IDF vectors
  const tfidf1 = computeTFIDF(inputTokens, idf)
  const tfidf2 = computeTFIDF(candidateTokens, idf)

  return cosineSimilarity(tfidf1, tfidf2)
}

/**
 * Compute Jaccard similarity between two texts
 *
 * Jaccard(A, B) = |A ∩ B| / |A ∪ B|
 *
 * Useful as an ensemble signal for exact token overlap.
 *
 * @roadmap Ensemble with TF-IDF for edge cases where
 *          exact matches matter more than frequency weighting
 */
export function jaccardSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0

  const tokens1 = new Set(tokenize(text1))
  const tokens2 = new Set(tokenize(text2))

  if (tokens1.size === 0 || tokens2.size === 0) return 0

  let intersection = 0
  for (const token of tokens1) {
    if (tokens2.has(token)) intersection++
  }

  const union = tokens1.size + tokens2.size - intersection

  return union === 0 ? 0 : intersection / union
}

/**
 * Compute normalized Levenshtein similarity between two texts
 *
 * Returns 1 - (editDistance / maxLength), clamped to [0, 1]
 *
 * @roadmap Use as a cleanup/typo filter for near-matches
 *          after TF-IDF ranking (e.g., "Horandy" vs "Hornady")
 */
export function levenshteinSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0

  const s1 = text1.toLowerCase()
  const s2 = text2.toLowerCase()

  if (s1 === s2) return 1

  const m = s1.length
  const n = s2.length

  if (m === 0 || n === 0) return 0

  // Dynamic programming matrix
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  )

  // Base cases
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  // Fill matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      )
    }
  }

  const distance = dp[m][n]
  const maxLength = Math.max(m, n)

  return 1 - distance / maxLength
}
