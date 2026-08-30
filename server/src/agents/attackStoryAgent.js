import { runAgent } from './llmClient.js'
import { attackStorySchema } from './schemas.js'
import { fallbackAttackStory } from './fallbackTemplates.js'

export async function runAttackStoryAgent(input) {
  if (input.risk.label === 'safe') {
    return { applicable: false, notApplicableReason: 'No plausible attack sequence applies to a safe result.', source: 'deterministic_gate', agentName: 'attack_story' }
  }

  const notable = input.findings.filter((f) => f.severity !== 'info')
  if (notable.length === 0) {
    return { applicable: false, notApplicableReason: 'No specific findings support constructing a scenario.', source: 'deterministic_gate', agentName: 'attack_story' }
  }

  const prompt = `Evidence packet (notable findings only):
${JSON.stringify({ type: input.type, findings: notable, risk: input.risk }, null, 2)}

Task: Describe ONE possible (not confirmed) attack scenario grounded ONLY in the findings above, structured as exactly 4 phases: initial_exposure, user_interaction, possible_exploitation, potential_impact.
This must clearly read as a possible scenario, not something that has actually happened. Do not invent steps unrelated to the findings above.
Respond with ONLY this JSON shape:
{ "applicable": true, "stages": [
  { "phase": "initial_exposure", "title": "...", "detail": "..." },
  { "phase": "user_interaction", "title": "...", "detail": "..." },
  { "phase": "possible_exploitation", "title": "...", "detail": "..." },
  { "phase": "potential_impact", "title": "...", "detail": "..." }
] }`

  return runAgent('attack_story', prompt, attackStorySchema, () => fallbackAttackStory(input))
}
