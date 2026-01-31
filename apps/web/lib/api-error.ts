/**
 * Custom API error class for client-side error handling.
 *
 * SECURITY: Error messages are fixed strings, not server-provided.
 * Server details (errorCode, requestId, validation errors) are stored
 * as properties for debugging, not in the message.
 */
export class ApiError extends Error {
  readonly errorCode: string
  readonly requestId?: string
  readonly validationErrors?: unknown

  constructor(
    errorCode: string,
    message: string,
    requestId?: string,
    validationErrors?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
    this.errorCode = errorCode
    this.requestId = requestId
    this.validationErrors = validationErrors
  }
}

/**
 * Create and throw an ApiError from an API response.
 *
 * @param response - The parsed error response from the API
 * @param defaultMessage - Fixed user-facing message (never use server message)
 * @param defaultCode - Default error code if not provided by server
 */
export function throwApiError(
  response: {
    errorCode?: string
    requestId?: string
    validationErrors?: unknown
  },
  defaultMessage: string,
  defaultCode: string
): never {
  throw new ApiError(
    response.errorCode || defaultCode,
    defaultMessage,
    response.requestId,
    response.validationErrors
  )
}
