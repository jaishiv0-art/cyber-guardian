import path from 'node:path'
import fs from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import env from '../config/env.js'
import { logger } from '../utils/logger.js'

fs.mkdirSync(env.dataDir, { recursive: true })
const DB_FILE = path.join(env.dataDir, 'guardian.db')

// Node's built-in SQLite driver -- no native compilation, no external
// package, no build tools required. Available in Node 22.5+.
const db = new DatabaseSync(DB_FILE)

db.exec(`
  CREATE TABLE IF NOT EXISTS investigations (
    id TEXT PRIMARY KEY,
    type TEXT,
    target TEXT,
    date TEXT,
    risk TEXT,
    processingTimeMs INTEGER,
    payload TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_investigations_date ON investigations(date);
  CREATE INDEX IF NOT EXISTS idx_investigations_type ON investigations(type);
  CREATE INDEX IF NOT EXISTS idx_investigations_risk ON investigations(risk);
`)

logger.info(`Connected to SQLite database at ${DB_FILE}`)

export default db