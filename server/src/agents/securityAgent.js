import { runAgent } from './llmClient.js'
import { securityExplanationSchema } from './schemas.js'
import { fallbackSecurityExplanation } from './fallbackTemplates.js'

export async function runSecurityExplanationAgent(input) {
  const prompt = `Evidence packet (the only facts you may use):
${JSON.stringify({ type: input.type, findings: input.findings, risk: input.risk }, null, 2)}

Task: Explain, for a non-technical reader, what Guardian's security analysis found and why it matters.
Respond with ONLY this JSON shape:
{
  "applicable": true,
  "summary": "1-3 plain-language sentences on the overall security picture",
  "reasons": [ { "title": "short label", "explanation": "why this specific finding matters, in plain language" } ]
}
Include one "reasons" entry per non-info finding above (skip purely informational ones unless nothing else exists). Do not add findings not listed above.`

  return runAgent('security_explanation', prompt, securityExplanationSchema, () => fallbackSecurityExplanation(input))
}
