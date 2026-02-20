import type { NormalizeInput, NormalizeResult } from '../../types.js'
import { normalizeOffer } from '../../kit/normalize.js'
import { validateNormalizedOffer } from '../../kit/validate.js'

export function normalizeRaw(input: NormalizeInput): NormalizeResult {
  const normalized = normalizeOffer(input)
  const validation = validateNormalizedOffer(normalized)
  if (!validation.ok) {
    return {
      status: validation.status,
      reason: validation.reason,
    }
  }

  return { status: 'ok', offer: normalized }
}
