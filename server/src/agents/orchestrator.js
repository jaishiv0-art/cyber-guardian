import { buildAgentInput, hasRealEvidence } from './contract.js'
import { runSecurityExplanationAgent } from './securityAgent.js'
import { runCanUseItAgent } from './canUseItAgent.js'
import { runPrivacyAgent } from './privacyAgent.js'
import { runTrackingAgent } from './trackingAgent.js'
import { runAttackStoryAgent } from './attackStoryAgent.js'
import { runWhatCouldHappenAgent } from './whatCouldHappenAgent.js'
import { runDefenseAgent } from './defenseAgent.js'

/**
 * Decides which agents are relevant to THIS investigation, purely from the
 * evidence already produced by the existing pipeline. This is plain
 * conditional logic — no LLM call happens here, and it never touches the
 * numeric risk score. It only decides who gets to speak.
 */
function planAgents(input) {
  const plan = {
    security_explanation: { run: true, reason: 'Always explains the overall security picture.' },
    can_use_it: { run: true, reason: 'Always provides a usage recommendation.' },
    privacy: { run: false, reason: 'No privacy-related evidence was collected.' },
    tracking: { run: false, reason: 'No tracking-related evidence was collected.' },
    attack_story: { run: false, reason: 'Result is safe — no attack scenario applies.' },
    what_could_happen: { run: false, reason: 'No notable findings to project consequences from.' },
    defense: { run: true, reason: 'Always provides at least baseline guidance.' },
  }

  if (hasRealEvidence(input.findings, 'privacy')) {
    plan.privacy = { run: true, reason: 'Privacy-related findings are present (e.g. permissions, cookies, personal-data requests).' }
  }
  if (hasRealEvidence(input.findings, 'tracking')) {
    plan.tracking = { run: true, reason: 'Tracking-related findings are present.' }
  }
  const hasNotableFinding = input.findings.some((f) => f.severity !== 'info')
  if (input.risk.label !== 'safe' && hasNotableFinding) {
    plan.attack_story = { run: true, reason: `Risk level is "${input.risk.label}" with notable findings — a possible-scenario story is useful.` }
  }
  if (hasNotableFinding) {
    plan.what_could_happen = { run: true, reason: 'Notable findings exist to project possible consequences from.' }
  } else {
    plan.what_could_happen = { run: false, reason: 'No notable findings — nothing concerning to project forward.' }
  }

  return plan
}

/**
 * Runs the full agent layer for one investigation. Every agent call is
 * independently fault-tolerant (see llmClient.runAgent) — a single agent
 * failing can never fail the investigation as a whole, and the numeric
 * risk score passed in is never touched.
 */
export async function runOrchestrator({ investigationId, type, target, findings, risk, metadata, personalContext }) {
  const input = buildAgentInput({ investigationId, type, target, findings, risk, metadata, personalContext })
  const plan = planAgents(input)
  const activity = []
  const timeline = (agentKey, phaseLabel) => activity.push({ agent: agentKey, label: phaseLabel, ran: plan[agentKey]?.run ?? true, reason: plan[agentKey]?.reason })

  const tasks = {}
  timeline('security_explanation', 'Evaluating security')
  tasks.security = runSecurityExplanationAgent(input)

  timeline('can_use_it', 'Preparing recommendation')
  tasks.canUseIt = runCanUseItAgent(input)

  if (plan.privacy.run) {
    timeline('privacy', 'Evaluating privacy')
    tasks.privacy = runPrivacyAgent(input)
  } else {
    activity.push({ agent: 'privacy', label: 'Evaluating privacy', ran: false, reason: plan.privacy.reason })
    tasks.privacy = Promise.resolve({ applicable: false, notApplicableReason: plan.privacy.reason, source: 'skipped', agentName: 'privacy' })
  }

  if (plan.tracking.run) {
    timeline('tracking', 'Evaluating tracking & ads')
    tasks.tracking = runTrackingAgent(input)
  } else {
    activity.push({ agent: 'tracking', label: 'Evaluating tracking & ads', ran: false, reason: plan.tracking.reason })
    tasks.tracking = Promise.resolve({ applicable: false, notApplicableReason: plan.tracking.reason, source: 'skipped', agentName: 'tracking' })
  }

  if (plan.what_could_happen.run) {
    timeline('what_could_happen', 'Projecting possible consequences')
    tasks.whatCouldHappen = runWhatCouldHappenAgent(input)
  } else {
    activity.push({ agent: 'what_could_happen', label: 'Projecting possible consequences', ran: false, reason: plan.what_could_happen.reason })
    tasks.whatCouldHappen = Promise.resolve({ applicable: false, notApplicableReason: plan.what_could_happen.reason, source: 'skipped', agentName: 'what_could_happen' })
  }

  if (plan.attack_story.run) {
    timeline('attack_story', 'Building possible attack story')
    tasks.attackStory = runAttackStoryAgent(input)
  } else {
    activity.push({ agent: 'attack_story', label: 'Building possible attack story', ran: false, reason: plan.attack_story.reason })
    tasks.attackStory = Promise.resolve({ applicable: false, notApplicableReason: plan.attack_story.reason, source: 'skipped', agentName: 'attack_story' })
  }

  timeline('defense', 'Building explanation & defense guidance')
  tasks.defense = runDefenseAgent(input)

  const [security, canUseIt, privacy, tracking, whatCouldHappen, attackStory, defense] = await Promise.all([
    tasks.security,
    tasks.canUseIt,
    tasks.privacy,
    tasks.tracking,
    tasks.whatCouldHappen,
    tasks.attackStory,
    tasks.defense,
  ])

  return {
    security,
    canUseIt,
    privacy,
    tracking,
    whatCouldHappen,
    attackStory,
    defense,
    agentActivity: activity,
  }
}
