import { asyncHandler } from '../utils/asyncHandler.js'
import { listInvestigations, storeStats, clearAllInvestigations } from '../store/investigationStore.js'
import { logger } from '../utils/logger.js'

export const getHistory = asyncHandler(async (req, res) => {
  const { page, limit, type, risk, q } = req.query
  const { items, total } = listInvestigations({ page, limit, type, risk, q })

  const summary = items.map((i) => ({
    id: i.id,
    type: i.type,
    target: i.target,
    date: i.date,
    risk: i.risk,
    score: i.overallScore,
    summary: i.summary,
  }))

  res.json({
    data: summary,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    stats: storeStats(),
  })
})

/** Settings > Danger zone > "Clear all investigation history". Irreversible. */
export const deleteAllHistory = asyncHandler(async (req, res) => {
  const { cleared } = clearAllInvestigations()
  logger.info('Investigation history cleared', { cleared })
  res.json({ data: { cleared } })
})
