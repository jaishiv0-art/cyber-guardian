# Guardian — Project State (after Phase 3)

This is the living reference for what Guardian actually is right now. It is
updated at the end of each phase rather than replaced.

## 1. Architecture (current)

```
Frontend (React + Vite, plain CSS)
   |  POST /api/analyze/{url,file,apk,message}
   |  GET  /api/investigation/:id
   |  GET  /api/history
   v
Express backend (server/)
   |
   |- validate (Zod) -> rate limit -> upload (multer, MIME/size-guarded)
   |
   |- Type-specific ANALYZER (unchanged home, extended content):
   |    urlHeuristics.js / messageHeuristics.js / fileHeuristics.js / apkHeuristics.js
   |      -> structured findings: { code, category, severity, title, detail }
   |
   |- VirusTotal reputation (urls + file/APK SHA-256 hash lookup)
   |
   |- Risk Engine (riskEngine.js) -- DETERMINISTIC, unchanged since Phase 2
   |      findings -> noisy-OR per category -> weighted overall risk,
   |      scores, threatProbability, potentialImpact, confidence
   |
   |- Deterministic narrative (narrative.js) -- UNCHANGED, still populates
   |      whatCouldHappen / attackStory / defense exactly as before
   |
   |- Agent Orchestrator (agents/orchestrator.js) -- NEW, Phase 3
   |      Decides (in plain code, not AI) which of 6 explanation agents
   |      are relevant given the findings above, runs them in parallel,
   |      returns aiExplanation alongside everything else.
   |
   \- investigationStore.js (JSON-file store) -- UNCHANGED mechanism,
        now also stores personalContext + aiExplanation per record.
   v
Result record (superset of Phase 2's shape -- nothing removed)
   v
Frontend Results/History/Dashboard pages (existing components unchanged,
new panels added alongside them)
```

**The single most important invariant, preserved exactly:** the Risk Engine
runs first and completely, on its own, with no AI involvement. Its output
(`risk.overallRisk`, `risk.scores`, `risk.riskLabel`, etc.) is then handed
— read-only — to the agent layer. No agent, and no code path in the agent
layer, ever writes back into that object or recomputes it.

## 2. What Phase 3 added

### 2.1 Agent Orchestrator (`server/src/agents/orchestrator.js`)
Deterministic (plain `if` logic, not an LLM call) agent-selection based on
which findings categories actually have evidence:

| Condition (from real findings/risk) | Agents run |
|---|---|
| Always | Security Explanation, Can-I-Use-It, Defense |
| `hasRealEvidence(findings, 'privacy')` | + Privacy |
| `hasRealEvidence(findings, 'tracking')` | + Ads/Tracking |
| Any non-info finding exists | + What-Could-Happen |
| Risk label not "safe" AND a non-info finding exists | + Attack Story |

Every decision (ran or skipped, and why) is recorded and returned as
`aiExplanation.agentActivity` — this is the Agent Activity Timeline the
frontend renders.

### 2.2 The seven agents (`server/src/agents/*.js`)
- **Security Explanation Agent** — plain-language summary + per-finding reasons.
- **Can-I-Use-It Agent** — verdict (`safe_to_use` / `use_with_caution` /
  `avoid_if_possible` / `do_not_use`) is computed by `verdictForRisk()`, a
  pure function of the risk label, **in code**. The agent (AI or fallback)
  only supplies the explanation sentence; the module force-overwrites the
  `verdict` field with the deterministic value regardless of what came
  back, so it is structurally impossible for the AI to change the
  recommendation.
- **Privacy Agent** — explicitly separates `permissionExists` (a capability
  was requested/observed) from `confirmedDataCollection` (proof of actual
  transmission). The latter is always empty today, honestly, because
  static analysis cannot prove runtime data transmission — no finding
  Guardian currently produces claims that, so nothing is ever put there.
- **Ads/Tracking Agent** — classification (`none_detected` /
  `normal_advertising` / `excessive_tracking` / `suspicious_collection`) is
  computed deterministically from which specific finding codes fired
  (mirrored in both the agent and its fallback so they can never disagree),
  same "AI explains, code decides" pattern as Can-I-Use-It.
