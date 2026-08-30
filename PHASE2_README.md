# Guardian — Phase 2: Real Backend

Phase 2 replaces every piece of mock data with a real Express backend that
performs genuine static/structural analysis and calls a real, live
threat-intelligence API (VirusTotal). Nothing in the scoring pipeline is
written or invented by Claude at request time — it's deterministic code
that runs the same way every time given the same input.

## 1. What's genuinely real here

| Analyzer | What it actually does |
|---|---|
| **URL** | Parses the URL for structural phishing signals (brand-lookalike domains, IP-literal hosts, suspicious TLDs, shorteners, login-path keywords, tracking params) **and** queries VirusTotal's live API for third-party engine verdicts. |
| **File** | Reads real magic bytes (file signature) vs. the claimed extension, detects double-extension tricks, computes Shannon entropy (packed/encrypted detection), inspects zip-based files for embedded executables, hashes with SHA-256, and checks that hash against VirusTotal. |
| **APK** | Opens the APK as a real zip archive, verifies `classes.dex` and `META-INF` signing files exist, extracts real permission strings from the binary `AndroidManifest.xml` (ASCII + UTF-16LE string scanning), flags dangerous permission combinations (e.g. SMS + Accessibility), and checks the file hash against VirusTotal. |
| **Message** | Runs deterministic regex-based pattern detection (urgency language, OTP-sharing requests, credential requests, payment lures, family-impersonation openers) and extracts + independently analyzes any embedded links (including a live VirusTotal check on them). There is no reputable third-party "is this text a scam" API available without a paid contract, so this one is honestly a rule-based linguistic engine — documented as such, not disguised as something it isn't. |

**VirusTotal** is the one real security/reputation API integrated this
phase. It's free-tier friendly: URL checks use a cached-lookup-first
strategy, and file/APK checks only ever send a SHA-256 hash — **file
contents are never uploaded to VirusTotal**, only checked against hashes
VT has already seen.

## 2. The Risk Engine (`server/src/engine/riskEngine.js`)

This is pure math — no LLM call happens anywhere in the scoring path.

1. Every analyzer produces **findings**: `{ code, category, severity, title, detail }`.
2. Each finding's severity maps to a configurable weight (`WEIGHT_SEVERITY_*` env vars).
3. Findings in the same category (`security` / `privacy` / `tracking`) combine via a **noisy-OR**: `combined = 1 - Π(1 - weight_i)` — a standard, bounded way to combine independent risk signals without simple sums blowing past 100%.
4. The three category risks combine into **Overall Risk** using configurable category weights (`CATEGORY_WEIGHT_*`).
5. **Threat Probability** blends Overall Risk with VirusTotal's actual malicious-engine ratio when VT data is available.
6. **Potential Impact** (Minimal → Critical) is a deterministic lookup from finding-severity counts + risk bucket.
7. **Confidence** is deterministic too: it starts at a base and only increases when real evidence was gathered (live VT data, breadth of heuristic categories covered) — capped at 97%, since Guardian never claims certainty.
8. Risk-label thresholds (`safe`/`low`/`medium`/`high`/`critical`) are configurable via `RISK_THRESHOLD_*`.

The **narrative sections** (What Could Happen / Attack Story / Defense) come
from `server/src/engine/narrative.js` — a static lookup table keyed by
which finding *codes* were actually detected. It's template selection, not
generation: the same triggering codes always produce the same text.

## 3. Files created

```
guardian/
├── .env.example                          (frontend API base URL)
├── src/
│   ├── services/api.js                   (frontend → backend HTTP client)
│   └── data/constants.js                 (replaces mockData.js — UI labels only, no fake results)
└── server/                               ← NEW backend
    ├── package.json
    ├── .env.example
    ├── .gitignore
    ├── uploads/tmp/                       (gitignored scratch space for uploads)
    ├── data/                              (gitignored; investigations.json lives here)
    └── src/
        ├── server.js                      entrypoint
        ├── app.js                         Express app, CORS, helmet, routes
        ├── config/env.js                  Zod-validated environment config
        ├── schemas/analyzeSchemas.js       Zod request schemas
        ├── middleware/
        │   ├── validate.js                generic Zod validation middleware
        │   ├── upload.js                   multer config — MIME allowlist, size limits, random filenames
        │   ├── rateLimiter.js              express-rate-limit config
        │   └── errorHandler.js            structured { error: { code, message, details } } responses
        ├── routes/
        │   ├── analyze.js                  POST /api/analyze/{url,file,apk,message}
        │   ├── investigation.js            GET /api/investigation/:id
        │   └── history.js                  GET /api/history
        ├── controllers/
        │   ├── analyzeController.js        orchestrates analyzer + VT + risk engine per request
        │   ├── investigationController.js
        │   └── historyController.js
        ├── services/
        │   ├── virustotal.js               real VT API v3 client (URL + file-hash lookups)
        │   ├── urlHeuristics.js             URL structural analysis
        │   ├── messageHeuristics.js         message pattern analysis
        │   ├── fileHeuristics.js            generic file analysis
        │   ├── apkHeuristics.js             APK manifest/permission analysis
        │   ├── zipUtils.js                  shared zip-reading helper
        │   └── cleanup.js                   temp file deletion + periodic sweep
        ├── engine/
        │   ├── riskEngine.js                deterministic scoring (see above)
        │   ├── narrative.js                 finding-code → report-section templates
        │   └── present.js                   findings → API response shape helpers
        ├── store/investigationStore.js      JSON-file-backed store (see note below)
        └── utils/
            ├── AppError.js, asyncHandler.js, logger.js, hashing.js (SHA-256 + entropy)
```

