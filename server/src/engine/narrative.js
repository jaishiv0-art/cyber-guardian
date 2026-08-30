/**
 * Every entry here is static, hand-written content selected by a lookup on
 * finding codes that were actually detected by the analyzers. Nothing in
 * this file is generated at request time — it's a deterministic mapping,
 * the same input codes always produce the same output text.
 */

const WHAT_COULD_HAPPEN = {
  VT_MALICIOUS_URL: { title: 'Confirmed malicious destination', detail: 'Independent security vendors have already flagged this exact URL as malicious — visiting it can trigger drive-by malware, credential theft, or fraud pages.' },
  BRAND_IMPERSONATION: { title: 'Account takeover', detail: 'Credentials entered on this page are captured by the attacker, who can then log in to your real account and lock you out.' },
  EXECUTABLE_DISGUISED_AS_DOCUMENT: { title: 'Full device compromise', detail: 'Opening this file runs attacker-controlled code on your machine, not the document viewer you expect.' },
  SMS_ACCESSIBILITY_COMBO: { title: 'Banking credential theft', detail: 'This permission combination lets an app read one-time passcodes and draw fake screens over your real banking app.' },
  DOUBLE_EXTENSION: { title: 'Silent code execution', detail: 'The file runs as a program the moment it is opened, despite looking like an ordinary document.' },
  OTP_REQUEST: { title: 'Two-factor bypass', detail: 'If you share the requested code, the attacker can complete a login or transaction that 2FA was supposed to block.' },
  CREDENTIAL_REQUEST: { title: 'Direct credential theft', detail: 'Any password, PIN or CVV you send goes straight to the person who wrote this message.' },
  URL_SHORTENER: { title: 'Hidden final destination', detail: 'The real destination is concealed until you click — it could point anywhere, including a lookalike or malicious page.' },
  DEVICE_ADMIN_PERMISSION: { title: 'Device lockout / ransom', detail: 'Device admin access lets an app prevent its own removal and can be used to lock the device entirely.' },
  OVERLAY_PERMISSION: { title: 'Overlay / tapjacking attack', detail: 'This permission can be used to draw invisible or fake UI on top of other apps to steal taps and inputs.' },
  MISSING_SIGNATURE: { title: 'Tampered or unverified app', detail: 'Without a valid signature, there is no way to confirm this APK came from its claimed developer or was not modified.' },
}

const ATTACK_STORY = {
  BRAND_IMPERSONATION: [
    { title: 'The lure', detail: 'A message or ad drives you to a page that looks like a brand you trust.' },
    { title: 'The trap', detail: 'The page is a pixel-close copy, so you enter credentials without a second thought.' },
    { title: 'The capture', detail: 'Your input is submitted to attacker-controlled infrastructure instead of the real service.' },
    { title: 'The payoff', detail: 'The attacker signs in as you, often changing recovery details to lock you out.' },
  ],
  SMS_ACCESSIBILITY_COMBO: [
    { title: 'The bait', detail: 'An unofficial app promises extra features unavailable in the real one.' },
    { title: 'The install', detail: 'Installed outside an official store, it requests SMS and Accessibility access "for notifications".' },
    { title: 'The foothold', detail: 'Those permissions let it read incoming codes and overlay fake screens on real apps.' },
    { title: 'The exploit', detail: 'During your next banking session, it silently intercepts the one-time passcode.' },
  ],
  EXECUTABLE_DISGUISED_AS_DOCUMENT: [
    { title: 'The email', detail: 'The file arrives looking like a routine document from a plausible sender.' },
    { title: 'The disguise', detail: 'A double or hidden extension makes it appear as a harmless file type.' },
    { title: 'The execution', detail: 'Opening it runs the real payload instead of any document viewer.' },
  ],
  OTP_REQUEST: [
    { title: 'The setup', detail: 'A message claims a code was sent "by mistake" or is needed to "verify" something.' },
    { title: 'The ask', detail: 'You are pressured to read the code back or forward it.' },
    { title: 'The bypass', detail: 'The attacker uses that code to complete their own login or transaction in real time.' },
  ],
}

const DEFENSE = {
  VT_MALICIOUS_URL: { action: 'Do not visit this link', detail: 'Close the tab or delete the message. Independent scanners already confirm this is malicious.' },
  BRAND_IMPERSONATION: { action: 'Never enter credentials on this page', detail: 'Navigate to the real service directly by typing its known address instead of following the link.' },
  EXECUTABLE_DISGUISED_AS_DOCUMENT: { action: 'Do not open this file', detail: 'Delete it. If it was already opened, disconnect from the network and run a full antivirus scan.' },
  SMS_ACCESSIBILITY_COMBO: { action: 'Uninstall this app immediately', detail: 'Then check Settings > Apps for anything else with unexplained SMS or Accessibility access.' },
  OTP_REQUEST: { action: 'Never share a one-time code', detail: 'No legitimate service ever asks you to read back or forward a verification code.' },
  CREDENTIAL_REQUEST: { action: 'Do not reply with any credentials', detail: 'Legitimate organizations never ask for your password, PIN or CVV over SMS or chat.' },
  URL_SHORTENER: { action: 'Expand the link before clicking', detail: 'Use a link-expander tool, or better, avoid clicking shortened links from unsolicited messages.' },
  MISSING_SIGNATURE: { action: 'Only install signed apps from official stores', detail: 'Uninstall this APK and get the app from the Play Store or App Store instead.' },
  DEVICE_ADMIN_PERMISSION: { action: 'Revoke device admin access', detail: 'Go to Settings > Security > Device admin apps and disable it before uninstalling.' },
}

