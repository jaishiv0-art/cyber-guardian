// Presentation-only constants. All investigation RESULTS now come from the
// real backend (src/services/api.js) — nothing here fabricates a verdict.

export const riskMeta = {
  safe: { label: 'Safe', color: 'var(--risk-safe)', bg: 'var(--risk-safe-bg)' },
  low: { label: 'Low risk', color: 'var(--risk-low)', bg: 'var(--risk-safe-bg)' },
  medium: { label: 'Medium risk', color: 'var(--risk-medium)', bg: 'var(--risk-medium-bg)' },
  high: { label: 'High risk', color: 'var(--risk-high)', bg: 'var(--risk-high-bg)' },
  critical: { label: 'Critical', color: 'var(--risk-critical)', bg: 'var(--risk-critical-bg)' },
}

export const investigationTypes = [
  { id: 'url', label: 'URL', hint: 'Paste a link to a site, shop or profile' },
  { id: 'file', label: 'File', hint: 'Upload a document, image or archive' },
  { id: 'apk', label: 'APK', hint: 'Upload an Android app package' },
  { id: 'message', label: 'Message', hint: 'Paste an SMS, email or chat message' },
]

// Labels only — the backend does the real work. These describe the phases
// of a single synchronous analysis call for the progress UI to narrate
// while the request is in flight, now including the Phase 3 agent layer.
export const agentSteps = [
  { id: 'ingest', label: 'Analyzing target', detail: 'Preparing the target for analysis' },
  { id: 'recon', label: 'Checking reputation', detail: 'Checking structure, patterns and known-bad signatures' },
  { id: 'reputation', label: 'Evaluating security', detail: 'Querying live threat-intelligence sources' },
  { id: 'scoring', label: 'Evaluating privacy & tracking', detail: 'Combining evidence into weighted risk scores' },
  { id: 'explain', label: 'Building explanation', detail: 'Consulting specialized explanation agents' },
  { id: 'synthesis', label: 'Preparing recommendation', detail: 'Assembling findings, evidence and defense guidance' },
]

export const personalContexts = [
  { id: 'general', label: 'General' },
  { id: 'banking', label: 'Banking' },
  { id: 'email', label: 'Email' },
  { id: 'college', label: 'College' },
  { id: 'social_media', label: 'Social Media' },
  { id: 'personal_files', label: 'Personal Files' },
  { id: 'identity', label: 'Identity' },
]

export const canUseItMeta = {
  safe_to_use: { label: 'Safe to use', color: 'var(--risk-safe)', bg: 'var(--risk-safe-bg)' },
  use_with_caution: { label: 'Use with caution', color: 'var(--risk-medium)', bg: 'var(--risk-medium-bg)' },
  avoid_if_possible: { label: 'Avoid if possible', color: 'var(--risk-high)', bg: 'var(--risk-high-bg)' },
  do_not_use: { label: 'Do not use', color: 'var(--risk-critical)', bg: 'var(--risk-critical-bg)' },
}

export const trackingClassificationMeta = {
  none_detected: { label: 'No tracking detected', color: 'var(--risk-safe)' },
  normal_advertising: { label: 'Normal advertising', color: 'var(--core-cyan)' },
  excessive_tracking: { label: 'Excessive tracking', color: 'var(--risk-medium)' },
  suspicious_collection: { label: 'Suspicious data collection', color: 'var(--risk-critical)' },
}
