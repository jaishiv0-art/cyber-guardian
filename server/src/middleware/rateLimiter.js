import rateLimit from 'express-rate-limit'
import env from '../config/env.js'
import { AppError } from '../utils/AppError.js'

function limitHandler(req, res, next, options) {
  next(
    AppError.tooManyRequests(
      'RATE_LIMITED',
      'Too many requests. Please slow down and try again shortly.',
      { retryAfterMs: options.windowMs }
    )
  )
}

// Stricter limit for the expensive analysis endpoints (uploads + external API calls).
export const analyzeLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.maxAnalyze,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler,
})

// Looser limit for cheap read endpoints.
export const readLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.maxRead,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler,
})
