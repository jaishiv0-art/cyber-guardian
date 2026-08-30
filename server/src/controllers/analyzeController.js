import fs from 'node:fs/promises'
import { AppError } from '../utils/AppError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { logger } from '../utils/logger.js'
import { sha256Buffer } from '../utils/hashing.js'
import { analyzeUrlStructure } from '../services/urlHeuristics.js'
import { analyzeMessageText } from '../services/messageHeuristics.js'
import { analyzeGenericFile } from '../services/fileHeuristics.js'
import { analyzeApk } from '../services/apkHeuristics.js'
import { lookupUrlReputation, lookupFileReputation } from '../services/virustotal.js'
import { lookupMalwareBazaar } from '../services/malwareBazaar.js'
import { lookupKoodousReputation } from '../services/koodous.js'
import { analyzeWithMobsf, SEVERITY_MAP } from '../services/mobsf.js'
import { deleteTempFile } from '../services/cleanup.js'
import { runRiskEngine } from '../engine/riskEngine.js'
import { buildNarrative, verdictHeadlineFor } from '../engine/narrative.js'
import { findingsToRiskCards, findingsToWhy, truncate } from '../engine/present.js'
import { generateId, saveInvestigation } from '../store/investigationStore.js'
import { runOrchestrator } from '../agents/orchestrator.js'
import { personalContextSchema } from '../schemas/analyzeSchemas.js'
import { redactSecrets } from '../utils/redact.js'

function finding(code, category, severity, title, detail) {
  return { code, category, severity, title, detail }
}

/** Turns a VirusTotal reputation result into zero or more findings — never fabricated, always reflects what VT actually returned. */
function vtFindingsFor(vt, { subjectLabel = 'This target' } = {}) {
  if (!vt.available) {
    return {
      findings: [
        finding(
          'VT_UNAVAILABLE',
          'security',
          'info',
          'Live reputation check unavailable',
          `Guardian could not get a VirusTotal verdict right now (${vt.reason}). Risk below is based on Guardian's own structural analysis only.`
        ),
      ],
      vtAvailable: false,
    }
  }

  const { stats } = vt
  if (!stats || stats.total === 0) {
    return {
      findings: [
        finding('VT_NO_DETECTIONS', 'security', 'info', 'Not yet analyzed by VirusTotal', 'No prior scan data was found.'),
      ],
      vtAvailable: true,
      vtMaliciousRatio: 0,
    }
  }

  if (stats.malicious >= 1) {
    return {
      findings: [
        finding(
          'VT_MALICIOUS_URL',
          'security',
          'critical',
          `Flagged malicious by ${stats.malicious} security vendor${stats.malicious === 1 ? '' : 's'}`,
          `${subjectLabel} was flagged as malicious by ${stats.malicious} of ${stats.total} engines on VirusTotal, and suspicious by ${stats.suspicious} more.`
        ),
      ],
      vtAvailable: true,
      vtMaliciousRatio: stats.maliciousRatio,
    }
  }

  if (stats.suspicious >= 1) {
    return {
      findings: [
        finding(
          'VT_SUSPICIOUS',
          'security',
          'medium',
          `Flagged suspicious by ${stats.suspicious} security vendor${stats.suspicious === 1 ? '' : 's'}`,
          `${subjectLabel} was flagged suspicious (not outright malicious) by ${stats.suspicious} of ${stats.total} engines on VirusTotal.`
        ),
      ],
      vtAvailable: true,
      vtMaliciousRatio: stats.maliciousRatio,
    }
  }

  return {
    findings: [
      finding(
        'VT_NO_DETECTIONS',
        'security',
        'info',
        `Clean across ${stats.total} security vendors`,
        `0 of ${stats.total} VirusTotal engines flagged ${subjectLabel.toLowerCase()} as malicious or suspicious.`
      ),
    ],
    vtAvailable: true,
    vtMaliciousRatio: 0,
  }
}