const GENERIC_BY_RISK = {
  safe: {
    whatCouldHappen: [{ title: 'No significant risk identified', detail: 'Guardian found nothing in its checks that indicates harm.' }],
    attackStory: [],
    defense: [{ action: 'No action needed', detail: 'Safe to proceed based on the checks Guardian ran.' }],
  },
  low: {
    whatCouldHappen: [{ title: 'Low-probability risk', detail: 'Minor signals were present but nothing conclusive was found.' }],
    attackStory: [],
    defense: [{ action: 'Proceed with normal caution', detail: 'Nothing here requires immediate action, but stay alert for follow-up requests.' }],
  },
  medium: {
    whatCouldHappen: [{ title: 'Plausible but unconfirmed risk', detail: 'Several signals together suggest this deserves a closer look before you act on it.' }],
    attackStory: [],
    defense: [{ action: 'Verify through an independent channel', detail: 'Confirm the sender or destination through a known, trusted channel before proceeding.' }],
  },
  high: {
    whatCouldHappen: [{ title: 'Real, demonstrable risk', detail: 'Multiple strong signals point to this being unsafe to interact with as-is.' }],
    attackStory: [],
    defense: [{ action: 'Avoid interacting further', detail: 'Do not click, open, install, or reply until you have verified this independently.' }],
  },
  critical: {
    whatCouldHappen: [{ title: 'Severe, high-confidence risk', detail: 'The strongest signals Guardian tracks were found here — treat this as actively dangerous.' }],
    attackStory: [],
    defense: [{ action: 'Stop and do not proceed', detail: 'Close/delete this immediately. If you already interacted with it, change any exposed passwords now.' }],
  },
}

function collectByCode(map, findings) {
  const seen = new Set()
  const out = []
  for (const f of findings) {
    const entry = map[f.code]
    if (entry && !seen.has(f.code)) {
      seen.add(f.code)
      out.push(Array.isArray(entry) ? entry : entry)
    }
  }
  return out
}

export function buildNarrative(findings, riskLabel) {
  const whatCouldHappen = []
  const seenWch = new Set()
  for (const f of findings) {
    const entry = WHAT_COULD_HAPPEN[f.code]
    if (entry && !seenWch.has(f.code)) {
      seenWch.add(f.code)
      whatCouldHappen.push({ id: f.code, ...entry })
    }
  }

  let attackStory = []
  for (const f of findings) {
    const story = ATTACK_STORY[f.code]
    if (story) {
      attackStory = story.map((s, i) => ({ id: `${f.code}_${i}`, ...s }))
      break // one coherent story, keyed by the most narratively significant code present
    }
  }

  const defense = []
  const seenDefense = new Set()
  for (const f of findings) {
    const entry = DEFENSE[f.code]
    if (entry && !seenDefense.has(f.code)) {
      seenDefense.add(f.code)
      defense.push({ id: f.code, ...entry })
    }
  }

  const fallback = GENERIC_BY_RISK[riskLabel] ?? GENERIC_BY_RISK.medium
  return {
    whatCouldHappen: whatCouldHappen.length ? whatCouldHappen : fallback.whatCouldHappen.map((w, i) => ({ id: `generic_${i}`, ...w })),
    attackStory: attackStory.length ? attackStory : fallback.attackStory,
    defense: defense.length ? defense : fallback.defense.map((d, i) => ({ id: `generic_${i}`, ...d })),
  }
}

export function verdictHeadlineFor(riskLabel, findings) {
  const topFinding = findings
    .filter((f) => f.severity === 'critical' || f.severity === 'high')
    .sort((a, b) => (a.severity === 'critical' ? -1 : 1))[0]

  if (topFinding) return topFinding.title
  const byLabel = {
    safe: 'Looks clean — no significant risk indicators found.',
    low: 'Minor signals only — low overall risk.',
    medium: 'Some risk indicators found — worth a closer look.',
    high: 'Multiple risk indicators found — proceed with caution.',
    critical: 'Strong risk indicators found — treat this as dangerous.',
  }
  return byLabel[riskLabel] ?? byLabel.medium
}

// --- Additive Phase 3 lookups: reuse this file's existing content maps
// directly, so the agent fallback layer never duplicates narrative text. ---

export function whatCouldHappenFor(code) {
  return WHAT_COULD_HAPPEN[code] ?? null
}

export function attackStoryFor(code) {
  return ATTACK_STORY[code] ?? null
}

export function defenseFor(code) {
  return DEFENSE[code] ?? null
}

export function genericByRisk(riskLabel) {
  return GENERIC_BY_RISK[riskLabel] ?? GENERIC_BY_RISK.medium
}
