import { AppError } from '../utils/AppError.js'
import { logger } from '../utils/logger.js'
import env from '../config/env.js'

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `No route matches ${req.method} ${req.originalUrl}`,
    },
  })
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) logger.error(err.message, { code: err.code, stack: err.stack })
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    })
  }

  // express.json() throws a plain SyntaxError (marked by body-parser with
  // status 400 and type 'entity.parse.failed') for malformed request
  // bodies. Without this check it falls through to the generic 500 below —
  // a client mistake (bad JSON) should never look like a server fault.
  if (err instanceof SyntaxError && (err.status === 400 || err.statusCode === 400) && err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: {
        code: 'MALFORMED_JSON',
        message: 'Request body is not valid JSON.',
      },
    })
  }

  logger.error('Unhandled error', { message: err?.message, stack: err?.stack })
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong while processing your request.',
      ...(env.isProd ? {} : { details: err?.message }),
    },
  })
}
