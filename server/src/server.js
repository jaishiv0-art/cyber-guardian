import app from './app.js'
import env from './config/env.js'
import { logger } from './utils/logger.js'
import { startCleanupSweeper } from './services/cleanup.js'

startCleanupSweeper()

app.listen(env.port, () => {
  logger.info(`Guardian API listening on http://localhost:${env.port}`)
  logger.info(`VirusTotal integration: ${env.virustotalEnabled ? 'enabled' : 'disabled (no API key set — heuristics-only mode)'}`)
  logger.info(`MalwareBazaar integration: ${env.malwareBazaarEnabled ? 'enabled' : 'disabled (no API key set)'}`)
  logger.info(`Koodous integration (APKs only): ${env.koodousEnabled ? 'enabled' : 'disabled (no API key set)'}`)
  logger.info(`MobSF integration (APKs only, deep static analysis): ${env.mobsfEnabled ? `enabled (${env.mobsfUrl})` : 'disabled (no MOBSF_URL/API key set)'}`)
})
