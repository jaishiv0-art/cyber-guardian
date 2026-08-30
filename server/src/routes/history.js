import { Router } from 'express'
import { validate } from '../middleware/validate.js'
import { readLimiter } from '../middleware/rateLimiter.js'
import { analyzeLimiter } from '../middleware/rateLimiter.js'
import { historyQuerySchema } from '../schemas/analyzeSchemas.js'
import { getHistory, deleteAllHistory } from '../controllers/historyController.js'

const router = Router()

router.get('/', readLimiter, validate(historyQuerySchema, 'query'), getHistory)
// Uses the stricter analyze-tier limiter (not the cheap read limiter) since
// this is a destructive, irreversible write operation.
router.delete('/', analyzeLimiter, deleteAllHistory)

export default router
