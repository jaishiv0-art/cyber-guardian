import { runAgent } from './llmClient.js'
import { canUseItSchema } from './schemas.js'
import { fallbackCanUseIt } from './fallbackTemplates.js'
import { verdictForRisk, PERSONAL_CONTEXT_LABELS } from './contract.js'

export async function runCanUseItAgent(input) {
  const deterministicVerdict = verdictForRisk(input.risk.label)
  const ctxLabel = input.personalContext !== 'general' ? PERSONAL_CONTEXT_LABELS[input.personalContext] : null

  const prompt = `Evidence packet:
${JSON.stringify({ type: input.type, findings: input.findings, risk: input.risk }, null, 2)}

The verdict has ALREADY been decided by deterministic rules and is fixed: "${deterministicVerdict}". Do not change it.
${ctxLabel ? `The user says this specifically involves: ${ctxLabel}. Mention that relevance if it fits naturally.` : ''}

Task: Write a short (1-3 sentence), plain-language explanation of why this verdict makes sense given the evidence above. Never use absolute words like "100% safe" or "guaranteed".
Respond with ONLY this JSON shape:
{ "applicable": true, "verdict": "${deterministicVerdict}", "explanation": "..." }`

  const result = await runAgent('can_use_it', prompt, canUseItSchema, () => fallbackCanUseIt(input))
  return { ...result, verdict: deterministicVerdict }
}