/** Turns a MalwareBazaar lookup into zero or more findings — never fabricated. MalwareBazaar is a confirmed-malware-only database, so any match is treated as strong evidence; no match is reported as inconclusive, never as "clean". */
function malwareBazaarFindingsFor(mb, { subjectLabel = 'This file' } = {}) {
  if (!mb.available) {
    return {
      findings: [
        finding(
          'MB_UNAVAILABLE',
          'security',
          'info',
          'MalwareBazaar check unavailable',
          `Guardian could not get a MalwareBazaar verdict right now (${mb.reason}). This does not affect the VirusTotal or structural findings above.`
        ),
      ],
    }
  }

  if (mb.found) {
    const family = mb.signature ? ` (family: ${mb.signature})` : ''
    return {
      findings: [
        finding(
          'MB_KNOWN_MALWARE',
          'security',
          'critical',
          `Confirmed malware sample on MalwareBazaar${family}`,
          `${subjectLabel} matches a sample in the MalwareBazaar database by exact hash. MalwareBazaar only accepts vetted, confirmed malware submissions — a match here is not a heuristic guess.`
        ),
      ],
    }
  }

  return {
    findings: [
      finding(
        'MB_NOT_FOUND',
        'security',
        'info',
        'Not found in MalwareBazaar',
        'No exact-hash match in the MalwareBazaar confirmed-malware database. This narrows nothing on its own — most files, malicious or not, are absent from any single database.'
      ),
    ],
  }
}

/** Turns a Koodous lookup into zero or more findings — never fabricated. Android-specific; only meaningful for APKs. */
function koodousFindingsFor(koodous) {
  if (!koodous.available) {
    return {
      findings: [
        finding(
          'KOODOUS_UNAVAILABLE',
          'security',
          'info',
          'Koodous check unavailable',
          `Guardian could not get a Koodous verdict right now (${koodous.reason}).`
        ),
      ],
    }
  }

  const stronglyNegative = koodous.rating <= -3
  if (koodous.isDetected || stronglyNegative) {
    const tagList = koodous.tags.length > 0 ? ` Tags: ${koodous.tags.join(', ')}.` : ''
    return {
      findings: [
        finding(
          'KOODOUS_DETECTED',
          'security',
          'critical',
          'Flagged malicious by Koodous',
          `Koodous's Android-focused analysis and community voting mark this APK as malicious (community rating: ${koodous.rating}).${tagList}`
        ),
      ],
    }
  }

  if (koodous.isCorrupted) {
    return {
      findings: [
        finding('KOODOUS_CORRUPTED', 'security', 'medium', 'Koodous reports this APK as corrupted', 'A corrupted or malformed APK can indicate tampering, though it can also just be a bad build or download.'),
      ],
    }
  }

  if (koodous.isTrusted) {
    return {
      findings: [
        finding('KOODOUS_TRUSTED', 'security', 'info', 'Marked trusted on Koodous', `Koodous marks this APK${koodous.appName ? ` ("${koodous.appName}")` : ''} as a trusted, known application.`),
      ],
    }
  }

  return {
    findings: [
      finding('KOODOUS_NO_DETECTION', 'security', 'info', 'Seen by Koodous, not flagged', `Koodous has analyzed this exact APK before and has not flagged it as malicious (community rating: ${koodous.rating}).`),
    ],
  }
}

/** Turns a MobSF scorecard result into findings. Unlike every other source here, this represents real content inspection (decompiled manifest/code), not a hash match — so it's the one source that still works on an APK nobody has ever seen before. */
function mobsfFindingsFor(mobsf) {
  if (!mobsf.available) {
    // 'not_configured' is the expected default (MobSF is opt-in) — keep
    // that one quiet rather than cluttering every APK result with a
    // reminder finding for a feature the user hasn't set up.
    if (mobsf.reason === 'not_configured') return { findings: [] }
    return {
      findings: [
        finding('MOBSF_UNAVAILABLE', 'security', 'info', 'Deep static analysis (MobSF) unavailable', `Guardian could not get a MobSF result right now (${mobsf.reason}). This does not affect the other findings above.`),
      ],
    }
  }

  const findings = []
  const scoreNote = typeof mobsf.securityScore === 'number' ? ` MobSF security score: ${mobsf.securityScore}/100.` : ''

  for (const [bucket, items] of Object.entries(mobsf.buckets)) {
    if (!items || items.length === 0) continue
    const severity = SEVERITY_MAP[bucket] ?? 'medium'
    findings.push(
      finding(
        `MOBSF_${bucket.toUpperCase()}`,
        'security',
        severity,
        `MobSF: ${items.length} ${bucket}-severity finding${items.length === 1 ? '' : 's'}`,
        `${items.slice(0, 5).join('; ')}${items.length > 5 ? `; and ${items.length - 5} more` : ''}.${scoreNote}`
      )
    )
  }

  if (findings.length === 0) {
    findings.push(finding('MOBSF_NO_FINDINGS', 'security', 'info', 'MobSF static analysis found no flagged issues', `Deep decompilation-based analysis completed with no high/warning findings.${scoreNote}`))
  }

  if (typeof mobsf.totalTrackers === 'number' && mobsf.totalTrackers > 0) {
    findings.push(finding('MOBSF_TRACKERS_DETECTED', 'tracking', 'low', `MobSF identified ${mobsf.totalTrackers} tracker${mobsf.totalTrackers === 1 ? '' : 's'}`, 'Based on known tracker signature matching against the app\u2019s actual code, not just SDK name substrings.'))
  }

  return { findings }
}

