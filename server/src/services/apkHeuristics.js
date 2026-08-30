import { tryReadZip, getEntryBuffer } from './zipUtils.js'
import { parseAxml, extractManifestFacts, AxmlParseError } from './axmlParser.js'

function finding(code, category, severity, title, detail) {
  return { code, category, severity, title, detail }
}

// Permission constants as they appear (as ASCII/UTF-16 substrings) inside the
// compiled binary AndroidManifest.xml. Real device permissions, not invented.
const DANGEROUS_PERMISSIONS = {
  'android.permission.SEND_SMS': { label: 'Send SMS', severity: 'high' },
  'android.permission.RECEIVE_SMS': { label: 'Receive SMS', severity: 'high' },
  'android.permission.READ_SMS': { label: 'Read SMS', severity: 'high' },
  'android.permission.BIND_ACCESSIBILITY_SERVICE': { label: 'Accessibility Service', severity: 'high' },
  'android.permission.SYSTEM_ALERT_WINDOW': { label: 'Draw over other apps', severity: 'high' },
  'android.permission.REQUEST_INSTALL_PACKAGES': { label: 'Install other apps', severity: 'medium' },
  'android.permission.READ_CONTACTS': { label: 'Read contacts', severity: 'medium' },
  'android.permission.RECORD_AUDIO': { label: 'Record audio', severity: 'medium' },
  'android.permission.CAMERA': { label: 'Camera access', severity: 'medium' },
  'android.permission.ACCESS_FINE_LOCATION': { label: 'Precise location', severity: 'medium' },
  'android.permission.READ_CALL_LOG': { label: 'Read call log', severity: 'medium' },
  'android.permission.PROCESS_OUTGOING_CALLS': { label: 'Monitor outgoing calls', severity: 'medium' },
  'android.permission.BIND_DEVICE_ADMIN': { label: 'Device admin', severity: 'high' },
}

// Known advertising/analytics SDK package-path fragments. These reliably
// appear as literal strings in a real manifest (component/provider/meta-data
// class names) or classes.dex when that SDK is actually bundled — this is
// genuine string-presence detection, not a guess.
const ADVERTISING_SDK_PATTERNS = [
  { pattern: 'com/google/android/gms/ads', label: 'Google AdMob' },
  { pattern: 'com.google.android.gms.ads', label: 'Google AdMob' },
  { pattern: 'com/facebook/ads', label: 'Meta Audience Network' },
  { pattern: 'com.facebook.ads', label: 'Meta Audience Network' },
  { pattern: 'applovin', label: 'AppLovin' },
  { pattern: 'unity3d.ads', label: 'Unity Ads' },
  { pattern: 'mopub', label: 'MoPub' },
  { pattern: 'adcolony', label: 'AdColony' },
  { pattern: 'vungle', label: 'Vungle' },
  { pattern: 'ironsource', label: 'ironSource' },
  { pattern: 'chartboost', label: 'Chartboost' },
]

const ANALYTICS_SDK_PATTERNS = [
  { pattern: 'com.google.firebase.analytics', label: 'Firebase Analytics' },
  { pattern: 'com/google/firebase/analytics', label: 'Firebase Analytics' },
  { pattern: 'com.google.android.gms.analytics', label: 'Google Analytics' },
  { pattern: 'flurry', label: 'Flurry Analytics' },
  { pattern: 'mixpanel', label: 'Mixpanel' },
  { pattern: 'amplitude', label: 'Amplitude' },
  { pattern: 'appsflyer', label: 'AppsFlyer (attribution/tracking)' },
  { pattern: 'adjust.sdk', label: 'Adjust (attribution/tracking)' },
  { pattern: 'crashlytics', label: 'Crashlytics (crash tracking)' },
]

// String-level indicators of sensitive API usage. This is a presence check
// on decompiled-adjacent strings, not confirmed call-graph analysis — the
// findings say so explicitly rather than overclaiming certainty.
const SUSPICIOUS_API_PATTERNS = [
  { pattern: 'Ljava/lang/Runtime;->exec', label: 'Runtime.exec (can run OS-level commands)' },
  { pattern: 'DexClassLoader', label: 'DexClassLoader (can load code at runtime)' },
  { pattern: 'sendTextMessage', label: 'SmsManager.sendTextMessage (can send SMS)' },
  { pattern: 'getInstalledPackages', label: 'PackageManager.getInstalledPackages (can list other installed apps)' },
  { pattern: 'setAdminActive', label: 'DevicePolicyManager admin activation' },
]

