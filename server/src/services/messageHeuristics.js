import { analyzeUrlStructure } from './urlHeuristics.js'

function finding(code, category, severity, title, detail) {
  return { code, category, severity, title, detail }
}

const URGENCY_PATTERNS = /\b(urgent|immediately|act now|right away|expires?|24 hours|final notice|last chance|limited time|suspended|locked|will be closed)\b/i
const PAYMENT_PATTERNS = /(?:[$₹€£]\s?\d+|\d+\s?(?:usd|inr|eur|gbp))|\b(pay|fee|fine|refund|release|customs|toll)\b/i
const OTP_PATTERNS = /\b(otp|one[- ]?time password|verification code|security code)\b/i
const OTP_SHARE_PATTERNS = /\b(share|send|reply with|enter|provide)\b.{0,20}\b(otp|code|pin)\b/i
const CREDENTIAL_PATTERNS = /\b(password|pin\b|cvv|card number|ssn|aadhaar|bank details)\b/i
const FAMILY_IMPERSONATION_PATTERNS = /\b(new number|lost my phone|dropped my phone|this is (mom|dad|mum)|it's me)\b/i
const PERSONAL_DATA_PATTERNS = /\b(date of birth|home address|id number|passport number|account number)\b/i
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/gi

export async function analyzeMessageText(message) {
  const findings = []

  if (URGENCY_PATTERNS.test(message)) {
    findings.push(finding('URGENCY_LANGUAGE', 'security', 'medium', 'Urgency / pressure language', 'The message uses time-pressure phrasing designed to make you act before thinking it through.'))
  }

  if (PAYMENT_PATTERNS.test(message)) {
    findings.push(finding('PAYMENT_REQUEST', 'security', 'medium', 'Payment or fee request', 'The message asks for a payment, fee, or fine — a common lure in delivery and customs scams.'))
  }

  if (OTP_PATTERNS.test(message) && OTP_SHARE_PATTERNS.test(message)) {
    findings.push(finding('OTP_REQUEST', 'security', 'high', 'Asks you to share a one-time code', 'No legitimate service asks you to read back or forward a one-time passcode — this is a strong two-factor-bypass signal.'))
  } else if (OTP_PATTERNS.test(message)) {
    findings.push(finding('OTP_MENTIONED', 'security', 'low', 'Mentions a verification code', 'The message references an OTP or verification code without explicitly asking you to share it.'))
  }

  if (CREDENTIAL_PATTERNS.test(message)) {
    findings.push(finding('CREDENTIAL_REQUEST', 'security', 'high', 'Requests sensitive credentials', 'The message asks for a password, PIN, CVV or similar — information no legitimate sender needs over chat or SMS.'))
  }

  if (FAMILY_IMPERSONATION_PATTERNS.test(message)) {
    findings.push(finding('FAMILY_IMPERSONATION_OPENER', 'security', 'medium', 'Family-impersonation opener', 'This phrasing matches a common scam opener that impersonates a family member from an unfamiliar number.'))
  }

  if (PERSONAL_DATA_PATTERNS.test(message)) {
    findings.push(finding('PERSONAL_DATA_REQUEST', 'privacy', 'medium', 'Requests personal identifying information', 'The message asks for personal data that legitimate organizations rarely request over chat or SMS.'))
  }

  // Tracking is structurally not applicable to raw text — note it honestly rather than omitting the category.
  findings.push(finding('TRACKING_NOT_APPLICABLE', 'tracking', 'info', 'No tracking mechanism applies', 'Plain text messages carry no trackers themselves; tracking risk here reflects any links analyzed below.'))

  const urls = [...new Set(message.match(URL_PATTERN) ?? [])].slice(0, 3)
  const linkedUrlResults = []
  for (const link of urls) {
    try {
      const { findings: urlFindings, meta } = analyzeUrlStructure(link)
      linkedUrlResults.push({ url: link, findings: urlFindings, meta })
      const relevant = urlFindings.filter((f) => f.severity !== 'info')
      if (relevant.length > 0) {
        findings.push(
          finding(
            'SUSPICIOUS_LINK_IN_MESSAGE',
            'security',
            relevant.some((f) => f.severity === 'high' || f.severity === 'critical') ? 'high' : 'medium',
            'Contains a suspicious link',
            `The embedded link (${link}) triggered ${relevant.length} separate warning${relevant.length === 1 ? '' : 's'} on its own.`
          )
        )
      }
    } catch {
      // Not a parseable URL — ignore.
    }
  }

  return { findings, meta: { linkedUrlResults, extractedUrls: urls } }
}
