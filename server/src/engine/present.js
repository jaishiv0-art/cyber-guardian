/** Findings with severity != info are risk cards. "NO_*" info findings are reassuring evidence, shown as "safe" cards. */
export function findingsToRiskCards(findings) {
  const cards = []
  for (const f of findings) {
    if (f.severity !== 'info') {
      cards.push({ id: f.code, title: f.title, severity: f.severity, detail: f.detail })
    } else if (f.code.startsWith('NO_') || f.code === 'VT_NO_DETECTIONS') {
      cards.push({ id: f.code, title: f.title, severity: 'safe', detail: f.detail })
    }
  }
  return cards
}

/** All findings (including informational ones) become WHY evidence — full transparency. */
export function findingsToWhy(findings) {
  return findings.map((f) => ({ id: f.code, claim: f.title, evidence: f.detail }))
}

export function truncate(str, max = 140) {
  if (!str) return str
  return str.length > max ? `${str.slice(0, max - 1)}…` : str
}
