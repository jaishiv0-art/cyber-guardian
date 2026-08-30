import { Router } from 'express'
import { validate } from '../middleware/validate.js'
import { readLimiter } from '../middleware/rateLimiter.js'
import { investigationParamsSchema } from '../schemas/analyzeSchemas.js'
import { getInvestigationById, getInvestigationReport } from '../controllers/investigationController.js'

const router = Router()

router.get('/:id', readLimiter, validate(investigationParamsSchema, 'params'), getInvestigationById)
router.get('/:id/report', readLimiter, validate(investigationParamsSchema, 'params'), getInvestigationReport)

export default router
