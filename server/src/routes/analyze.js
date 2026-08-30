import { Router } from 'express'
import { validate } from '../middleware/validate.js'
import { analyzeLimiter } from '../middleware/rateLimiter.js'
import { uploadGenericFile, uploadApkFile, handleUploadErrors } from '../middleware/upload.js'
import { urlAnalyzeSchema, messageAnalyzeSchema } from '../schemas/analyzeSchemas.js'
import { analyzeUrl, analyzeMessage, analyzeFile, analyzeApkFile } from '../controllers/analyzeController.js'

const router = Router()

router.use(analyzeLimiter)

router.post('/url', validate(urlAnalyzeSchema), analyzeUrl)
router.post('/message', validate(messageAnalyzeSchema), analyzeMessage)
router.post('/file', handleUploadErrors(uploadGenericFile), analyzeFile)
router.post('/apk', handleUploadErrors(uploadApkFile), analyzeApkFile)

export default router
