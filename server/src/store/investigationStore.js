import crypto from 'node:crypto'
import db from './db.js'

// Every investigation record (the full JSON shape produced by the risk
// engine + agent layer) is stored as-is in the `payload` column so nothing
// upstream (controllers, agents, report generator) has to change. A few
// columns are duplicated out of the JSON purely so the database itself can
// index/filter on them if needed later.

const upsertStmt = db.prepare(`
  INSERT INTO investigations (id, type, target, date, risk, processingTimeMs, payload)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    type = excluded.type,
    target = excluded.target,
    date = excluded.date,
    risk = excluded.risk,
    processingTimeMs = excluded.processingTimeMs,
    payload = excluded.payload
`)

const getStmt = db.prepare('SELECT payload FROM investigations WHERE id = ?')
const allStmt = db.prepare('SELECT payload FROM investigations')
const deleteAllStmt = db.prepare('DELETE FROM investigations')
const countStmt = db.prepare('SELECT COUNT(*) AS count FROM investigations')

export function generateId() {
  return `inv_${crypto.randomBytes(6).toString('hex')}`
}

export function saveInvestigation(record) {
  upsertStmt.run(
    record.id,
    record.type ?? null,
    record.target ?? null,
    record.date,
    record.risk ?? null,
    record.processingTimeMs ?? 0,
    JSON.stringify(record),
  )
  return record
}

export function getInvestigation(id) {
  const row = getStmt.get(id)
  return row ? JSON.parse(row.payload) : null
}

/** Clears every stored investigation (Settings > Danger zone). */
export function clearAllInvestigations() {
  const { count } = countStmt.get()
  deleteAllStmt.run()
  return { cleared: count }
}

export function listInvestigations({ page, limit, type, risk, q }) {
  let items = allStmt.all().map((row) => JSON.parse(row.payload))
  items.sort((a, b) => new Date(b.date) - new Date(a.date))

  if (type && type !== 'all') items = items.filter((i) => i.type === type)
  if (risk && risk !== 'all') items = items.filter((i) => i.risk === risk)
  if (q) {
    const needle = q.toLowerCase()
    items = items.filter((i) => i.target.toLowerCase().includes(needle) || i.summary?.toLowerCase().includes(needle))
  }

  const total = items.length
  const start = (page - 1) * limit
  const pageItems = items.slice(start, start + limit)

  return { items: pageItems, total, page, limit }
}

export function storeStats() {
  const items = allStmt.all().map((row) => JSON.parse(row.payload))
  const total = items.length
  const threatsBlocked = items.filter((i) => i.risk === 'high' || i.risk === 'critical').length
  const avgResponseMs = total > 0 ? items.reduce((sum, i) => sum + (i.processingTimeMs ?? 0), 0) / total : 0
  const safeOrLow = items.filter((i) => i.risk === 'safe' || i.risk === 'low').length
  const trustScore = total > 0 ? Math.round((safeOrLow / total) * 100) : 100
  return { total, threatsBlocked, avgResponseSeconds: Math.round((avgResponseMs / 1000) * 10) / 10, trustScore }
}

