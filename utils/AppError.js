/**
 * Structured, machine-readable application error.
 * Every error that reaches the client goes through this shape:
 *   { error: { code, message, details? } }
 */
export class AppError extends Error {
  constructor(code, message, statusCode = 400, details = undefined) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }

  static badRequest(code, message, details) {
    return new AppError(code, message, 400, details)
  }

  static notFound(code, message, details) {
    return new AppError(code, message, 404, details)
  }

  static tooLarge(code, message, details) {
    return new AppError(code, message, 413, details)
  }

  static tooManyRequests(code, message, details) {
    return new AppError(code, message, 429, details)
  }

  static internal(code, message, details) {
    return new AppError(code, message, 500, details)
  }
}
