import { riskMeta, canUseItMeta } from '../data/constants.js'

// Phase 4 — builds the words the voice briefing speaks. This is a pure
// function of the SAME investigation record the Results page renders
// (see server/src/controllers/analyzeController.js -> `record`). It never
// calls the backend, never re-derives risk, and never invents a finding
// that isn't already present on `record`. If a field isn't there, that
// sentence is simply skipped — the voice can only ever say less than the
// screen, never more or different.
//
// Content structure mirrors the spec's required briefing shape:
//   1. Overall risk
//   2. Whether the user can use it
//   3. What is wrong / what caused the concern (WHAT WAS FOUND / WHY IT MATTERS)
//   4. What it could potentially cause — kept as two separate sentences,
//      "observed" (fact) then "possible consequence" (hedged), never merged
//      into one confirmed-sounding claim.
//   5. What the user should do

const TYPE_SUBJECT = {
  url: 'This website',
  file: 'This file',
  apk: 'This app',
  message: 'This message',
}

const VERDICT_SPEECH = {
  safe_to_use: 'Our recommendation is that this is safe to use.',
  use_with_caution: 'Our recommendation is to use it with caution.',
  avoid_if_possible: 'We recommend avoiding it if possible.',
  do_not_use: 'We recommend not using it.',
}

function clean(text) {
  if (!text) return ''
  return String(text).trim().replace(/\s+/g, ' ')
}

function asSentence(text) {
  const t = clean(text)
  if (!t) return ''
  return /[.!?]$/.test(t) ? t : `${t}.`
}

function lowerFirst(text) {
  const t = clean(text)
  if (!t) return t
  return t.charAt(0).toLowerCase() + t.slice(1)
}

/**
 * @param {object} record - the exact object returned by
 *   GET /api/investigation/:id (identical to what Results.jsx renders)
 * @returns {string[]} ordered list of short spoken segments (sentences)
 */
export function buildVoiceScript(record) {
  if (!record) return []
  const segments = []
  const subject = TYPE_SUBJECT[record.type] || 'This item'
  const riskLabel = (riskMeta[record.risk]?.label || record.risk || 'unknown').toLowerCase()

  // 1. Intro + overall risk — mirrors result.risk / result.overallScore
  segments.push(asSentence('Cyber Guardian has completed the analysis'))
  segments.push(asSentence(`${subject} has a ${riskLabel} risk, with an overall risk score of ${record.overallScore} out of 100`))

  // 2. Can I use it — mirrors result.aiExplanation.canUseIt
  const canUseIt = record.aiExplanation?.canUseIt
  if (canUseIt?.applicable) {
    const speech = VERDICT_SPEECH[canUseIt.verdict] || `Our recommendation: ${canUseItMeta[canUseIt.verdict]?.label || 'review before proceeding'}.`
    segments.push(speech)
    if (canUseIt.explanation) segments.push(asSentence(canUseIt.explanation))
  }

  // 3. What is wrong / what caused the concern — mirrors
  //    result.aiExplanation.security (summary + reasons), the same field
  //    the WhyDrawer headline is drawn from.
  const security = record.aiExplanation?.security
  if (security?.summary) {
    segments.push(asSentence(security.summary))
  }
  const topReasons = (security?.reasons || []).slice(0, 2)
  for (const reason of topReasons) {
    if (reason.explanation) {
      segments.push(asSentence(`What was found: ${reason.title}`))
      segments.push(asSentence(`Why it matters: ${reason.explanation}`))
    }
  }

  // 4. What it could potentially cause — OBSERVED vs POSSIBLE, kept as two
  //    distinct sentences. Prefers aiExplanation.whatCouldHappen (has the
  //    explicit observed/possibleConsequence split); falls back to the
  //    deterministic narrative (result.whatCouldHappen) when the agent
  //    layer found nothing applicable, e.g. a clean result.
  const wch = record.aiExplanation?.whatCouldHappen
  if (wch?.applicable && wch.items?.length) {
    for (const item of wch.items.slice(0, 2)) {
      if (item.observed) segments.push(asSentence(`The analysis detected: ${lowerFirst(item.observed)}`))
      if (item.possibleConsequence) segments.push(asSentence(item.possibleConsequence))
    }
  } else if (record.whatCouldHappen?.length) {
    for (const item of record.whatCouldHappen.slice(0, 2)) {
      segments.push(asSentence(item.detail || item.title))
    }
  }

  // 5. What the user should do — mirrors result.defense
  const defenseActions = (record.defense || []).slice(0, 2)
  if (defenseActions.length > 0) {
    segments.push(asSentence('Here is what we recommend you do'))
    for (const action of defenseActions) {
      segments.push(asSentence(`${action.action}${action.detail ? `. ${action.detail}` : ''}`))
    }
  }

  return segments.filter(Boolean)
}

export function buildVoicePlainText(record) {
  return buildVoiceScript(record).join(' ')
}
