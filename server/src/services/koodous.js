import env from '../config/env.js'
import { logger } from '../utils/logger.js'

const KOODOUS_BASE = 'https://developer.koodous.com'
const REQUEST_TIMEOUT_MS = 10_000

/**
 * Looks up an APK's SHA-256 on Koodous — a platform focused specifically
 * on Android malware, combining static/dynamic analysis with community
 * voting. `is_detected` is Koodous's own verdict flag; a strongly negative
 * `rating` is the community-consensus "this is malware" signal per
 * Koodous's own docs. Hash lookup only — the APK's contents are never
 * uploaded. Never throws, never fabricates a verdict.
 *
 * Free-tier Koodous accounts are rate-limited (a few requests/minute), so
 * `api_error` here can mean "rate limited" as often as it means an actual
 * problem — that's reported honestly via httpStatus rather than guessed at.
 */
export async function lookupKoodousReputation(sha256) {
  if (!env.koodousEnabled) {
    return { available: false, reason: 'no_api_key' }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(`${KOODOUS_BASE}/apks/${sha256}/`, {
      headers: { Authorization: `Token ${env.koodousApiKey}` },
      signal: controller.signal,
    })

    if (res.status === 404) {
      return { available: false, reason: 'unknown_hash' }
    }

    if (res.status !== 200) {
      logger.warn('Koodous lookup failed', { status: res.status })
      return { available: false, reason: 'api_error', httpStatus: res.status }
    }

    const json = await res.json()
    return {
      available: true,
      isDetected: Boolean(json.is_detected),
      isTrusted: Boolean(json.is_trusted),
      isCorrupted: Boolean(json.is_corrupted),
      rating: typeof json.rating === 'number' ? json.rating : 0,
      tags: Array.isArray(json.tags) ? json.tags : [],
      appName: json.app ?? null,
      packageName: json.package_name ?? null,
      permalink: `https://developer.koodous.com/apks/${sha256}/`,
    }
  } catch (err) {
    logger.warn('Koodous lookup threw', { error: err.message })
    return { available: false, reason: 'network_error' }
  } finally {
    clearTimeout(timeout)
  }
}
