import env from '../config/env.js'

const { severityWeights, categoryWeights, thresholds } = env.riskEngine
const CATEGORIES = ['security', 'privacy', 'tracking']

/**
 * Combines a list of independent risk weights (each in [0,1]) into a single
 * bounded risk probability using a noisy-OR: the chance that AT LEAST ONE
 * signal indicates real danger, treating each finding as an independent
 * piece of evidence. This is a standard, deterministic way to combine
 * multiple weak/strong signals without simple sums blowing past 100%.
 *
 *   combined = 1 - Π(1 - w_i)
 */
function combineWeights(weights) {
  if (weights.length === 0) return 0
  const product = weights.reduce((acc, w) => acc * (1 - Math.min(Math.max(w, 0), 1)), 1)
  return 1 - product
}

function severityToWeight(severity) {
  return severityWeights[severity] ?? severityWeights.medium
}

function clamp(n, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n))
}

function labelForRisk(risk) {
  if (risk < thresholds.safe) return 'safe'
  if (risk < thresholds.low) return 'low'
  if (risk < thresholds.medium) return 'medium'
  if (risk < thresholds.high) return 'high'
  return 'critical'
}

// A single strong piece of evidence (e.g. a VirusTotal malicious verdict,
// a disguised executable, an SMS+Accessibility permission combo) must be
// able to dominate the overall verdict on its own. Without this, the
// category-weighted blend below can mathematically never reach "high" or
// "critical" when every finding lives in one category — e.g. a lone
// `critical` finding in `security` (weight 0.85) is worth at most
// `categoryWeights.security * 85 ≈ 42` overall, which only reaches
// "medium". That silently downgrades confirmed-malicious verdicts, which
// is exactly the "genuine result" this exists to guarantee. The floor
// below is a lower bound only — it raises the overall risk to sit inside
// the band appropriate for the single worst finding, but never lowers a
// score the weighted blend already pushed higher (e.g. many findings
// spread across categories).
const SEVERITY_FLOOR = {
  critical: 80, // guarantees the "critical" band (>= thresholds.high)
  high: 60, // guarantees the "high" band
  medium: 40, // guarantees the "medium" band
  low: 20, // guarantees the "low" band
  info: 0,
}

function worstSeverityFloor(findings) {
  let floor = 0
  for (const f of findings) {
    const f2 = SEVERITY_FLOOR[f.severity] ?? 0
    if (f2 > floor) floor = f2
  }
  return floor
}

function countBySeverity(findings) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  for (const f of findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1
  return counts
}

const IMPACT_SCALE = ['Minimal', 'Limited', 'Moderate', 'Severe', 'Critical']

function impactForFindings(findings, riskLabel) {
  const counts = countBySeverity(findings)
  let score = 0
  score += counts.critical * 3
  score += counts.high * 2
  score += counts.medium * 1
  const riskIndex = ['safe', 'low', 'medium', 'high', 'critical'].indexOf(riskLabel)
  const idx = Math.round(score * 0.6 + riskIndex * 1.2)
  return IMPACT_SCALE[Math.max(0, Math.min(IMPACT_SCALE.length - 1, idx))]
}

/**
 * Deterministic confidence score: how much real evidence backs this verdict.
 * Starts from a base, gains from live reputation data and breadth of
 * heuristic coverage, and is explicitly capped below 100 — Guardian never
 * claims certainty.
 */
function confidenceFor(findings, reputationSignal) {
  let confidence = 50
  if (reputationSignal.vtAvailable) confidence += 25
  const categoriesCovered = new Set(findings.map((f) => f.category)).size
  confidence += categoriesCovered * 6
  if (findings.length >= 4) confidence += 6
  return clamp(Math.min(confidence, 97))
}

/**
 * @param {Array<{code:string, category:'security'|'privacy'|'tracking', severity:'critical'|'high'|'medium'|'low'|'info', title:string, detail:string, weightOverride?:number}>} findings
 * @param {{ vtAvailable?: boolean, vtMaliciousRatio?: number }} [reputationSignal]
 */
export function runRiskEngine(findings, reputationSignal = {}) {
  const byCategory = { security: [], privacy: [], tracking: [] }
  for (const f of findings) {
    if (CATEGORIES.includes(f.category)) byCategory[f.category].push(f)
  }

  const categoryRisk = {}
  for (const cat of CATEGORIES) {
    const weights = byCategory[cat]
      .filter((f) => f.severity !== 'info') // info findings are evidence, not risk contributors
      .map((f) => (typeof f.weightOverride === 'number' ? f.weightOverride : severityToWeight(f.severity)))
    categoryRisk[cat] = Math.round(combineWeights(weights) * 1000) / 10 // 0-100, 1 decimal
  }

  const overallRiskRaw =
    categoryWeights.security * categoryRisk.security +
    categoryWeights.privacy * categoryRisk.privacy +
    categoryWeights.tracking * categoryRisk.tracking

  // Lower-bound the blended score by the worst individual finding so a
  // confirmed-malicious / critical signal can never be diluted into a
  // falsely reassuring overall verdict (see worstSeverityFloor above).
  const overallRisk = clamp(Math.max(Math.round(overallRiskRaw), worstSeverityFloor(findings)))

  // Safety scores shown in the UI: higher = safer (100 - risk).
  const scores = {
    security: clamp(Math.round(100 - categoryRisk.security)),
    privacy: clamp(Math.round(100 - categoryRisk.privacy)),
    tracking: clamp(Math.round(100 - categoryRisk.tracking)),
  }

  const riskLabel = labelForRisk(overallRisk)

  // Threat probability blends our own signal combination with a live
  // reputation ratio when one was actually returned by a real API.
  let threatProbability = overallRisk
  if (reputationSignal.vtAvailable && typeof reputationSignal.vtMaliciousRatio === 'number') {
    threatProbability = Math.round(0.6 * reputationSignal.vtMaliciousRatio * 100 + 0.4 * overallRisk)
  }
  threatProbability = clamp(threatProbability)

  const potentialImpact = impactForFindings(findings, riskLabel)
  const confidence = confidenceFor(findings, reputationSignal)

  return {
    overallRisk,
    riskLabel,
    scores,
    categoryRisk,
    threatProbability,
    potentialImpact,
    confidence,
    findingCounts: countBySeverity(findings),
  }
}