// Rough, best-effort app-purpose inference from the package name alone —
// no app-store metadata is fetched. Used only to contextualize permissions,
// never to change the risk score.
const CATEGORY_KEYWORDS = {
  navigation: ['maps', 'navigat', 'gps', 'compass', 'transit'],
  utility: ['calculator', 'flashlight', 'torch', 'toolbox', 'cleaner', 'battery'],
  messaging: ['message', 'sms', 'chat', 'messenger'],
  finance: ['bank', 'wallet', 'pay', 'finance'],
  camera: ['camera', 'photo', 'gallery'],
  game: ['game', 'puzzle', 'arcade'],
  social: ['social', 'insta', 'facebook', 'friend'],
}

function guessAppCategory(packageName) {
  if (!packageName) return null
  const lower = packageName.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return category
  }
  return null
}

// Permissions that make obvious sense for a given inferred category — used
// to avoid flagging genuinely reasonable combinations (e.g. location in a
// navigation app), per the "contextualize permissions" requirement.
const EXPECTED_PERMISSIONS_BY_CATEGORY = {
  navigation: ['android.permission.ACCESS_FINE_LOCATION'],
  camera: ['android.permission.CAMERA'],
  messaging: ['android.permission.SEND_SMS', 'android.permission.RECEIVE_SMS', 'android.permission.READ_SMS'],
  finance: [],
  utility: [],
  game: [],
  social: ['android.permission.READ_CONTACTS', 'android.permission.CAMERA'],
}

const URL_PATTERN = /https?:\/\/[a-zA-Z0-9._~%\-/?#[\]@!$&'()*+,;=]{4,300}/g



/** Extracts printable ASCII and UTF-16LE strings from a buffer (binary AXML stores strings this way). */
function extractStrings(buffer, minLen = 6) {
  const found = new Set()

  // ASCII pass
  let asciiRun = ''
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i]
    if (byte >= 0x20 && byte <= 0x7e) {
      asciiRun += String.fromCharCode(byte)
    } else {
      if (asciiRun.length >= minLen) found.add(asciiRun)
      asciiRun = ''
    }
  }
  if (asciiRun.length >= minLen) found.add(asciiRun)

  // UTF-16LE pass (binary AXML string pools are typically UTF-16LE)
  let wideRun = ''
  for (let i = 0; i + 1 < buffer.length; i += 2) {
    const lo = buffer[i]
    const hi = buffer[i + 1]
    if (hi === 0x00 && lo >= 0x20 && lo <= 0x7e) {
      wideRun += String.fromCharCode(lo)
    } else {
      if (wideRun.length >= minLen) found.add(wideRun)
      wideRun = ''
    }
  }
  if (wideRun.length >= minLen) found.add(wideRun)

  return found
}

function guessPackageName(strings) {
  for (const s of strings) {
    if (/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/i.test(s) && !s.startsWith('android.') && !s.startsWith('java.')) {
      return s
    }
  }
  return null
}

