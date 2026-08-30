const SUSPICIOUS_TLDS = new Set([
  'zip', 'mov', 'top', 'xyz', 'click', 'gq', 'tk', 'cf', 'ml', 'work', 'link', 'shop', 'rest', 'country', 'stream',
])

const URL_SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'is.gd', 'buff.ly', 'ow.ly', 'goo.gl', 'rebrand.ly', 'cutt.ly', 'shorte.st',
])

const BRAND_KEYWORDS = [
  'apple', 'icloud', 'paypal', 'google', 'microsoft', 'amazon', 'netflix', 'whatsapp', 'instagram',
  'facebook', 'flipkart', 'bankofamerica', 'chase', 'wellsfargo', 'hdfc', 'icici', 'sbi', 'outlook',
]

const LOGIN_PATH_KEYWORDS = ['login', 'signin', 'verify', 'secure', 'update', 'confirm', 'account', 'reset']
const TRACKING_PARAM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid', 'msclkid', 'dclid', 'ref', 'affid']

function finding(code, category, severity, title, detail) {
  return { code, category, severity, title, detail }
}

function isIpLiteral(hostname) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':')
}

function registrableDomain(hostname) {
  const parts = hostname.split('.')
  if (parts.length <= 2) return hostname
  return parts.slice(-2).join('.')
}

/**
 * Runs a battery of deterministic structural checks against a URL.
 * Returns { findings, meta } — meta carries extracted facts used elsewhere
 * (e.g. hostname) without re-parsing.
 */
export function analyzeUrlStructure(rawUrl) {
  const findings = []
  const u = new URL(rawUrl)
  const hostname = u.hostname.toLowerCase()
  const root = registrableDomain(hostname)
  const tld = root.split('.').pop()

  if (u.protocol !== 'https:') {
    findings.push(finding('PROTOCOL_NOT_HTTPS', 'security', 'medium', 'Not served over HTTPS', `The page loads over ${u.protocol.replace(':', '')}, so any data submitted is not encrypted in transit.`))
  }

  if (isIpLiteral(hostname)) {
    findings.push(finding('IP_LITERAL_HOST', 'security', 'high', 'Raw IP address instead of a domain', `The link points directly to ${hostname} rather than a named domain — legitimate services essentially never do this for user-facing pages.`))
  }

  if (SUSPICIOUS_TLDS.has(tld)) {
    findings.push(finding('SUSPICIOUS_TLD', 'security', 'medium', `Uncommon top-level domain (.${tld})`, `The ".${tld}" TLD is disproportionately used for throwaway phishing and spam domains.`))
  }

  const subdomainCount = hostname.split('.').length - root.split('.').length
  if (subdomainCount > 3) {
    findings.push(finding('EXCESSIVE_SUBDOMAINS', 'security', 'low', 'Unusually deep subdomain chain', `The hostname has ${subdomainCount} subdomain levels, a pattern sometimes used to obscure the real destination.`))
  }

  const matchedBrand = BRAND_KEYWORDS.find((b) => hostname.includes(b))
  if (matchedBrand && !root.startsWith(matchedBrand)) {
    findings.push(finding('BRAND_IMPERSONATION', 'security', 'high', `Impersonates "${matchedBrand}"`, `The hostname references "${matchedBrand}" but the actual registrable domain is "${root}", not an official ${matchedBrand} domain — a classic phishing pattern.`))
  } else if (matchedBrand && hostname.includes('-')) {
    findings.push(finding('HYPHENATED_LOOKALIKE', 'security', 'medium', `Hyphenated brand-lookalike domain`, `"${root}" combines "${matchedBrand}" with extra hyphenated words, a common way to construct convincing fake domains.`))
  }

  if (URL_SHORTENERS.has(hostname)) {
    findings.push(finding('URL_SHORTENER', 'security', 'medium', 'Shortened link', `"${hostname}" hides the real destination until you click. Guardian cannot see past it without following the redirect.`))
  }

  const pathLower = u.pathname.toLowerCase()
  const hasLoginPath = LOGIN_PATH_KEYWORDS.some((k) => pathLower.includes(k))
  if (hasLoginPath && matchedBrand && !root.startsWith(matchedBrand)) {
    findings.push(finding('LOGIN_KEYWORDS_IN_PATH', 'security', 'high', 'Login/verification page on an unofficial domain', `The URL path suggests a login or identity-verification flow, but it is not hosted on an official ${matchedBrand} domain.`))
  }

  if (u.search.length > 150) {
    findings.push(finding('LONG_QUERY_OBFUSCATION', 'security', 'low', 'Unusually long query string', 'A very long, encoded query string can be used to hide redirect targets or tracking payloads from casual inspection.'))
  }

  const matchedTrackingParams = TRACKING_PARAM_KEYS.filter((k) => u.searchParams.has(k))
  if (matchedTrackingParams.length >= 3) {
    findings.push(finding('MULTIPLE_TRACKING_PARAMS', 'tracking', 'medium', `${matchedTrackingParams.length} tracking parameters present`, `The URL carries ${matchedTrackingParams.length} different tracking/campaign parameters (${matchedTrackingParams.join(', ')}) — more than the usual single-campaign link, suggesting heavier cross-site tracking.`))
  } else if (matchedTrackingParams.length > 0) {
    findings.push(finding('TRACKING_PARAMS_PRESENT', 'tracking', 'low', 'Marketing/tracking parameters present', `The URL carries a standard campaign-tracking parameter (${matchedTrackingParams.join(', ')}), typical of normal advertising links.`))
  } else {
    findings.push(finding('NO_TRACKING_PARAMS', 'tracking', 'info', 'No tracking parameters detected', 'The URL does not carry common marketing or click-tracking query parameters.'))
  }

  return { findings, meta: { hostname, root, tld, matchedBrand: matchedBrand ?? null } }
}
