import env from '../config/env.js'
import { logger } from '../utils/logger.js'

/**
 * Client for a self-hosted MobSF (Mobile Security Framework) instance.
 * Unlike every other reputation source in this project, MobSF isn't a
 * hash lookup — it actually decompiles and inspects the APK's real
 * content, so it isn't defeated by a rebuild/resign that changes the
 * file's hash. This is what closes the "unknown APK" gap that VT,
 * MalwareBazaar, and Koodous all share.
 *
 * Entirely opt-in: requires the user to run their own MobSF instance
 * (`docker run -p 8000:8000 opensecurity/mobsf`) and set MOBSF_URL +
 * MOBSF_API_KEY. With those unset, this always returns
 * `{ available: false, reason: 'not_configured' }` and APK analysis
 * behaves exactly as it did before this file existed.
 *
 * IMPORTANT — verify against your instance: MobSF's upload/scan/delete
 * endpoints and auth header have been stable for years, but the exact
 * JSON field names inside the /scorecard response have shifted across
 * MobSF versions. Parsing below is intentionally defensive (it tries
 * several plausible shapes) rather than assuming one exact schema. If it
 * comes back empty against a real instance, send a real /scorecard
 * response for this file so the parsing can be tightened to match your
 * exact version.
 */

const SEVERITY_MAP = { high: 'critical', warning: 'medium', info: 'info', secure: 'info', hotspot: 'medium' }

function authHeaders() {
  // Different MobSF versions have used different header names for the
  // same API key over time — sending both is harmless and maximizes the
  // chance of working against whatever version is actually running.
  return { Authorization: env.mobsfApiKey, 'X-Mobsf-Api-Key': env.mobsfApiKey }
}

async function withTimeout(fn) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), env.mobsfTimeoutMs)
  try {
    return await fn(controller.signal)
  } finally {
    clearTimeout(timer)
  }
}

/** Pulls a severity-bucketed finding list out of a scorecard JSON body, tolerating a few different shapes across MobSF versions. */
function extractSeverityBuckets(scorecard) {
  const root = scorecard.appsec_scorecard ?? scorecard.scorecard ?? scorecard
  const buckets = {}
  for (const key of Object.keys(SEVERITY_MAP)) {
    const raw = root?.[key]
    if (raw == null) continue
    if (Array.isArray(raw)) {
      buckets[key] = raw.map((item) => (typeof item === 'string' ? item : item?.title ?? item?.description ?? JSON.stringify(item))).filter(Boolean)
    } else if (typeof raw === 'number' && raw > 0) {
      buckets[key] = [`${raw} ${key}-severity finding${raw === 1 ? '' : 's'} (MobSF scorecard did not include item-level detail in this response shape)`]
    }
  }
  return buckets
}

export async function analyzeWithMobsf(buffer, filename) {
  if (!env.mobsfEnabled) {
    return { available: false, reason: 'not_configured' }
  }

  let uploaded
  try {
    uploaded = await withTimeout(async (signal) => {
      const form = new FormData()
      form.append('file', new Blob([buffer]), filename)
      const res = await fetch(`${env.mobsfUrl}/api/v1/upload`, { method: 'POST', headers: authHeaders(), body: form, signal })
      if (!res.ok) throw new Error(`upload http ${res.status}`)
      return res.json()
    })
  } catch (err) {
    logger.warn('MobSF upload failed', { error: err.message })
    return { available: false, reason: 'upload_failed', detail: err.message }
  }

  const hash = uploaded?.hash
  if (!hash) {
    return { available: false, reason: 'upload_response_invalid' }
  }

  // Trigger the actual static analysis. This can legitimately take from
  // seconds to a few minutes depending on APK size — MOBSF_TIMEOUT_MS
  // controls how long Guardian waits before giving up (default 3 min).
  try {
    await withTimeout(async (signal) => {
      const res = await fetch(`${env.mobsfUrl}/api/v1/scan`, {
        method: 'POST',
        headers: { ...authHeaders(), 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ scan_type: uploaded.scan_type ?? 'apk', file_name: uploaded.file_name ?? filename, hash }).toString(),
        signal,
      })
      if (!res.ok) throw new Error(`scan http ${res.status}`)
    })
  } catch (err) {
    // Don't give up here — some MobSF setups auto-analyze on upload, or a
    // prior scan of this exact hash may already be cached. The scorecard
    // fetch below is the real source of truth either way.
    logger.warn('MobSF scan trigger failed, attempting scorecard anyway', { error: err.message })
  }

  let scorecard
  try {
    scorecard = await withTimeout(async (signal) => {
      const res = await fetch(`${env.mobsfUrl}/api/v1/scorecard`, {
        method: 'POST',
        headers: { ...authHeaders(), 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ hash }).toString(),
        signal,
      })
      if (!res.ok) throw new Error(`scorecard http ${res.status}`)
      return res.json()
    })
  } catch (err) {
    logger.warn('MobSF scorecard fetch failed', { error: err.message })
    return { available: false, reason: 'scorecard_failed', detail: err.message, hash }
  }

  // Best-effort cleanup — don't retain the uploaded APK on the MobSF side
  // longer than needed, matching this project's minimal-retention stance
  // for every other external service. Never allowed to fail the request.
  withTimeout(async (signal) => {
    await fetch(`${env.mobsfUrl}/api/v1/delete_scan`, {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ hash }).toString(),
      signal,
    })
  }).catch((err) => logger.warn('MobSF delete_scan cleanup failed (non-fatal)', { error: err.message }))

  const buckets = extractSeverityBuckets(scorecard)
  const securityScore = typeof scorecard.security_score === 'number' ? scorecard.security_score : (scorecard.appsec_scorecard?.security_score ?? null)
  const totalTrackers = scorecard.total_trackers ?? scorecard.appsec_scorecard?.total_trackers ?? null

  return {
    available: true,
    hash,
    securityScore,
    totalTrackers,
    buckets, // { high: [...], warning: [...], info: [...], secure: [...], hotspot: [...] }
    // MobSF's static report web view is conventionally served at this
    // path — verify against your instance, this can vary by version/config.
    permalink: `${env.mobsfUrl}/static_analyzer/${hash}`,
  }
}

export { SEVERITY_MAP }
