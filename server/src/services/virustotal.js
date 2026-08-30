import env from '../config/env.js'
import { logger } from '../utils/logger.js'

const VT_BASE = 'https://www.virustotal.com/api/v3'
const REQUEST_TIMEOUT_MS = 10_000
const ANALYSIS_POLL_ATTEMPTS = 4
const ANALYSIS_POLL_DELAY_MS = 3_000

function urlToVtId(targetUrl) {
  // VirusTotal identifies URLs by the unpadded, URL-safe base64 of the URL string.
  return Buffer.from(targetUrl)
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

async function vtFetch(pathSuffix, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(`${VT_BASE}${pathSuffix}`, {
      ...options,
      headers: {
        'x-apikey': env.virustotalApiKey,
        ...options.headers,
      },
      signal: controller.signal,
    })
    return res
  } finally {
    clearTimeout(timeout)
  }
}

function statsFromAttributes(attributes) {
  const stats = attributes?.last_analysis_stats
  if (!stats) return null
  const malicious = stats.malicious ?? 0
  const suspicious = stats.suspicious ?? 0
  const harmless = stats.harmless ?? 0
  const undetected = stats.undetected ?? 0
  const timeout = stats.timeout ?? 0
  const total = malicious + suspicious + harmless + undetected + timeout
  return {
    malicious,
    suspicious,
    harmless,
    undetected,
    total,
    maliciousRatio: total > 0 ? malicious / total : 0,
    suspiciousRatio: total > 0 ? suspicious / total : 0,
    reputation: attributes.reputation ?? null,
    categories: attributes.categories ?? null,
  }
}

/**
 * Looks up a URL's reputation on VirusTotal.
 * Fast path: cached analysis (instant). Slow path: submit + short poll.
 * Always returns a well-formed object — never throws, never fakes a score.
 */
export async function lookupUrlReputation(targetUrl) {
  if (!env.virustotalEnabled) {
    return { available: false, reason: 'no_api_key' }
  }

  try {
    const id = urlToVtId(targetUrl)
    const cached = await vtFetch(`/urls/${id}`)

    if (cached.status === 200) {
      const json = await cached.json()
      const stats = statsFromAttributes(json.data.attributes)
      return { available: true, source: 'cached_analysis', stats, permalink: `https://www.virustotal.com/gui/url/${id}` }
    }

    if (cached.status !== 404) {
      logger.warn('VirusTotal cached URL lookup failed', { status: cached.status })
      return { available: false, reason: 'api_error', httpStatus: cached.status }
    }

    // Not previously analyzed — submit it, then briefly poll for a verdict.
    const submit = await vtFetch('/urls', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ url: targetUrl }).toString(),
    })

    if (submit.status !== 200) {
      logger.warn('VirusTotal URL submission failed', { status: submit.status })
      return { available: false, reason: 'submission_failed', httpStatus: submit.status }
    }

    const submitJson = await submit.json()
    const analysisId = submitJson.data.id

    for (let attempt = 0; attempt < ANALYSIS_POLL_ATTEMPTS; attempt++) {
      await new Promise((r) => setTimeout(r, ANALYSIS_POLL_DELAY_MS))
      const analysis = await vtFetch(`/analyses/${analysisId}`)
      if (analysis.status !== 200) continue
      const analysisJson = await analysis.json()
      if (analysisJson.data.attributes.status === 'completed') {
        const stats = analysisJson.data.attributes.stats
        const malicious = stats.malicious ?? 0
        const suspicious = stats.suspicious ?? 0
        const harmless = stats.harmless ?? 0
        const undetected = stats.undetected ?? 0
        const total = malicious + suspicious + harmless + undetected
        return {
          available: true,
          source: 'fresh_analysis',
          stats: {
            malicious,
            suspicious,
            harmless,
            undetected,
            total,
            maliciousRatio: total > 0 ? malicious / total : 0,
            suspiciousRatio: total > 0 ? suspicious / total : 0,
          },
          permalink: `https://www.virustotal.com/gui/url/${id}`,
        }
      }
    }

    return { available: false, reason: 'analysis_timeout' }
  } catch (err) {
    logger.warn('VirusTotal URL lookup threw', { error: err.message })
    return { available: false, reason: 'network_error' }
  }
}

/**
 * Looks up a file's reputation on VirusTotal by SHA-256 hash only —
 * never uploads file contents. If VT has never seen the hash, that is
 * reported honestly as "unknown", not treated as clean or malicious.
 */
export async function lookupFileReputation(sha256) {
  if (!env.virustotalEnabled) {
    return { available: false, reason: 'no_api_key' }
  }
  try {
    const res = await vtFetch(`/files/${sha256}`)
    if (res.status === 200) {
      const json = await res.json()
      const stats = statsFromAttributes(json.data.attributes)
      return {
        available: true,
        source: 'hash_lookup',
        stats,
        typeDescription: json.data.attributes.type_description ?? null,
        permalink: `https://www.virustotal.com/gui/file/${sha256}`,
      }
    }
    if (res.status === 404) {
      return { available: false, reason: 'unknown_hash' }
    }
    logger.warn('VirusTotal file lookup failed', { status: res.status })
    return { available: false, reason: 'api_error', httpStatus: res.status }
  } catch (err) {
    logger.warn('VirusTotal file lookup threw', { error: err.message })
    return { available: false, reason: 'network_error' }
  }
}