export async function analyzeApk({ buffer, originalName }) {
  const findings = []
  const zipResult = tryReadZip(buffer)

  if (!zipResult) {
    findings.push(
      finding('INVALID_APK_STRUCTURE', 'security', 'critical', 'Not a valid APK archive', `"${originalName}" could not be read as a zip/APK container at all — it may be corrupted, truncated, or not actually an APK.`)
    )
    findings.push(finding('PRIVACY_NOT_APPLICABLE', 'privacy', 'info', 'Manifest not readable', 'Permission analysis requires a readable manifest, which was not available.'))
    findings.push(finding('TRACKING_NOT_APPLICABLE', 'tracking', 'info', 'Manifest not readable', 'Tracking-relevant permissions could not be checked.'))
    return { findings, meta: { valid: false } }
  }

  const { entries, zip } = zipResult
  const entryNames = entries.map((e) => e.name)

  const hasClassesDex = entryNames.some((n) => n === 'classes.dex' || n.startsWith('classes'))
  if (!hasClassesDex) {
    findings.push(
      finding('INVALID_APK_STRUCTURE', 'security', 'high', 'Missing classes.dex', 'A valid APK should contain compiled application code (classes.dex). This one does not, which is unusual for a genuine app.')
    )
  }

  const hasSignatureFiles = entryNames.some((n) => /^META-INF\/.*\.(RSA|DSA|EC)$/i.test(n))
  if (!hasSignatureFiles) {
    findings.push(
      finding('MISSING_SIGNATURE', 'security', 'high', 'No signing certificate found', 'No META-INF signing files (.RSA/.DSA/.EC) were found in the archive, so there is no way to verify who built this APK.')
    )
  }

  const manifestBuffer = getEntryBuffer(zip, 'AndroidManifest.xml')
  const detectedPermissions = []
  let packageName = null
  let manifestFacts = null

  if (!manifestBuffer) {
    findings.push(
      finding('MANIFEST_NOT_FOUND', 'security', 'medium', 'AndroidManifest.xml not found', 'Permission analysis could not run because the manifest entry was missing from the archive.')
    )
  } else {
    // The structured binary-XML parse is the source of truth when it
    // succeeds — real attribute values, not substring guesses. Raw string
    // extraction is kept only as a fallback for permission names, so a
    // manifest that fails to parse cleanly doesn't lose detection entirely.
    try {
      manifestFacts = extractManifestFacts(parseAxml(manifestBuffer))
      packageName = manifestFacts.packageName
    } catch (err) {
      const reason = err instanceof AxmlParseError ? err.message : `unexpected error (${err.message})`
      findings.push(
        finding(
          'MANIFEST_PARSE_FAILED',
          'security',
          'medium',
          'Manifest could not be structurally parsed',
          `AndroidManifest.xml did not parse as standard binary XML: ${reason}. This can happen with a genuinely corrupted file or unusual build tooling — but a manifest deliberately malformed just enough to break analysis tools, while still installing fine on lenient Android versions, is also a known evasion trick. Guardian fell back to raw string scanning for permissions below, which is less reliable.`
        )
      )
    }

    const strings = extractStrings(manifestBuffer)
    if (!packageName) packageName = guessPackageName(strings)

    if (manifestFacts) {
      for (const [perm, info] of Object.entries(DANGEROUS_PERMISSIONS)) {
        if (manifestFacts.permissions.includes(perm)) detectedPermissions.push({ permission: perm, ...info })
      }
    } else {
      for (const [perm, info] of Object.entries(DANGEROUS_PERMISSIONS)) {
        if (strings.has(perm)) detectedPermissions.push({ permission: perm, ...info })
      }
    }

    if (detectedPermissions.length > 0) {
      findings.push(
        finding(
          'PERMISSIONS_DETECTED',
          'privacy',
          'info',
          `${detectedPermissions.length} sensitive permission${detectedPermissions.length === 1 ? '' : 's'} requested`,
          detectedPermissions.map((p) => p.label).join(', ')
        )
      )
    }

    const hasSms = detectedPermissions.some((p) => /SMS/.test(p.permission))
    const hasAccessibility = detectedPermissions.some((p) => p.permission.includes('ACCESSIBILITY'))
    if (hasSms && hasAccessibility) {
      findings.push(
        finding(
          'SMS_ACCESSIBILITY_COMBO',
          'security',
          'critical',
          'SMS + Accessibility permission combination',
          'This combination — reading SMS plus Accessibility Service access — is characteristic of banking-trojan malware families: it can intercept OTP codes and overlay fake UI on top of real apps.'
        )
      )
    }

    if (detectedPermissions.some((p) => p.permission.includes('REQUEST_INSTALL_PACKAGES'))) {
      findings.push(
        finding('SIDELOAD_INSTALLER_PERMISSION', 'security', 'medium', 'Can install other apps', 'This app can trigger installation of additional APKs, which can be used to chain further malware onto the device.')
      )
    }

    if (detectedPermissions.some((p) => p.permission.includes('BIND_DEVICE_ADMIN'))) {
      findings.push(
        finding('DEVICE_ADMIN_PERMISSION', 'security', 'high', 'Requests device admin rights', 'Device admin access can be used to resist uninstallation and, in the worst case, remotely lock the device.')
      )
    }

    if (detectedPermissions.some((p) => p.permission.includes('SYSTEM_ALERT_WINDOW'))) {
      findings.push(
        finding('OVERLAY_PERMISSION', 'security', 'high', 'Can draw over other apps', 'This permission is frequently abused for tapjacking and fake-login overlay attacks on top of legitimate apps.')
      )
    }

    // --- Checks that require the real parsed manifest, not string-guessing ---
    // These read actual attribute values (booleans, exported flags,
    // intent-filter presence), which raw substring extraction cannot
    // reliably distinguish from unrelated text elsewhere in the file.
    if (manifestFacts) {
      if (manifestFacts.application.debuggable === true) {
        findings.push(
          finding(
            'DEBUGGABLE_BUILD',
            'security',
            'high',
            'App is marked debuggable',
            'android:debuggable is set to true. A production app should never ship this way — it lets anyone with device access attach a debugger and inspect or manipulate the running app, and is also a common side-effect of a repackaged/tampered build.'
          )
        )
      }

      if (manifestFacts.application.usesCleartextTraffic === true) {
        findings.push(
          finding(
            'CLEARTEXT_TRAFFIC_ALLOWED',
            'security',
            'medium',
            'Unencrypted network traffic is explicitly allowed',
            'android:usesCleartextTraffic is set to true, permitting plain HTTP instead of requiring HTTPS. Modern Android defaults this to false — an explicit true is a deliberate weakening of network security, not an oversight.'
          )
        )
      }

      if (typeof manifestFacts.targetSdkVersion === 'number' && manifestFacts.targetSdkVersion > 0 && manifestFacts.targetSdkVersion < 26) {
        findings.push(
          finding(
            'TARGET_SDK_OUTDATED',
            'security',
            'medium',
            `Targets an old Android API level (${manifestFacts.targetSdkVersion})`,
            'A low targetSdkVersion often just means the app hasn\u2019t been updated — but it can also be a deliberate choice to retain older, more permissive OS behavior that modern Android would otherwise restrict (e.g. broader implicit-broadcast or background-access rules).'
          )
        )
      }

      // Exported activities are common and usually intentional (launcher
      // icons, deep links), so they're not flagged here. Exported
      // services/receivers/providers with no permission guard are a
      // different story — any other app on the device can invoke or query
      // them with nothing stopping it. Well-established misconfiguration
      // class (the same one MobSF/Android Lint flag), phrased as a
      // "worth reviewing" signal rather than a confirmed exploit, since
      // exploitability still depends on what the component does internally.
      const exposedComponents = manifestFacts.components.filter(
        (c) => ['service', 'receiver', 'provider'].includes(c.type) && c.exported && !c.permission
      )
      if (exposedComponents.length > 0) {
        findings.push(
          finding(
            'EXPORTED_COMPONENT_NO_PERMISSION',
            'security',
            'medium',
            `${exposedComponents.length} exported component${exposedComponents.length === 1 ? '' : 's'} without a permission check`,
            `${exposedComponents
              .slice(0, 4)
              .map((c) => `${c.type} ${c.name ?? '(unnamed)'}`)
              .join(', ')}${exposedComponents.length > 4 ? ', …' : ''} — reachable by any other app on the device with no permission required. Worth reviewing; not every instance is actually exploitable, it depends on how the component handles unvalidated input.`
          )
        )
      }
    }

    // --- Contextualize permissions against the app's apparent purpose ---
    // Best-effort only: category is guessed from the package name, since no
    // app-store metadata is fetched. This never changes the risk score —
    // it only adds an explanatory finding either way.
    const appCategory = guessAppCategory(packageName)
    if (appCategory) {
      const expected = EXPECTED_PERMISSIONS_BY_CATEGORY[appCategory] ?? []
      const reasonable = detectedPermissions.filter((p) => expected.includes(p.permission))
      const unexpected = detectedPermissions.filter((p) => !expected.includes(p.permission) && (p.severity === 'high'))

      if (reasonable.length > 0) {
        findings.push(
          finding(
            'PERMISSION_CONTEXT_REASONABLE',
            'privacy',
            'info',
            'Permissions match the app\u2019s apparent purpose',
            `Based on the package name, this looks like a ${appCategory} app. Its request for ${reasonable.map((p) => p.label.toLowerCase()).join(', ')} is consistent with that kind of app.`
          )
        )
      }
      if (unexpected.length > 0) {
        findings.push(
          finding(
            'PERMISSION_CONTEXT_MISMATCH',
            'security',
            'medium',
            'Permissions look unusual for this kind of app',
            `Based on the package name, this looks like a ${appCategory} app, but it also requests ${unexpected.map((p) => p.label.toLowerCase()).join(', ')} — access that isn't obviously related to what the app appears to do. This is a best-effort inference from the package name, not a confirmed mismatch.`
          )
        )
      }
    }

    // --- Embedded URLs, ad/analytics SDK indicators, suspicious API strings ---
    // Scan the manifest strings plus (capped) classes.dex strings, since SDK
    // component names and sensitive API references can appear in either.
    const dexBuffer = getEntryBuffer(zip, 'classes.dex')
    const dexStrings = dexBuffer ? extractStrings(dexBuffer.subarray(0, Math.min(dexBuffer.length, 3_000_000)), 8) : new Set()
    const combinedStrings = new Set([...strings, ...dexStrings])

    const embeddedUrls = new Set()
    for (const s of combinedStrings) {
      const matches = s.match(URL_PATTERN)
      if (matches) for (const m of matches) embeddedUrls.add(m.replace(/[.,)"'\]]+$/, ''))
    }
    if (embeddedUrls.size > 0) {
      findings.push(
        finding(
          'EMBEDDED_URLS_FOUND',
          'security',
          'low',
          `${embeddedUrls.size} embedded URL${embeddedUrls.size === 1 ? '' : 's'} found`,
          `Found ${embeddedUrls.size} URL${embeddedUrls.size === 1 ? '' : 's'} referenced inside the app: ${[...embeddedUrls].slice(0, 3).join(', ')}${embeddedUrls.size > 3 ? ', …' : ''}.`
        )
      )
    }

    const combinedLower = [...combinedStrings].join('\n').toLowerCase()
    const adSdks = ADVERTISING_SDK_PATTERNS.filter((p) => combinedLower.includes(p.pattern.toLowerCase()))
    const uniqueAdSdks = [...new Map(adSdks.map((s) => [s.label, s])).values()]
    if (uniqueAdSdks.length > 0) {
      findings.push(
        finding(
          'ADVERTISING_SDK_DETECTED',
          'tracking',
          'low',
          `${uniqueAdSdks.length} advertising SDK${uniqueAdSdks.length === 1 ? '' : 's'} detected`,
          `Bundles: ${uniqueAdSdks.map((s) => s.label).join(', ')}. Normal for ad-supported free apps.`
        )
      )
    }

    const analyticsSdks = ANALYTICS_SDK_PATTERNS.filter((p) => combinedLower.includes(p.pattern.toLowerCase()))
    const uniqueAnalyticsSdks = [...new Map(analyticsSdks.map((s) => [s.label, s])).values()]
    if (uniqueAnalyticsSdks.length > 0) {
      findings.push(
        finding(
          'ANALYTICS_SDK_DETECTED',
          'tracking',
          'low',
          `${uniqueAnalyticsSdks.length} analytics/tracking SDK${uniqueAnalyticsSdks.length === 1 ? '' : 's'} detected`,
          `Bundles: ${uniqueAnalyticsSdks.map((s) => s.label).join(', ')}. Common for usage analytics and crash reporting.`
        )
      )
    }

    if (uniqueAdSdks.length === 0 && uniqueAnalyticsSdks.length === 0) {
      findings.push(finding('NO_TRACKING_SDKS_DETECTED', 'tracking', 'info', 'No known advertising/analytics SDKs detected', 'String-level scanning found no recognizable ad or analytics SDK identifiers in the manifest or app code.'))
    }

    const suspiciousApis = SUSPICIOUS_API_PATTERNS.filter((p) => combinedStrings.has(p.pattern) || [...combinedStrings].some((s) => s.includes(p.pattern)))
    if (suspiciousApis.length > 0) {
      findings.push(
        finding(
          'SUSPICIOUS_API_STRINGS',
          'security',
          'medium',
          `${suspiciousApis.length} sensitive API reference${suspiciousApis.length === 1 ? '' : 's'} found`,
          `String-level scan found references to: ${suspiciousApis.map((s) => s.label).join('; ')}. This shows the capability is present in the code, not that it is confirmed to run — a full call-graph analysis would be needed to confirm actual usage.`
        )
      )
    }
  }

  if (findings.filter((f) => f.category === 'security' && f.severity !== 'info').length === 0) {
    findings.push(finding('NO_STRUCTURAL_ANOMALIES', 'security', 'info', 'No structural anomalies found', 'Zip structure, manifest and code entries look consistent with a normally-built APK.'))
  }

  if (!manifestBuffer) {
    findings.push(finding('TRACKING_NOT_APPLICABLE', 'tracking', 'info', 'No network tracking analysis performed', 'Static analysis could not run because the manifest was unavailable.'))
  }

  return {
    findings,
    meta: {
      valid: true,
      packageName,
      appCategory: guessAppCategory(packageName),
      entryCount: entries.length,
      hasSignatureFiles,
      detectedPermissions: detectedPermissions.map((p) => p.permission),
      manifestParsed: Boolean(manifestFacts),
      versionName: manifestFacts?.versionName ?? null,
      versionCode: manifestFacts?.versionCode ?? null,
      minSdkVersion: manifestFacts?.minSdkVersion ?? null,
      targetSdkVersion: manifestFacts?.targetSdkVersion ?? null,
    },
  }
}
