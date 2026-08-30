// Phase 4 follow-up — picks a default voice when the user hasn't explicitly
// chosen one in Settings (voiceURI === ''). Browsers don't expose a
// standard "gender" field on SpeechSynthesisVoice, so this works by
// matching voice.name against known-good female system voices across
// platforms, ordered roughly best-to-worst sounding:
//
//   1. Microsoft "Online (Natural)" neural voices (Edge/Windows) — Aria,
//      Jenny, Michelle, Ana. These are by far the least "robotic".
//   2. Apple on-device voices (macOS/iOS Safari) — Samantha, Ava, etc.
//      Also high quality, fully offline.
//   3. Any voice whose name literally contains "female" — covers Android/
//      ChromeOS TTS voices (e.g. "en-us-x-sfg#female_1-local") and Chrome's
//      "Google UK English Female".
//   4. Older/legacy Windows desktop voices (Zira, Hazel, ...) — serviceable
//      but noticeably more robotic than 1–2.
//
// This is a best-effort heuristic, not a guarantee: if the OS/browser only
// ships one flat, unlabeled voice (common on Linux, where the only option
// is often espeak), there's nothing to select between and the function
// returns null so the caller falls back to the browser's own default.

const PREFERRED_FEMALE_VOICE_NAMES = [
  // Tier 1 — neural/online voices, sound the most natural
  'aria',
  'jenny',
  'michelle',
  'ana',
  // Tier 2 — high quality on-device voices (macOS/iOS)
  'samantha',
  'ava',
  'allison',
  'victoria',
  'karen',
  'moira',
  'tessa',
  'fiona',
  'serena',
  'zoe',
  'nicky',
  'kate',
  // Tier 3 — Chrome/Google labeled voices
  'google uk english female',
  'google us english',
  // Tier 4 — older/legacy desktop voices, still clearly female
  'zira',
  'hazel',
  'susan',
  'catherine',
  'linda',
  'eva',
]

function scoreVoice(voice, preferredLang) {
  const name = (voice?.name || '').toLowerCase()
  if (!name) return -1

  // Never auto-pick a voice that's explicitly labeled male.
  if (/\bmale\b/.test(name) && !/female/.test(name)) return -1

  let score = 0
  if (/female/.test(name)) score += 100

  const tierIndex = PREFERRED_FEMALE_VOICE_NAMES.findIndex((known) => name.includes(known))
  if (tierIndex !== -1) score += 90 - tierIndex

  if (preferredLang && voice.lang && voice.lang.toLowerCase().startsWith(preferredLang.toLowerCase())) {
    score += 5
  }
  // Small tie-breaker toward voices that work fully offline (no network
  // round-trip), matching why Web Speech was chosen over cloud TTS here.
  if (voice.localService) score += 1

  return score
}

/**
 * @param {SpeechSynthesisVoice[]} voices
 * @param {string} [preferredLang] BCP-47 language tag, e.g. 'en-US'
 * @returns {SpeechSynthesisVoice|null} best-guess natural-sounding female
 *   voice, or null if nothing in the list scores above zero (caller should
 *   fall back to the browser's own default voice in that case).
 */
export function pickDefaultVoice(voices, preferredLang) {
  if (!voices || voices.length === 0) return null
  const lang = preferredLang || (typeof navigator !== 'undefined' ? navigator.language : 'en-US')

  let best = null
  let bestScore = 0
  for (const voice of voices) {
    const score = scoreVoice(voice, lang)
    if (score > bestScore) {
      bestScore = score
      best = voice
    }
  }
  return best
}