- **Attack Story Agent** — 4 fixed phases (`initial_exposure` ->
  `user_interaction` -> `possible_exploitation` -> `potential_impact`),
  grounded only in findings that already have severity != info. Skipped
  entirely (`applicable: false`) for `safe` results.
- **What-Could-Happen Agent** — every item is forced into two separate
  fields, `observed` (fact) and `possibleConsequence` (hedged, "could/may"
  language) — this is the OBSERVED vs POSSIBLE distinction the spec asked
  for, enforced structurally rather than by hoping the wording is careful.
- **Defense Recommendation Agent** — recommendations reference
  `relatedFinding` back to the triggering code; personalized in tone using
  `personalContext`, never by inventing new findings.

### 2.3 LLM client (`server/src/agents/llmClient.js`)
Real Anthropic Messages API integration (`ANTHROPIC_API_KEY` /
`ANTHROPIC_MODEL`, default `claude-haiku-4-5-20251001`). Every call:
- Receives a system prompt that hard-forbids inventing evidence, changing
  scores, or revealing chain-of-thought — response must be raw JSON only.
- Is validated against a Zod schema (`agents/schemas.js`); one corrective
  retry on invalid JSON, then falls back.
- **Always resolves, never throws** — disabled key, timeout, network
  error, or schema-invalid response all route to the same deterministic
  fallback path (`agents/fallbackTemplates.js`), which reuses the
  **existing** `narrative.js` content rather than duplicating it. An
  investigation can never fail because of the AI layer.
- Every agent result carries `source: 'ai' | 'fallback'` (+ `reason` on
  fallback) so the frontend can be transparent about which one produced
  a given explanation (see the small "AI-explained / Template-explained"
  tag on the Can-I-Use-It banner).

### 2.4 Analyzer extensions (existing files, extended in place)
- **`urlHeuristics.js`** — tracking-parameter check is now graduated
  (`TRACKING_PARAMS_PRESENT` vs `MULTIPLE_TRACKING_PARAMS`) instead of
  binary, so the Ads/Tracking agent has a real normal-vs-excessive signal
  to work with for URLs.
- **`apkHeuristics.js`** — added: embedded-URL extraction (manifest +
  capped `classes.dex` string scan), advertising SDK detection (AdMob,
  Meta Audience Network, AppLovin, Unity Ads, MoPub, AdColony, Vungle,
  ironSource, Chartboost), analytics/tracking SDK detection (Firebase/
  Google Analytics, Flurry, Mixpanel, Amplitude, AppsFlyer, Adjust,
  Crashlytics), best-effort suspicious-API string indicators
  (`Runtime.exec`, `DexClassLoader`, `sendTextMessage`,
  `getInstalledPackages`, device-admin activation), and permission
  **contextualization**: a package-name keyword guess at app category
  (navigation/utility/messaging/finance/camera/game/social) is used to
  flag `PERMISSION_CONTEXT_MISMATCH` (e.g. SMS+Accessibility in something
  that looks like a utility app) vs. `PERMISSION_CONTEXT_REASONABLE`
  (e.g. location in something that looks like a navigation app) — this is
  explicitly labeled as a best-effort inference from the package name
  only, not a confirmed classification.
- **`fileHeuristics.js`** — added: MSI/legacy-Office (OLE Compound File)
  signature detection, OOXML flavor identification (docx/xlsx/pptx via
  real zip-entry inspection, not extension guessing), lightweight
  metadata extraction (`docProps/core.xml` for OOXML, `/Info` dictionary
  scan for PDF — both return `null` rather than guessing when absent),
  embedded-URL extraction, and an honest
  `PUBLISHER_VERIFICATION_NOT_AVAILABLE` finding for executables instead
  of fabricating a publisher/signature verdict Guardian cannot actually
  confirm without full Authenticode/PE parsing.