async function finalizeAndRespond(res, { type, target, findings, vtAvailable, vtMaliciousRatio, meta, startedAt, personalContext = 'general' }) {
  const risk = runRiskEngine(findings, { vtAvailable, vtMaliciousRatio })
  const narrative = buildNarrative(findings, risk.riskLabel)
  const verdictHeadline = verdictHeadlineFor(risk.riskLabel, findings)

  const id = generateId()

  // Additive Phase 3 layer: consumes the exact deterministic risk result
  // above and produces plain-language explanations. It cannot change
  // `risk`, and nothing below overwrites the existing narrative-derived
  // fields (whatCouldHappen/attackStory/defense) that the frontend already
  // renders — the richer agent output lives alongside them in aiExplanation.
  const aiExplanation = await runOrchestrator({
    investigationId: id,
    type,
    target,
    findings,
    risk,
    metadata: meta,
    personalContext,
  })

  const record = {
    id,
    type,
    target,
    date: new Date().toISOString(),
    risk: risk.riskLabel,
    overallScore: risk.overallRisk,
    score: risk.overallRisk,
    summary: truncate(verdictHeadline, 140),
    verdictHeadline,
    scores: risk.scores,
    categoryRisk: risk.categoryRisk,
    threatProbability: risk.threatProbability,
    potentialImpact: risk.potentialImpact,
    confidence: risk.confidence,
    findingCounts: risk.findingCounts,
    riskCards: findingsToRiskCards(findings),
    why: findingsToWhy(findings),
    whatCouldHappen: narrative.whatCouldHappen,
    attackStory: narrative.attackStory,
    defense: narrative.defense,
    personalContext,
    aiExplanation,
    meta,
    processingTimeMs: Date.now() - startedAt,
  }

  saveInvestigation(record)
  logger.info('Investigation completed', { id: record.id, type, risk: record.risk, ms: record.processingTimeMs })
  res.status(201).json({ data: record })
}

export const analyzeUrl = asyncHandler(async (req, res) => {
  const startedAt = Date.now()
  const { url, personalContext } = req.body

  const { findings: structuralFindings, meta } = analyzeUrlStructure(url)
  const vt = await lookupUrlReputation(url)
  const { findings: vtFindings, vtAvailable, vtMaliciousRatio } = vtFindingsFor(vt, { subjectLabel: 'This URL' })

  await finalizeAndRespond(res, {
    type: 'url',
    target: url,
    findings: [...structuralFindings, ...vtFindings],
    vtAvailable,
    vtMaliciousRatio,
    meta: { ...meta, vt: { available: vt.available, source: vt.source, reason: vt.reason, permalink: vt.permalink } },
    startedAt,
    personalContext,
  })
})

