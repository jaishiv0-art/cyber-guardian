import { runAgent } from './llmClient.js'
import { defenseAgentSchema } from './schemas.js'
import { fallbackDefense } from './fallbackTemplates.js'
import { PERSONAL_CONTEXT_LABELS } from './contract.js'

export async function runDefenseAgent(input) {
  const ctxLabel = input.personalContext !== 'general' ? PERSONAL_CONTEXT_LABELS[input.personalContext] : null

  const prompt = `Evidence packet:
${JSON.stringify({ type: input.type, findings: input.findings, risk: input.risk }, null, 2)}

Task: Give concrete, actionable defense recommendations that correspond directly to the findings above. Do not give unrelated generic security advice not tied to something actually found.
${ctxLabel ? `The user specifically cares about: ${ctxLabel}. Where a recommendation is especially relevant to that, mention it, but do not invent new findings to justify it.` : ''}
Respond with ONLY this JSON shape:
{ "applicable": true, "actions": [ { "action": "short imperative instruction", "detail": "why, in plain language", "relatedFinding": "finding code this responds to, if any" } ] }
Always include at least one action even at low risk (e.g. "no action needed, but stay alert").`

  return runAgent('defense', prompt, defenseAgentSchema, () => fallbackDefense(input))
}
