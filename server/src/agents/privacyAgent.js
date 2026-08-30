import { runAgent } from './llmClient.js'
import { privacyAgentSchema } from './schemas.js'
import { fallbackPrivacy } from './fallbackTemplates.js'
import { hasRealEvidence, findingsByCategory } from './contract.js'

export async function runPrivacyAgent(input) {
  if (!hasRealEvidence(input.findings, 'privacy')) {
    return { applicable: false, notApplicableReason: 'No privacy-related evidence was collected for this investigation.', source: 'deterministic_gate', agentName: 'privacy' }
  }

  const privacyFindings = findingsByCategory(input.findings, 'privacy')
  const prompt = `Evidence packet (privacy-related findings only):
${JSON.stringify({ type: input.type, findings: privacyFindings }, null, 2)}

Task: Explain what this evidence means for the user's privacy.
CRITICAL DISTINCTION you must maintain: a permission or capability EXISTING (e.g. an app can request SMS access) is NOT the same as CONFIRMED data collection (e.g. proof the app actually read and sent SMS somewhere). Static analysis in this findings list can only ever show the former unless a finding explicitly states confirmed transmission. Do not upgrade "permission exists" into "data is being collected" language.
Respond with ONLY this JSON shape:
{
  "applicable": true,
  "summary": "1-3 plain-language sentences",
  "permissionExists": ["short phrases for each permission/capability observed"],
  "confirmedDataCollection": ["only list something here if a finding explicitly proves actual data transmission — otherwise leave empty"],
  "concerns": ["plain-language concern per notable finding"]
}`

  return runAgent('privacy', prompt, privacyAgentSchema, () => fallbackPrivacy(input))
}
