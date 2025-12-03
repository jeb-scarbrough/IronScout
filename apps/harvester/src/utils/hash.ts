import { createHash } from 'crypto'

/**
 * Computes SHA-256 hash of content for feed change detection
 * @param content - Feed content to hash
 * @returns Hexadecimal hash string
 */
export function computeContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}
