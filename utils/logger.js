const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
const currentLevel = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info

function stamp() {
  return new Date().toISOString()
}

function log(level, msg, meta) {
  if (LEVELS[level] < currentLevel) return
  const line = `[${stamp()}] ${level.toUpperCase().padEnd(5)} ${msg}`
  const payload = meta ? `${line} ${JSON.stringify(meta)}` : line
  if (level === 'error') console.error(payload)
  else if (level === 'warn') console.warn(payload)
  else console.log(payload)
}

export const logger = {
  debug: (msg, meta) => log('debug', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
}