### 2.5 Personal Risk context
New optional `personalContext` field (`banking` / `email` / `college` /
`social_media` / `personal_files` / `identity` / `general`), sent from a
new chip-style selector on the Investigation page, validated by Zod on the
backend. It flows **only** into agent prompts (Can-I-Use-It and Defense
explanations mention it where relevant) — it is never used in `riskEngine.js`
and cannot change `overallRisk`, `scores`, or the risk label.

### 2.6 Guardian Memory (unchanged mechanism, extended content)
Still the same `investigationStore.js` JSON-file store from Phase 2 — no
second database was introduced. Each record now additionally carries
`personalContext` and the full `aiExplanation` object. Message text is run
through a new `redact.js` utility before being stored: password/OTP/PIN/CVV
patterns and 13-19-digit card-number-shaped sequences are replaced with
`[redacted]` / `[redacted-number]` before the record ever reaches disk.

### 2.7 Frontend (existing components preserved, new ones added alongside)
New, additive only: `PersonalRiskSelect`, `CanUseItBanner`,
`PrivacyExplanationPanel`, `TrackingExplanationPanel`,
`AgentActivityTimeline`. Wired into the **existing** `InvestigationInput`
and `Results` pages — none of the Phase 1/2 components
(`AgentVisualization`, `InvestigationTimeline`, `RiskMeter`, `ScoreCard`,
`RiskCard`, `WhyDrawer`, `WhatCouldHappen`, `AttackStory`, `DefenseSection`,
`History`, `Settings`) were rewritten or replaced. `agentSteps` (the
progress-UI labels) gained two more entries reflecting the new agent
stages; the investigation flow itself (Input -> simulation -> backend call
-> result id -> Results page) is unchanged.

## 3. API changes

All 6 existing endpoints keep their exact paths and existing request/response
shape as a strict subset — everything below is additive.

- `POST /api/analyze/url` — body gains optional `personalContext`.
- `POST /api/analyze/message` — body gains optional `personalContext`.
- `POST /api/analyze/file`, `POST /api/analyze/apk` — multipart form gains
  optional `personalContext` text field alongside the existing `file` field.
- All 4 analyze responses, and `GET /api/investigation/:id`, gain:
  - `personalContext` (echoed back)
  - `aiExplanation: { security, canUseIt, privacy, tracking, whatCouldHappen, attackStory, defense, agentActivity }`
- `GET /api/history` — unchanged.

## 4. New environment variables

```
ANTHROPIC_API_KEY=            # get one at https://console.anthropic.com/settings/keys
ANTHROPIC_MODEL=claude-haiku-4-5-20251001
AGENT_TIMEOUT_MS=20000
```
Leave `ANTHROPIC_API_KEY` blank to run entirely on deterministic fallback
templates — every endpoint still fully functions, every field is still
populated, just without natural-language AI phrasing.

## 5. Testing performed

**Honest disclosure of method:** this sandbox has no outbound network
access, so `npm install` cannot run here and neither the Express server nor
live calls to VirusTotal/Anthropic could actually be executed end-to-end
by me. What I did do, exhaustively:

- Syntax-checked all 42 backend and 35 frontend files individually via
  esbuild (a real parser, not a guess).
- Bundled the entire backend from `server.js` and the entire frontend from
  `main.jsx`, resolving every relative import across the whole dependency
  graph, with zero errors both times.
- Manually traced the code path for each of the 12 required scenarios
  below against the actual logic (not simulated output) to confirm
  expected behavior. This is code-tracing, not execution — please run the
  real test pass yourself and tell me about anything that doesn't match.