**Note on storage:** Phase 2 uses a lightweight JSON-file store
(`server/data/investigations.json`) instead of a real database, to keep
scope focused on the analysis pipeline you asked for. It's a real,
persistent store (survives restarts) — just not Postgres/Mongo. Swapping
it for a real DB later only touches `store/investigationStore.js`.

## 4. Environment variables

Copy both `.env.example` files to `.env` before running.

**`server/.env`** — full reference is in `server/.env.example`, key ones:

| Variable | Purpose |
|---|---|
| `PORT` | Backend port (default 4000) |
| `FRONTEND_ORIGIN` | CORS allowlist — must match your Vite dev URL |
| `VIRUSTOTAL_API_KEY` | **Get a free key** at https://www.virustotal.com/gui/join-us. Leave blank to run heuristics-only (VT findings will honestly say "unavailable" instead of being faked). |
| `MAX_FILE_SIZE_MB` / `MAX_APK_SIZE_MB` | Upload size caps |
| `TEMP_FILE_TTL_MINUTES` | How old an orphaned temp upload must be before the cleanup sweeper deletes it |
| `RATE_LIMIT_MAX_ANALYZE` / `RATE_LIMIT_WINDOW_MS` | Rate limiting on the expensive analyze endpoints |
| `WEIGHT_SEVERITY_*`, `CATEGORY_WEIGHT_*`, `RISK_THRESHOLD_*` | Risk Engine tuning — change these to shift how aggressive scoring is, without touching code |

**`guardian/.env`** (frontend root):
```
VITE_API_BASE_URL=http://localhost:4000/api
```

## 5. Getting a VirusTotal API key

1. Go to https://www.virustotal.com/gui/join-us and create a free account.
2. Open your profile → **API Key**, copy it.
3. Paste it into `server/.env` as `VIRUSTOTAL_API_KEY=...`.
4. Free-tier limits are ~4 requests/minute — fine for testing, but the
   backend degrades gracefully (marks VT as "unavailable", still returns a
   full heuristics-based report) if you hit the limit or leave the key blank.

## 6. How to run

**Terminal 1 — backend:**
```bash
cd guardian/server
cp .env.example .env
# edit .env and paste your VIRUSTOTAL_API_KEY (optional but recommended)
npm install
npm run dev
```
You should see:
```
Guardian API listening on http://localhost:4000
VirusTotal integration: enabled
```

**Terminal 2 — frontend:**
```bash
cd guardian
cp .env.example .env
npm install
npm run dev
```
Open `http://localhost:5173`.

## 7. Test procedure

1. **Health check** — `curl http://localhost:4000/api/health` → `{"status":"ok", "virustotalEnabled": true/false, ...}`
2. **URL analysis** — In the app, go to Investigate → URL, paste `http://example-test-login.tk/verify` (a deliberately suspicious-shaped test URL) → watch the timeline run → View full report. Confirm the risk findings mention specific things like "suspicious TLD" or brand-lookalike patterns, and that clicking "Why this verdict" opens the evidence drawer with real detail text.
3. **A known-clean URL** — try `https://www.wikipedia.org` → should come back `safe`/`low` with mostly "NO_*" reassuring findings.
4. **Message analysis** — paste `"Your parcel is on hold, pay $49 urgently: http://bit.ly/test123"` → should flag urgency language, payment request, and the shortened link.
5. **File upload** — upload any small PDF or text file → should return low risk with "no structural anomalies". Try renaming a `.txt` file to `.pdf` — Guardian's magic-byte check will still correctly identify it as plain text (not flagged), demonstrating the signature check works independent of extension.
6. **APK upload** — upload any `.apk` you have on hand → check that permissions are actually extracted and listed under Risk Findings / Why.
7. **History** — go to History, filter by type/risk, confirm results match what you just ran.
8. **Dashboard** — confirm stats (`Investigations run`, `Threats blocked`, etc.) reflect the real count from your test runs, not static numbers.
9. **Error handling** — stop the backend server and try another investigation in the UI → should show a clear "Could not reach the Guardian backend" error state, not a crash.
10. **Rate limiting** — fire ~25 URL analyses in under 10 minutes → should eventually get a `429 RATE_LIMITED` structured error.

## 8. What's intentionally out of scope this phase

- A real database (Postgres/Mongo) — currently a JSON-file store, swappable later.
- User accounts/auth.
- Async/background job processing for large file scans (everything here runs synchronously within the request).
- Additional reputation APIs beyond VirusTotal (e.g. domain WHOIS/age, Google Safe Browsing) — the architecture (`services/`) makes adding more straightforward in a later phase.