export const analyzeMessage = asyncHandler(async (req, res) => {
  const startedAt = Date.now()
  const { message, personalContext } = req.body

  const { findings: messageFindings, meta } = await analyzeMessageText(message)

  // VT-check every extracted link (messageHeuristics caps this at 3), not
  // just the first — otherwise a malicious second/third link could hide
  // behind a clean first one and never get a real reputation check.
  const vtResults = await Promise.all(
    meta.extractedUrls.map(async (link) => ({ link, vt: await lookupUrlReputation(link) }))
  )

  let vtFindings = []
  let vtAvailable = false
  let vtMaliciousRatio
  for (const { link, vt } of vtResults) {
    const subjectLabel = meta.extractedUrls.length > 1 ? `The link ${link} in this message` : 'The link in this message'
    const vtResult = vtFindingsFor(vt, { subjectLabel })
    vtFindings = [...vtFindings, ...vtResult.findings]
    vtAvailable = vtAvailable || vtResult.vtAvailable
    if (typeof vtResult.vtMaliciousRatio === 'number') {
      vtMaliciousRatio = typeof vtMaliciousRatio === 'number' ? Math.max(vtMaliciousRatio, vtResult.vtMaliciousRatio) : vtResult.vtMaliciousRatio
    }
  }

  await finalizeAndRespond(res, {
    type: 'message',
    target: redactSecrets(message),
    findings: [...messageFindings, ...vtFindings],
    vtAvailable,
    vtMaliciousRatio,
    meta: { extractedUrls: meta.extractedUrls },
    startedAt,
    personalContext,
  })
})

async function handleUploadedFile(req, res, { type, analyzer }) {
  const startedAt = Date.now()
  const { path: filePath, originalname, mimetype, size } = req.file
  const personalContextParsed = personalContextSchema.safeParse(req.body?.personalContext)
  const personalContext = personalContextParsed.success ? personalContextParsed.data : 'general'

  try {
    const buffer = await fs.readFile(filePath)
    const sha256 = sha256Buffer(buffer)

    const { findings: structuralFindings, meta } = await analyzer({ buffer, originalName: originalname, mimetype })

    // Run every hash-reputation source in parallel — they're independent
    // network calls, and one being slow/down should never block another.
    // Koodous and MobSF are Android-specific: only queried for APKs.
    // MobSF (when configured) does real static analysis rather than a
    // hash lookup, so it can legitimately take up to MOBSF_TIMEOUT_MS —
    // that's the trade-off for being the one source that still works on
    // an APK nobody has ever submitted anywhere before.
    const subjectLabel = type === 'apk' ? 'This APK' : 'This file'
    const [vt, mb, koodous, mobsf] = await Promise.all([
      lookupFileReputation(sha256),
      lookupMalwareBazaar(sha256),
      type === 'apk' ? lookupKoodousReputation(sha256) : Promise.resolve(null),
      type === 'apk' ? analyzeWithMobsf(buffer, originalname) : Promise.resolve(null),
    ])

    const { findings: vtFindings, vtAvailable, vtMaliciousRatio } = vtFindingsFor(vt, { subjectLabel })
    const { findings: mbFindings } = malwareBazaarFindingsFor(mb, { subjectLabel })
    const { findings: koodousFindings } = koodous ? koodousFindingsFor(koodous) : { findings: [] }
    const { findings: mobsfFindings } = mobsf ? mobsfFindingsFor(mobsf) : { findings: [] }

    await finalizeAndRespond(res, {
      type,
      target: originalname,
      findings: [...structuralFindings, ...vtFindings, ...mbFindings, ...koodousFindings, ...mobsfFindings],
      vtAvailable,
      vtMaliciousRatio,
      meta: {
        ...meta,
        sha256,
        size,
        mimetype,
        vt: { available: vt.available, source: vt.source, reason: vt.reason, permalink: vt.permalink },
        malwareBazaar: { available: mb.available, found: mb.found ?? null, reason: mb.reason ?? null, permalink: mb.permalink ?? null },
        koodous: koodous
          ? { available: koodous.available, isDetected: koodous.isDetected ?? null, reason: koodous.reason ?? null, permalink: koodous.permalink ?? null }
          : { available: false, reason: 'not_applicable' },
        mobsf: mobsf
          ? { available: mobsf.available, securityScore: mobsf.securityScore ?? null, reason: mobsf.reason ?? null, permalink: mobsf.permalink ?? null }
          : { available: false, reason: 'not_applicable' },
      },
      startedAt,
      personalContext,
    })
  } catch (err) {
    if (err instanceof AppError) throw err
    logger.error('File analysis failed', { error: err.message })
    throw AppError.internal('ANALYSIS_FAILED', 'Failed to analyze the uploaded file.')
  } finally {
    await deleteTempFile(filePath)
  }
}

export const analyzeFile = asyncHandler((req, res) => handleUploadedFile(req, res, { type: 'file', analyzer: analyzeGenericFile }))
export const analyzeApkFile = asyncHandler((req, res) => handleUploadedFile(req, res, { type: 'apk', analyzer: analyzeApk }))