| # | Scenario | Expected, traced through the code |
|---|---|---|
| 1 | Safe URL (well-known clean domain) | `urlHeuristics` produces mostly `NO_*`/info findings -> Risk Engine -> `riskLabel: 'safe'` -> orchestrator runs Security/CanUseIt/Defense only (Attack Story skipped since risk is safe) -> `verdict: 'safe_to_use'` |
| 2 | Suspicious URL (brand-lookalike, no HTTPS) | `BRAND_IMPERSONATION`/`PROTOCOL_NOT_HTTPS` findings -> medium/high risk -> all 7 agents relevant and run -> Attack Story populated from the `BRAND_IMPERSONATION` template |
| 3 | High-risk URL (VT flags malicious) | `VT_MALICIOUS_URL` critical finding -> `riskLabel: 'critical'` -> `verdict: 'do_not_use'` (deterministic, cannot be downgraded by AI) |
| 4 | Tracking-heavy website | Multiple utm_/click-id params -> `MULTIPLE_TRACKING_PARAMS` -> tracking agent classification `excessive_tracking`, but this alone does not push security risk up (tracking category weight is separate from security weight in the Risk Engine, unchanged from Phase 2) |
| 5 | Suspicious message | `OTP_REQUEST`/`CREDENTIAL_REQUEST`/embedded shortened link findings -> message text redacted before storage -> Defense agent recommends "never share a one-time code" tied to `relatedFinding: 'OTP_REQUEST'` |
| 6 | Safe file (plain PDF, no macros) | `NO_STRUCTURAL_ANOMALIES` info finding only -> `riskLabel: 'safe'` -> What-Could-Happen/Attack-Story both skipped (no non-info findings) |
| 7 | Suspicious file (renamed .exe) | `EXECUTABLE_DISGUISED_AS_DOCUMENT` critical finding fires regardless of claimed MIME type, because detection is by magic bytes, not extension |
| 8 | APK, normal permissions | e.g. a navigation-sounding package name + `ACCESS_FINE_LOCATION` -> `PERMISSION_CONTEXT_REASONABLE` info finding, not flagged as risk |
| 9 | APK, excessive permissions | SMS + Accessibility -> `SMS_ACCESSIBILITY_COMBO` critical finding (unchanged from Phase 2) plus new `PERMISSION_CONTEXT_MISMATCH` if the package name doesn't suggest a messaging app |
| 10 | VirusTotal unavailable | `lookupUrlReputation`/`lookupFileReputation` return `{available:false}` -> `VT_UNAVAILABLE` info finding, Risk Engine proceeds on structural findings alone (unchanged Phase 2 behavior) |
| 11 | AI unavailable (no `ANTHROPIC_API_KEY`) | Every agent call short-circuits to its fallback template immediately (`source: 'fallback', reason: 'no_api_key'`) — investigation still completes fully, with the exact same `whatCouldHappen`/`attackStory`/`defense` content as Phase 2 |
| 12 | Insufficient evidence (message with no links/keywords at all) | Findings limited to info-only markers -> Privacy/Tracking/Attack-Story/What-Could-Happen all report `applicable: false` with a specific `notApplicableReason`, rather than forcing a conclusion |

**Please run the real end-to-end pass** (`npm run dev` in both `server/`
and the frontend root) covering these 12 cases and let me know if any
behavior doesn't match what's documented above — I'll fix it immediately.

## 6. Known limitations (stated honestly, not hidden)

- No live browser rendering — third-party tracker detection for URLs is
  limited to URL-visible query parameters (utm_*, fbclid, etc.), not a
  full page fetch/render. A real "third-party requests / cookies /
  redirect chain" page inspector would need a headless browser and is a
  reasonable candidate for a later phase, not attempted here to avoid
  building a second parallel analysis system under time pressure.
- No Authenticode/PE code-signing parser — EXE/MSI publisher identity is
  explicitly reported as "not available" rather than guessed.
- No X.509 certificate issuer/validity parsing for APK signing certs —
  Guardian confirms presence/absence of signature files only.
- APK app-category inference (for permission contextualization) is a
  rough package-name keyword match with no app-store metadata — labeled
  as best-effort in the finding text itself.
- Message analysis is a deterministic regex/pattern engine, not an ML
  classifier — documented as such since no reputable third-party "is this
  text a scam" API exists without a paid enterprise contract.
- Storage is still a JSON file, not a real database — fine for this
  phase's scope, would need revisiting for concurrent-write safety at
  higher scale.
- I could not execute a live end-to-end run (no network in this sandbox)
  — see the honest disclosure in the Testing section above.

## 7. Explicitly deferred

Per instruction, the final voice/TTS feature is **not** implemented in
this phase. Phase 4 will consume the investigation result produced here;
nothing in this phase anticipates or special-cases a future voice layer.
