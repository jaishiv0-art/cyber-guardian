import { whatCouldHappenFor, attackStoryFor, defenseFor, genericByRisk } from '../engine/narrative.js'
import { hasRealEvidence, verdictForRisk, PERSONAL_CONTEXT_LABELS } from './contract.js'

const RISK_SIMPLE_EXPLANATION = {
  safe: 'Guardian checked this closely and found nothing concerning.',
  low: 'Guardian found only minor signals — nothing that clearly indicates danger.',
  medium: 'Guardian found some signals worth a second look before you proceed.',
  high: 'Guardian found multiple strong signals that this is unsafe.',
  critical: 'Guardian found strong evidence this is actively dangerous.',
}

const VERDICT_EXPLANATION = {
  safe_to_use: (ctx) => `Based on the evidence Guardian gathered, this appears safe to use${ctx ? ` for ${ctx}` : ''}.`,
  use_with_caution: (ctx) => `Some signals here are worth attention. Proceed carefully${ctx ? `, especially given this involves ${ctx}` : ''}.`,
  avoid_if_possible: (ctx) => `Guardian found strong warning signs. Avoid this if you can${ctx ? `, particularly since this involves ${ctx}` : ''}.`,
  do_not_use: (ctx) => `Guardian found serious evidence of danger. Do not proceed${ctx ? `, especially with ${ctx} at stake` : ''}.`,
}

export function fallbackSecurityExplanation(input) {
  const notable = input.findings.filter((f) => f.severity !== 'info').slice(0, 5)
  const reasons = notable.map((f) => ({ title: f.title, explanation: f.detail }))
  const summary =
    reasons.length === 0
      ? RISK_SIMPLE_EXPLANATION[input.risk.label] ?? RISK_SIMPLE_EXPLANATION.medium
      : `${RISK_SIMPLE_EXPLANATION[input.risk.label] ?? ''} Main reasons: ${notable.map((f) => f.title.toLowerCase()).join('; ')}.`.trim()
  return { applicable: true, summary, reasons }
}

export function fallbackCanUseIt(input) {
  const verdict = verdictForRisk(input.risk.label)
  const ctx = input.personalContext !== 'general' ? PERSONAL_CONTEXT_LABELS[input.personalContext] : null
  return { applicable: true, verdict, explanation: VERDICT_EXPLANATION[verdict](ctx) }
}

export function fallbackPrivacy(input) {
  const applicable = hasRealEvidence(input.findings, 'privacy')
  if (!applicable) {
    return { applicable: false, notApplicableReason: 'No privacy-related evidence was collected for this investigation.' }
  }
  const privacyFindings = input.findings.filter((f) => f.category === 'privacy' && f.severity !== 'info')
  const permissionExists = []
  for (const f of privacyFindings) {
    if (f.code === 'PERMISSIONS_DETECTED' || f.detail.includes(',')) {
      permissionExists.push(...f.detail.split(',').map((s) => s.trim()).filter(Boolean))
    } else {
      permissionExists.push(f.title)
    }
  }
  return {
    applicable: true,
    summary: `Guardian found ${privacyFindings.length} privacy-relevant signal${privacyFindings.length === 1 ? '' : 's'}. These reflect what was requested or observed — not confirmed proof that data was actually collected or sent anywhere.`,
    permissionExists: [...new Set(permissionExists)].slice(0, 15),
    confirmedDataCollection: [],
    concerns: privacyFindings.map((f) => f.detail),
  }
}

export function fallbackTracking(input) {
  if (!hasRealEvidence(input.findings, 'tracking')) {
    return { applicable: false, notApplicableReason: 'No tracking-related evidence applies to this investigation type.' }
  }
  const trackingFindings = input.findings.filter((f) => f.category === 'tracking')

  let classification = 'none_detected'
  if (trackingFindings.some((f) => f.code === 'MULTIPLE_TRACKING_PARAMS' || f.code === 'EXCESSIVE_UNKNOWN_TRACKERS')) {
    classification = 'excessive_tracking'
  } else if (trackingFindings.some((f) => f.code === 'TRACKING_PARAMS_PRESENT' || f.code === 'ADVERTISING_DETECTED')) {
    classification = 'normal_advertising'
  }

  const summaryByClass = {
    none_detected: 'Guardian did not detect tracking or advertising indicators here.',
    normal_advertising: 'Guardian detected typical advertising/tracking activity — common on most commercial sites and not, by itself, a security concern.',
    excessive_tracking: 'Guardian detected a higher-than-usual amount of tracking activity, worth being aware of even though it is not necessarily malicious.',
    suspicious_collection: 'Guardian detected tracking patterns unusual enough to warrant caution about how your data may be collected here.',
  }

  return {
    applicable: true,
    classification,
    summary: summaryByClass[classification],
    indicators: trackingFindings.map((f) => f.detail),
  }
}

export function fallbackAttackStory(input) {
  const topFinding = input.findings.find((f) => attackStoryFor(f.code))
  const rawSteps = topFinding ? attackStoryFor(topFinding.code) : genericByRisk(input.risk.label).attackStory

  if (!rawSteps || rawSteps.length === 0) {
    return { applicable: false, notApplicableReason: 'No plausible attack sequence applies at this risk level.' }
  }

  const phases = ['initial_exposure', 'user_interaction', 'possible_exploitation', 'potential_impact']
  const stages = rawSteps.slice(0, 4).map((step, i) => ({
    phase: phases[Math.min(i, phases.length - 1)],
    title: step.title,
    detail: step.detail,
  }))
  return { applicable: true, stages }
}

export function fallbackWhatCouldHappen(input) {
  const notable = input.findings.filter((f) => f.severity !== 'info' && whatCouldHappenFor(f.code))
  if (notable.length > 0) {
    return {
      applicable: true,
      items: notable.slice(0, 5).map((f) => {
        const entry = whatCouldHappenFor(f.code)
        return { observed: f.title, possibleConsequence: entry.detail }
      }),
    }
  }
  const generic = genericByRisk(input.risk.label).whatCouldHappen
  return {
    applicable: generic.length > 0,
    items: generic.map((g) => ({ observed: 'Overall risk assessment', possibleConsequence: g.detail })),
  }
}

export function fallbackDefense(input) {
  const seen = new Set()
  const actions = []
  for (const f of input.findings) {
    const entry = defenseFor(f.code)
    if (entry && !seen.has(f.code)) {
      seen.add(f.code)
      actions.push({ action: entry.action, detail: entry.detail, relatedFinding: f.code })
    }
  }
  if (actions.length === 0) {
    const generic = genericByRisk(input.risk.label).defense
    for (const g of generic) actions.push({ action: g.action, detail: g.detail })
  }
  return { applicable: true, actions: actions.slice(0, 8) }
}
