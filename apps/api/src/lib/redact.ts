/**
 * Sensitive Field Redaction
 *
 * Redacts sensitive values from objects before logging.
 * Uses an ALLOWLIST approach - only explicitly safe fields pass through.
 */

/**
 * Fields that are ALWAYS redacted regardless of context
 */
const SENSITIVE_PATTERNS = [
  // Auth tokens and secrets
  /authorization/i,
  /^cookie$/i,
  /^set-cookie$/i,
  /password/i,
  /secret/i,
  /token/i,
  /api[-_]?key/i,
  /access[-_]?token/i,
  /refresh[-_]?token/i,
  /bearer/i,
  /jwt/i,
  /session[-_]?id/i,

  // Payment and financial
  /credit[-_]?card/i,
  /card[-_]?number/i,
  /cvv/i,
  /cvc/i,
  /^pan$/i,
  /account[-_]?number/i,
  /routing[-_]?number/i,
  /stripe/i,

  // Personal identifiable information
  /ssn/i,
  /social[-_]?security/i,
  /^dob$/i,
  /date[-_]?of[-_]?birth/i,
]

/**
 * Fields that are safe to log (ALLOWLIST)
 * Only these exact field names pass through without redaction
 */
const SAFE_FIELDS = new Set([
  // Request metadata
  'method',
  'path',
  'route',
  'url',
  'statusCode',
  'status_code',
  'latencyMs',
  'latency_ms',
  'durationMs',
  'duration_ms',
  'contentLength',
  'content_length',
  'userAgent',
  'user_agent',
  'ip',
  'remoteAddress',
  'remote_address',
  'protocol',
  'host',
  'hostname',
  'port',

  // Identifiers (non-sensitive)
  'requestId',
  'request_id',
  'traceId',
  'trace_id',
  'spanId',
  'span_id',
  'correlationId',
  'correlation_id',
  'jobId',
  'job_id',
  'userId',
  'user_id',
  'productId',
  'product_id',
  'orderId',
  'order_id',

  // Logging metadata
  'timestamp',
  'ts',
  'level',
  'service',
  'component',
  'event',
  'event_name',
  'message',
  'msg',
  'env',
  'environment',
  'version',

  // Error fields
  'error',
  'errorType',
  'error_type',
  'errorCode',
  'error_code',
  'errorMessage',
  'error_message',
  'stack',
  'name',
  'code',

  // Business fields (non-sensitive)
  'caliber',
  'brand',
  'category',
  'purpose',
  'tier',
  'count',
  'total',
  'page',
  'limit',
  'offset',
  'query',
  'sortBy',
  'sort_by',
  'filter',
  'filters',
])

/**
 * Headers that are safe to log
 */
const SAFE_HEADERS = new Set([
  'accept',
  'accept-encoding',
  'accept-language',
  'cache-control',
  'connection',
  'content-length',
  'content-type',
  'host',
  'origin',
  'referer',
  'user-agent',
  'x-forwarded-for',
  'x-forwarded-proto',
  'x-real-ip',
  'x-request-id',
  'x-correlation-id',
])

const REDACTED = '[REDACTED]'

/**
 * Check if a field name matches any sensitive pattern
 */
function isSensitiveField(fieldName: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(fieldName))
}

/**
 * Check if a field name is in the allowlist
 */
function isSafeField(fieldName: string): boolean {
  return SAFE_FIELDS.has(fieldName) || SAFE_FIELDS.has(fieldName.toLowerCase())
}

/**
 * Redact sensitive fields from an object (deep)
 *
 * @param obj - Object to redact
 * @param maxDepth - Maximum recursion depth (default: 10)
 * @returns New object with sensitive fields redacted
 */
export function redact<T>(obj: T, maxDepth = 10): T {
  return redactInternal(obj, 0, maxDepth, new WeakSet())
}

function redactInternal<T>(
  obj: T,
  depth: number,
  maxDepth: number,
  seen: WeakSet<object>
): T {
  // Prevent infinite recursion
  if (depth > maxDepth) {
    return '[MAX_DEPTH]' as unknown as T
  }

  // Handle primitives
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj !== 'object') {
    return obj
  }

  // Handle circular references
  if (seen.has(obj as object)) {
    return '[CIRCULAR]' as unknown as T
  }
  seen.add(obj as object)

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) =>
      redactInternal(item, depth + 1, maxDepth, seen)
    ) as unknown as T
  }

  // Handle objects
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    // Always redact sensitive fields
    if (isSensitiveField(key)) {
      result[key] = REDACTED
      continue
    }

    // Safe fields pass through
    if (isSafeField(key)) {
      result[key] = redactInternal(value, depth + 1, maxDepth, seen)
      continue
    }

    // Unknown fields: redact if string/number, recurse if object
    if (typeof value === 'string' || typeof value === 'number') {
      // Redact unknown primitive fields by default
      result[key] = REDACTED
    } else if (typeof value === 'boolean') {
      // Booleans are generally safe
      result[key] = value
    } else if (value === null || value === undefined) {
      result[key] = value
    } else {
      // Recurse into nested objects
      result[key] = redactInternal(value, depth + 1, maxDepth, seen)
    }
  }

  return result as unknown as T
}

/**
 * Redact headers object
 * Only allows known safe headers through
 */
export function redactHeaders(
  headers: Record<string, string | string[] | undefined>
): Record<string, string | string[] | typeof REDACTED> {
  const result: Record<string, string | string[] | typeof REDACTED> = {}

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase()
    if (SAFE_HEADERS.has(lowerKey)) {
      result[key] = value ?? REDACTED
    } else {
      result[key] = REDACTED
    }
  }

  return result
}

/**
 * Redact a URL, removing query parameters that might contain sensitive data
 */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url, 'http://localhost')
    const safeParams = new URLSearchParams()

    // Only keep safe query params
    const safeQueryParams = new Set([
      'page',
      'limit',
      'offset',
      'sort',
      'sortBy',
      'order',
      'q',
      'query',
      'search',
      'filter',
      'id',
      'ids',
      'type',
      'status',
      'format',
    ])

    for (const [key, value] of parsed.searchParams) {
      if (safeQueryParams.has(key)) {
        safeParams.set(key, value)
      } else {
        safeParams.set(key, REDACTED)
      }
    }

    const queryString = safeParams.toString()
    return queryString ? `${parsed.pathname}?${queryString}` : parsed.pathname
  } catch {
    // If URL parsing fails, return the path portion only
    return url.split('?')[0]
  }
}

/**
 * Check if redaction is working correctly (for tests)
 */
export function getRedactedMarker(): string {
  return REDACTED
}

/**
 * Add a field to the safe list at runtime (for testing or extension)
 */
export function addSafeField(field: string): void {
  SAFE_FIELDS.add(field)
}

/**
 * Check if a field would be redacted
 */
export function wouldBeRedacted(fieldName: string): boolean {
  return isSensitiveField(fieldName) || !isSafeField(fieldName)
}
