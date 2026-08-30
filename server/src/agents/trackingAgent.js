import { runAgent } from './llmClient.js'
import { trackingAgentSchema } from './schemas.js'
import { fallbackTracking } from './fallbackTemplates.js'
import { findingsByCategory, hasRealEvidence } from './contract.js'

// The classification itself is deterministic (mirrors fallbackTracking's own
// logic) — the AI is only asked to phrase the explanation and is instructed
// to echo the given classification back unchanged; we overwrite it anyway.
function deterministicClassification(trackingFindings) {
  if (trackingFindings.some((f) => f.code === 'MULTIPLE_TRACKING_PARAMS' || f.code === 'EXCESSIVE_UNKNOWN_TRACKERS')) return 'excessive_tracking'
  if (trackingFindings.some((f) => f.code === 'TRACKING_PARAMS_PRESENT' || f.code === 'ADVERTISING_DETECTED')) return 'normal_advertising'
  return 'none_detected'
}

export async function runTrackingAgent(input) {
  if (!hasRealEvidence(input.findings, 'tracking')) {
    return { applicable: false, notApplicableReason: 'No tracking-related evidence applies to this investigation type.', source: 'deterministic_gate', agentName: 'tracking' }
  }

  const trackingFindings = findingsByCategory(input.findings, 'tracking')
  const classification = deterministicClassification(trackingFindings)

  const prompt = `Evidence packet (tracking-related findings only):
${JSON.stringify({ type: input.type, findings: trackingFindings }, null, 2)}

The classification has ALREADY been decided deterministically and is fixed: "${classification}".
Definitions: "normal_advertising" = typical ad/analytics activity, not a security concern by itself. "excessive_tracking" = an unusually high volume of tracking activity. "suspicious_collection" = patterns that specifically suggest covert or unusual data gathering. "none_detected" = nothing found.
Do not call normal advertising malicious. Do not change the classification.
Respond with ONLY this JSON shape:
{ "applicable": true, "classification": "${classification}", "summary": "1-3 plain-language sentences", "indicators": ["plain-language description per tracking finding above"] }`

  const result = await runAgent('tracking', prompt, trackingAgentSchema, () => fallbackTracking(input))
  return { ...result, classification }
}
