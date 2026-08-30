import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import env from './config/env.js'
import { logger } from './utils/logger.js'
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js'
import analyzeRoutes from './routes/analyze.js'
import investigationRoutes from './routes/investigation.js'
import historyRoutes from './routes/history.js'

const app = express()

app.disable('x-powered-by')
app.use(helmet())
app.use(
  cors({
    origin: env.frontendOrigin.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'DELETE'],
  })
)
app.use(express.json({ limit: '1mb' }))

app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    logger.info(`${req.method} ${req.originalUrl} -> ${res.statusCode}`, { ms: Date.now() - start })
  })
  next()
})

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    virustotalEnabled: env.virustotalEnabled,
    time: new Date().toISOString(),
  })
})

app.use('/api/analyze', analyzeRoutes)
app.use('/api/investigation', investigationRoutes)
app.use('/api/history', historyRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
