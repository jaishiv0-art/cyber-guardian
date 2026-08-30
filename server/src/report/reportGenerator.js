import PDFDocument from 'pdfkit'
import { redactSecrets } from '../utils/redact.js'

/**
 * Builds a downloadable PDF security report from a completed investigation
 * record — the EXACT same record the Results page renders and the voice
 * briefing narrates. This module never re-runs the Risk Engine, never
 * calls an analyzer, and never talks to the AI layer: it only lays out
 * fields that already exist on `record`.
 *
 * Defense in depth: every piece of free text that ends up in the PDF is
 * passed through redactSecrets() again before being written, even though
 * message targets are already redacted at write-time — a report is a
 * durable artifact a user might forward, so it gets the same treatment
 * with zero trust in upstream state.
 *
 * Explicitly never included: API keys, internal file paths, stack traces,
 * or any field from process.env / server config.
 *
 * Layout note: every text call below passes an explicit x and width. This
 * is deliberate — pdfkit's implicit cursor (doc.x) drifts permanently to
 * whatever x an earlier absolutely-positioned call used, which silently
 * indents every subsequent block if left to "flow" naturally. Anchoring
 * every call to LEFT/CONTENT_WIDTH avoids that class of layout bug.
 */

const RISK_COLOR = {
  safe: '#1F8F5F',
  low: '#2E9A7B',
  medium: '#B87A12',
  high: '#C24A2E',
  critical: '#B0233F',
}

const TYPE_LABEL = { url: 'URL', file: 'File', apk: 'Android APK', message: 'Message' }

function clean(text) {
  if (text === null || text === undefined) return ''
  return redactSecrets(String(text)).trim()
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso || 'Unknown'
  }
}

/**
 * @param {object} record - full investigation record (as returned by
 *   GET /api/investigation/:id and saved by investigationStore)
 * @returns {PDFKit.PDFDocument} a streaming pdfkit document (not yet ended)
 */
