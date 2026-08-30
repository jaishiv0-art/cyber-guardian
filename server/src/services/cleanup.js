import fs from 'node:fs/promises'
import path from 'node:path'
import env from '../config/env.js'
import { logger } from '../utils/logger.js'

/** Best-effort deletion of a single temp file. Never throws. */
export async function deleteTempFile(filePath) {
  if (!filePath) return
  try {
    await fs.unlink(filePath)
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.warn('Failed to delete temp file', { filePath, error: err.message })
    }
  }
}

async function sweepDir(dir) {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  const ttlMs = env.tempFileTtlMinutes * 60 * 1000
  const now = Date.now()

  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await sweepDir(full)
      continue
    }
    if (entry.name === '.gitkeep') continue
    try {
      const stat = await fs.stat(full)
      if (now - stat.mtimeMs > ttlMs) {
        await fs.unlink(full)
        logger.info('Swept orphaned temp file', { file: full })
      }
    } catch {
      // File may have been removed concurrently — ignore.
    }
  }
}

/** Starts a periodic sweep of the upload temp directory for files that outlived their request (e.g. after a crash mid-request). */
export function startCleanupSweeper() {
  const intervalMs = Math.max(60_000, Math.min(env.tempFileTtlMinutes * 60 * 1000, 15 * 60 * 1000))
  const run = () => sweepDir(env.uploadTmpDir).catch((err) => logger.warn('Cleanup sweep failed', { error: err.message }))
  run()
  const timer = setInterval(run, intervalMs)
  timer.unref?.()
  return timer
}
