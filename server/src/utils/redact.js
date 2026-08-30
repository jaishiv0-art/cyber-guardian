const PATTERNS = [
  // "password: xyz", "pwd is xyz", "passcode=xyz" — redact whatever follows the label on that clause
  { re: /\b(passwords?|pwd|passcode)\b\s*(?:is|:|=)\s*\S+/gi, replace: (m) => `${m.split(/(?:is|:|=)/)[0]}: [redacted]` },
  // OTP/PIN/CVV values following a label
  { re: /\b(otp|pin|cvv)\b\s*(?:is|:|=)?\s*\d{3,8}\b/gi, replace: (m) => m.replace(/\d{3,8}/, '[redacted]') },
  // Credit-card-shaped digit sequences (13-19 digits, optionally grouped/hyphenated)
  { re: /\b(?:\d[ -]?){13,19}\b/g, replace: '[redacted-number]' },
]

/** Redacts likely credential/secret material from free text before it is stored, logged, or returned. */
export function redactSecrets(text) {
  if (!text || typeof text !== 'string') return text
  let out = text
  for (const { re, replace } of PATTERNS) {
    out = out.replace(re, replace)
  }
  return out
}