export function buildInvestigationReportPdf(record) {
  const doc = new PDFDocument({
    margin: 46,
    size: 'A4',
    bufferPages: true,
    info: { Title: `Guardian Security Report - ${record.id}`, Author: 'Cyber Guardian' },
  })

  const LEFT = doc.page.margins.left
  const RIGHT = doc.page.width - doc.page.margins.right
  const WIDTH = RIGHT - LEFT
  const INDENT = 14
  const riskColor = RISK_COLOR[record.risk] || '#4B5363'

  // Every helper below takes explicit x/width so the cursor never drifts.
  function section(title) {
    doc.moveDown(0.7)
    doc.x = LEFT
    doc.fontSize(13).fillColor('#111827').font('Helvetica-Bold').text(title.toUpperCase(), LEFT, doc.y, { width: WIDTH, characterSpacing: 0.4 })
    doc.moveTo(LEFT, doc.y + 2).lineTo(RIGHT, doc.y + 2).strokeColor('#D8DCE6').lineWidth(1).stroke()
    doc.moveDown(0.5)
    doc.x = LEFT
    doc.font('Helvetica').fillColor('#1F2430')
  }

  function para(text, { size = 10.2, color = '#333A4A' } = {}) {
    const t = clean(text)
    if (!t) return
    doc.fontSize(size).fillColor(color).font('Helvetica').text(t, LEFT, doc.y, { width: WIDTH, lineGap: 2 })
    doc.x = LEFT
  }

  function labelValue(label, value) {
    const v = clean(value)
    doc.fontSize(9.5).fillColor('#6B7280').font('Helvetica-Bold').text(`${label}: `, LEFT, doc.y, { width: WIDTH, continued: true })
    doc.font('Helvetica').fillColor('#1F2430').text(v)
    doc.x = LEFT
  }

  function bullet(title, detail) {
    doc.fontSize(10.2).fillColor('#1F2430').font('Helvetica-Bold').text(`•  ${clean(title)}`, LEFT, doc.y, { width: WIDTH, lineGap: 1 })
    if (detail) {
      doc.font('Helvetica').fillColor('#4B5363').fontSize(9.6)
      doc.text(clean(detail), LEFT + INDENT, doc.y, { width: WIDTH - INDENT })
    }
    doc.x = LEFT
    doc.font('Helvetica').fillColor('#1F2430')
    doc.moveDown(0.32)
  }

  function plainBullet(text, { size = 9.6, color = '#1F2430' } = {}) {
    doc.fontSize(size).fillColor(color).font('Helvetica').text(`•  ${clean(text)}`, LEFT, doc.y, { width: WIDTH })
    doc.x = LEFT
  }

  function note(text) {
    doc.fontSize(9.6).fillColor('#8A93A6').font('Helvetica-Oblique').text(clean(text), LEFT, doc.y, { width: WIDTH })
    doc.x = LEFT
    doc.font('Helvetica').fillColor('#1F2430')
    doc.moveDown(0.3)
  }

  function footnoteSource(source) {
    if (!source) return
    const label = source === 'ai' ? 'AI-generated explanation, grounded in the evidence above.' : 'Template-generated explanation (deterministic fallback).'
    doc.fontSize(8).fillColor('#9AA2B4').font('Helvetica-Oblique').text(label, LEFT, doc.y, { width: WIDTH })
    doc.x = LEFT
    doc.font('Helvetica').fillColor('#1F2430')
    doc.moveDown(0.4)
  }

  function subLabel(text) {
    doc.font('Helvetica-Bold').fontSize(9.6).fillColor('#111827').text(clean(text), LEFT, doc.y, { width: WIDTH })
    doc.x = LEFT
    doc.font('Helvetica').fillColor('#1F2430')
  }

  // ---- Header -------------------------------------------------------
  doc.fontSize(20).fillColor('#0B0F1A').font('Helvetica-Bold').text('CYBER GUARDIAN', LEFT, doc.y, { width: WIDTH, characterSpacing: 0.6 })
  doc.x = LEFT
  doc.fontSize(10.5).fillColor('#6B7280').font('Helvetica').text('Security Investigation Report', LEFT, doc.y, { width: WIDTH })
  doc.x = LEFT
  doc.moveDown(0.6)
  doc.moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).strokeColor('#0B0F1A').lineWidth(1.4).stroke()
  doc.moveDown(0.8)

  // ---- Summary block --------------------------------------------------
  labelValue('Investigation ID', record.id)
  labelValue('Type', TYPE_LABEL[record.type] || record.type)
  labelValue('Target', record.target)
  labelValue('Date / time', fmtDate(record.date))
  doc.moveDown(0.5)

  // Risk badge — drawn at a captured, fixed Y so it can never overlap the
  // line above or below it, regardless of what preceded it.
  const badgeY = doc.y
  const badgeLabel = `${(record.risk || 'unknown').toUpperCase()} RISK   —   ${record.overallScore}/100`
  doc.rect(LEFT, badgeY, 260, 28).fill(riskColor)
  doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold').text(badgeLabel, LEFT + 10, badgeY + 8, { width: 240 })
  doc.fillColor('#1F2430').font('Helvetica')
  doc.x = LEFT
  doc.y = badgeY + 28
  doc.moveDown(0.6)

  para(record.verdictHeadline || '')

  // ---- Scores ---------------------------------------------------------
  section('Dimension Scores')
  const scores = record.scores || {}
  labelValue('Security score (0-100, higher = safer)', scores.security)
  labelValue('Privacy score (0-100, higher = safer)', scores.privacy)
  labelValue('Tracking score (0-100, higher = safer)', scores.tracking)
  doc.moveDown(0.2)
  labelValue('Threat probability', `${record.threatProbability}%`)
  labelValue('Potential impact', record.potentialImpact)
  labelValue('Confidence', `${record.confidence}%`)

  // ---- Recommendation ---------------------------------------------------
  section('Recommendation — Can I Use It?')
  const canUseIt = record.aiExplanation?.canUseIt
  if (canUseIt?.applicable) {
    doc.fontSize(11).font('Helvetica-Bold').fillColor(riskColor).text((canUseIt.verdict || '').replace(/_/g, ' ').toUpperCase(), LEFT, doc.y, { width: WIDTH })
    doc.x = LEFT
    doc.font('Helvetica').fillColor('#1F2430')
    doc.moveDown(0.2)
    para(canUseIt.explanation)
    footnoteSource(canUseIt.source)
  } else {
    note('No recommendation was applicable for this investigation.')
  }

  // ---- WHY DID I GET THIS SCORE? / Evidence -----------------------------
  section('Why Did I Get This Score? — Evidence')
  const why = record.why || []
  if (why.length === 0) {
    note('No specific risk evidence was flagged for this investigation.')
  } else {
    for (const w of why) bullet(w.claim, w.evidence)
  }

  const security = record.aiExplanation?.security
  if (security?.summary) {
    doc.moveDown(0.2)
    subLabel('Security explanation summary')
    para(security.summary)
    footnoteSource(security.source)
  }

  // ---- What Could Happen -------------------------------------------------
  section('What Could Happen?')
  const wch = record.aiExplanation?.whatCouldHappen
  if (wch?.applicable && wch.items?.length) {
    for (const item of wch.items) {
      doc.font('Helvetica-Bold').fontSize(9.8).fillColor('#111827').text('Observed: ', LEFT, doc.y, { width: WIDTH, continued: true })
      doc.font('Helvetica').fillColor('#1F2430').fontSize(10).text(clean(item.observed))
      doc.x = LEFT
      doc.font('Helvetica-Bold').fontSize(9.8).fillColor('#B87A12').text('Possible consequence: ', LEFT, doc.y, { width: WIDTH, continued: true })
      doc.font('Helvetica').fillColor('#1F2430').fontSize(10).text(clean(item.possibleConsequence))
      doc.x = LEFT
      doc.moveDown(0.3)
    }
    footnoteSource(wch.source)
  } else if (record.whatCouldHappen?.length) {
    for (const item of record.whatCouldHappen) bullet(item.title, item.detail)
  } else {
    note(wch?.notApplicableReason || 'No notable findings to project consequences from.')
  }

  // ---- Attack Story --------------------------------------------------
  section('Attack Story (Possible Scenario)')
  const attackStory = record.attackStory || []
  if (attackStory.length === 0) {
    note('Not applicable — no plausible attack sequence applies at this risk level.')
  } else {
    attackStory.forEach((step, i) => bullet(`${i + 1}. ${step.title}`, step.detail))
  }

  // ---- Defense ---------------------------------------------------------
  section('Defense — What To Do Now')
  const defense = record.defense || []
  if (defense.length === 0) {
    note('No specific defense actions were generated.')
  } else {
    for (const d of defense) bullet(d.action, d.detail)
  }

  // ---- Privacy findings --------------------------------------------------
  section('Privacy Findings')
  const privacy = record.aiExplanation?.privacy
  if (privacy?.applicable) {
    if (privacy.summary) para(privacy.summary)
    doc.moveDown(0.2)
    subLabel('Permission exists (observed capability):')
    if (privacy.permissionExists?.length) {
      for (const p of privacy.permissionExists) plainBullet(p)
    } else {
      note('None observed.')
    }
    doc.moveDown(0.1)
    subLabel('Confirmed data collection (proof of transmission):')
    if (privacy.confirmedDataCollection?.length) {
      for (const p of privacy.confirmedDataCollection) plainBullet(p)
    } else {
      note('Not confirmed — static analysis can see permissions, not proof of actual data transmission.')
    }
    footnoteSource(privacy.source)
  } else {
    note(privacy?.notApplicableReason || 'No privacy-related evidence applies to this investigation.')
  }

  // ---- Tracking findings --------------------------------------------------
  section('Tracking & Ads Findings')
  const tracking = record.aiExplanation?.tracking
  if (tracking?.applicable) {
    labelValue('Classification', (tracking.classification || '').replace(/_/g, ' '))
    if (tracking.summary) para(tracking.summary)
    if (tracking.indicators?.length) {
      doc.moveDown(0.1)
      for (const ind of tracking.indicators) plainBullet(ind)
    }
    footnoteSource(tracking.source)
  } else {
    note(tracking?.notApplicableReason || 'No tracking-related evidence applies to this investigation.')
  }

  // ---- File / APK details ------------------------------------------------
  if (record.type === 'file' || record.type === 'apk') {
    section(record.type === 'apk' ? 'APK Details' : 'File Details')
    const meta = record.meta || {}
    if (meta.sha256) labelValue('SHA-256', meta.sha256)
    if (meta.mimetype) labelValue('MIME type', meta.mimetype)
    if (typeof meta.size === 'number') labelValue('Size', `${(meta.size / 1024).toFixed(1)} KB`)
    if (meta.signature) labelValue('File signature', meta.signature)
    if (meta.documentType) labelValue('Document type', meta.documentType)
    if (meta.packageName) labelValue('Package name', meta.packageName)
    if (meta.appCategory) labelValue('Inferred app category', `${meta.appCategory} (best-effort, package-name only)`)
    if (Array.isArray(meta.detectedPermissions) && meta.detectedPermissions.length) {
      doc.moveDown(0.2)
      subLabel('Detected permissions:')
      for (const p of meta.detectedPermissions) plainBullet(p)
    }
    if (meta.vt) {
      doc.moveDown(0.2)
      labelValue('VirusTotal reputation', meta.vt.available ? 'Checked live' : `Unavailable (${meta.vt.reason || 'unknown reason'})`)
    }
  }

  // ---- Footer / disclaimer -----------------------------------------------
  doc.moveDown(0.9)
  doc.moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).strokeColor('#D8DCE6').lineWidth(0.7).stroke()
  doc.moveDown(0.4)
  doc
    .fontSize(8.2)
    .fillColor('#8A93A6')
    .font('Helvetica')
    .text(
      'This report reflects Guardian\'s automated static analysis and, where available, live threat-intelligence lookups at the time of investigation. It is a decision-support tool, not a certified security audit or legal determination. Findings marked as "possible" or "could" are projected consequences, not confirmed events.',
      LEFT,
      doc.y,
      { width: WIDTH, lineGap: 2 }
    )
  doc.x = LEFT
  doc.moveDown(0.3)
  doc.fontSize(7.8).fillColor('#B0B6C4').text(`Generated ${fmtDate(new Date().toISOString())} · Investigation ${record.id}`, LEFT, doc.y, { width: WIDTH })

  return doc
}
