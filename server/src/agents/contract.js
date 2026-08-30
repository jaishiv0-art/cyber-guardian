/**
 * Builds the single, fixed evidence packet every agent is allowed to see.
 * This is assembled AFTER the existing Risk Engine has already run — agents
 * receive the deterministic result, never the other way around. Nothing
 * here is invented: every field traces back to `findings` (produced by the
 * existing analyzers/VirusTotal) or `risk` (produced by the existing
 * riskEngine.js).
 *
 * @param {object} params
 * @param {string} params.investigationId
 * @param {string} params.type - 'url' | 'file' | 'apk' | 'message'
 * @param {string} params.target
 * @param {Array}  params.findings - the exact findings array passed to runRiskEngine()
 * @param {object} params.risk - the exact object returned by runRiskEngine()
 * @param {object} [params.metadata] - analyzer meta (hostname, permissions, vt info, etc.)
 * @param {string} [params.personalContext] - user-selected personalization lens only
 */
export function buildAgentInput({ investigationId, type, target, findings, risk, metadata = {}, personalContext = 'general' }) {
  return {
    investigationId,
    type,
    target,
    personalContext,
    findings: findings.map((f) => ({ code: f.code, category: f.category, severity: f.severity, title: f.title, detail: f.detail })),
    risk: {
      label: risk.riskLabel,
      overallScore: risk.overallRisk,
      scores: risk.scores,
      threatProbability: risk.threatProbability,
      potentialImpact: risk.potentialImpact,
      findingCounts: risk.findingCounts,
    },
    confidence: risk.confidence,
    metadata,
  }
}

/**
 * True if there is at least one finding in the category that represents
 * genuine evidence — as opposed to only a "*_NOT_APPLICABLE" placeholder
 * the analyzer emits when that category simply doesn't apply. Note this
 * deliberately does NOT filter by severity: an "info"-severity finding
 * like PERMISSIONS_DETECTED is still real, meaningful evidence (it just
 * doesn't move the risk score), and must not be mistaken for a placeholder.
 */
export function hasRealEvidence(findings, category) {
  const catFindings = findings.filter((f) => f.category === category)
  if (catFindings.length === 0) return false
  return catFindings.some((f) => !f.code.endsWith('_NOT_APPLICABLE'))
}

export function findingsByCategory(findings, category) {
  return findings.filter((f) => f.category === category)
}

export const PERSONAL_CONTEXTS = ['banking', 'email', 'college', 'social_media', 'personal_files', 'identity', 'general']

export const PERSONAL_CONTEXT_LABELS = {
  banking: 'banking and financial accounts',
  email: 'your email account',
  college: 'college/university accounts',
  social_media: 'social media accounts',
  personal_files: 'personal files and documents',
  identity: 'your personal identity',
  general: 'your general digital safety',
}

/**
 * Deterministic, code-only mapping from risk label to a "can I use it?"
 * verdict. This is computed here — never by the AI — and the orchestrator
 * forcibly overwrites whatever verdict an AI agent returns with this value,
 * so the recommendation can never drift from the Risk Engine's own result.
 */
export function verdictForRisk(riskLabel) {
  if (riskLabel === 'safe' || riskLabel === 'low') return 'safe_to_use'
  if (riskLabel === 'medium') return 'use_with_caution'
  if (riskLabel === 'high') return 'avoid_if_possible'
  return 'do_not_use'
}
