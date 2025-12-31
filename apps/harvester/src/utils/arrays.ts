/**
 * Safely extract array from parsed JSON response
 * Handles cases where products/items might be objects instead of arrays
 *
 * This is in a separate file to avoid Prisma dependency in tests.
 */
export function safeExtractArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) {
    return parsed
  }

  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>

    // Check common array property names, ensuring they're actually arrays
    if (Array.isArray(obj.products)) {
      return obj.products
    }
    if (Array.isArray(obj.items)) {
      return obj.items
    }
    if (Array.isArray(obj.data)) {
      return obj.data
    }
    if (Array.isArray(obj.results)) {
      return obj.results
    }
  }

  // Return empty array if no valid array found
  return []
}
