export type SafeJsonParseResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: string }

export function safeJsonParse<T = unknown>(input: string): SafeJsonParseResult<T> {
  try {
    return { ok: true, value: JSON.parse(input) as T }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid JSON',
    }
  }
}
