import { runAgent } from './llmClient.js'
import { whatCouldHappenSchema } from './schemas.js'
import { fallbackWhatCouldHappen } from './fallbackTemplates.js'

export async function runWhatCouldHappenAgent(input) {
  const notable = input.findings.filter((f) => f.severity !== 'info')
  if (notable.length === 0) {
    return { applicable: false, notApplicableReason: 'No notable findings to project consequences from.', source: 'deterministic_gate', agentName: 'what_could_happen' }
  }

  const prompt = `Evidence packet (notable findings only):
${JSON.stringify({ type: input.type, findings: notable, risk: input.risk }, null, 2)}

Task: For each relevant finding, produce one item with two clearly separated parts:
- "observed": restate ONLY what was actually detected (fact, present tense, e.g. "Suspicious credential page detected")
- "possibleConsequence": what COULD happen as a result, using hedged language like "could", "may", "if you were to..." - never stated as something that already happened.
Never blend these two into one confirmed-sounding statement.
Respond with ONLY this JSON shape:
{ "applicable": true, "items": [ { "observed": "...", "possibleConsequence": "..." } ] }`

  return runAgent('what_could_happen', prompt, whatCouldHappenSchema, () => fallbackWhatCouldHappen(input))
}
