import { asyncHandler } from '../utils/asyncHandler.js'
import { AppError } from '../utils/AppError.js'
import { getInvestigation } from '../store/investigationStore.js'
import { buildInvestigationReportPdf } from '../report/reportGenerator.js'
import { logger } from '../utils/logger.js'

export const getInvestigationById = asyncHandler(async (req, res) => {
  const { id } = req.params
  const record = getInvestigation(id)
  if (!record) {
    throw AppError.notFound('INVESTIGATION_NOT_FOUND', `No investigation found with id "${id}".`)
  }
  res.json({ data: record })
})

/**
 * Streams a downloadable PDF report for one investigation. Consumes the
 * exact same stored record the Results page and voice briefing use — no
 * recomputation, no fresh analysis, no AI call happens here.
 */
export const getInvestigationReport = asyncHandler(async (req, res) => {
  const { id } = req.params
  const record = getInvestigation(id)
  if (!record) {
    throw AppError.notFound('INVESTIGATION_NOT_FOUND', `No investigation found with id "${id}".`)
  }

  let doc
  try {
    doc = buildInvestigationReportPdf(record)
  } catch (err) {
    logger.error('Report generation failed', { id, error: err.message })
    throw AppError.internal('REPORT_GENERATION_FAILED', 'Could not generate the report for this investigation.')
  }

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="guardian-report-${id}.pdf"`)
  doc.on('error', (err) => {
    logger.error('Report stream error', { id, error: err.message })
    if (!res.headersSent) res.status(500)
    res.end()
  })
  doc.pipe(res)
  doc.end()
})
