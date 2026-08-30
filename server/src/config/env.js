import 'dotenv/config'
import { z } from 'zod'

// Coerce helper: treat empty string as undefined so defaults kick in.
const numeric = (def) =>
  z.preprocess((v) => (v === '' || v === undefined ? undefined : Number(v)), z.number().finite()).default(def)

const envSchema = z.object({
  PORT: numeric(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),

  VIRUSTOTAL_API_KEY: z.string().optional().default(''),

  // Community malware-sample database (abuse.ch) — hash lookup, general files + APKs.
  MALWAREBAZAAR_API_KEY: z.string().optional().default(''),

  // Android-specific reputation/analysis platform — hash lookup, APKs only.
  KOODOUS_API_KEY: z.string().optional().default(''),

  // --- Optional: self-hosted MobSF instance for real static (and,
  // separately, dynamic) APK analysis — decompiles and inspects actual
  // content, unlike every hash-lookup source above. Entirely opt-in: with
  // these unset, APK analysis behaves exactly as it did before.
  MOBSF_URL: z.string().optional().default(''),
  MOBSF_API_KEY: z.string().optional().default(''),
  MOBSF_TIMEOUT_MS: z.coerce.number().int().positive().optional().default(180_000),

  UPLOAD_TMP_DIR: z.string().default('uploads/tmp'),
  MAX_FILE_SIZE_MB: numeric(25),
  MAX_APK_SIZE_MB: numeric(100),
  TEMP_FILE_TTL_MINUTES: numeric(30),

  DATA_DIR: z.string().default('data'),

  RATE_LIMIT_WINDOW_MS: numeric(600000),
  RATE_LIMIT_MAX_ANALYZE: numeric(20),
  RATE_LIMIT_MAX_READ: numeric(180),

  WEIGHT_SEVERITY_CRITICAL: numeric(0.85),
  WEIGHT_SEVERITY_HIGH: numeric(0.6),
  WEIGHT_SEVERITY_MEDIUM: numeric(0.35),
  WEIGHT_SEVERITY_LOW: numeric(0.15),
  WEIGHT_SEVERITY_INFO: numeric(0.05),

  CATEGORY_WEIGHT_SECURITY: numeric(0.5),
  CATEGORY_WEIGHT_PRIVACY: numeric(0.3),
  CATEGORY_WEIGHT_TRACKING: numeric(0.2),

  RISK_THRESHOLD_SAFE: numeric(15),
  RISK_THRESHOLD_LOW: numeric(35),
  RISK_THRESHOLD_MEDIUM: numeric(55),
  RISK_THRESHOLD_HIGH: numeric(75),

  // --- Phase 3: Agentic AI explanation layer ---
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-haiku-4-5-20251001'),
  AGENT_TIMEOUT_MS: numeric(20000),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('✘ Invalid environment configuration:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

const env = parsed.data

export default {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  isProd: env.NODE_ENV === 'production',
  frontendOrigin: env.FRONTEND_ORIGIN,

  virustotalApiKey: env.VIRUSTOTAL_API_KEY,
  virustotalEnabled: Boolean(env.VIRUSTOTAL_API_KEY),

  malwareBazaarApiKey: env.MALWAREBAZAAR_API_KEY,
  malwareBazaarEnabled: Boolean(env.MALWAREBAZAAR_API_KEY),

  koodousApiKey: env.KOODOUS_API_KEY,
  koodousEnabled: Boolean(env.KOODOUS_API_KEY),

  mobsfUrl: env.MOBSF_URL.replace(/\/+$/, ''), // strip trailing slash so path joins are predictable
  mobsfApiKey: env.MOBSF_API_KEY,
  mobsfEnabled: Boolean(env.MOBSF_URL && env.MOBSF_API_KEY),
  mobsfTimeoutMs: env.MOBSF_TIMEOUT_MS,

  uploadTmpDir: env.UPLOAD_TMP_DIR,
  maxFileSizeBytes: env.MAX_FILE_SIZE_MB * 1024 * 1024,
  maxApkSizeBytes: env.MAX_APK_SIZE_MB * 1024 * 1024,
  tempFileTtlMinutes: env.TEMP_FILE_TTL_MINUTES,

  dataDir: env.DATA_DIR,

  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxAnalyze: env.RATE_LIMIT_MAX_ANALYZE,
    maxRead: env.RATE_LIMIT_MAX_READ,
  },

  riskEngine: {
    severityWeights: {
      critical: env.WEIGHT_SEVERITY_CRITICAL,
      high: env.WEIGHT_SEVERITY_HIGH,
      medium: env.WEIGHT_SEVERITY_MEDIUM,
      low: env.WEIGHT_SEVERITY_LOW,
      info: env.WEIGHT_SEVERITY_INFO,
    },
    categoryWeights: {
      security: env.CATEGORY_WEIGHT_SECURITY,
      privacy: env.CATEGORY_WEIGHT_PRIVACY,
      tracking: env.CATEGORY_WEIGHT_TRACKING,
    },
    thresholds: {
      safe: env.RISK_THRESHOLD_SAFE,
      low: env.RISK_THRESHOLD_LOW,
      medium: env.RISK_THRESHOLD_MEDIUM,
      high: env.RISK_THRESHOLD_HIGH,
    },
  },

  agents: {
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    agentsEnabled: Boolean(env.ANTHROPIC_API_KEY),
    model: env.ANTHROPIC_MODEL,
    timeoutMs: env.AGENT_TIMEOUT_MS,
  },
}
