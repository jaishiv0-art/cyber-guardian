import { AppError } from '../utils/AppError.js'

/**
 * Returns Express middleware that validates `req[source]` against a Zod
 * schema, replacing it with the parsed (and coerced/defaulted) value on
 * success, or forwarding a structured 400 AppError on failure.
 */
export function validate(schema, source = 'body') {
  return function validateMiddleware(req, res, next) {
    const result = schema.safeParse(req[source])
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.') || source,
        message: issue.message,
      }))
      return next(
        AppError.badRequest('VALIDATION_ERROR', 'Request failed validation.', details)
      )
    }
    req[source] = result.data
    next()
  }
}
