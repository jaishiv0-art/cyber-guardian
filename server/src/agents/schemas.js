import { z } from 'zod'

// Every agent output includes `applicable` — when false, the agent has no
// relevant evidence and says so explicitly instead of forcing a conclusion
// out of nothing (this is how "insufficient evidence" is represented).

export const securityExplanationSchema = z.object({
  applicable: z.literal(true), // security explanation always has something to say (even "looks clean")
  summary: z.string().min(1).max(400),
  reasons: z.array(z.object({ title: z.string().max(160), explanation: z.string().max(400) })).max(8),
})

export const canUseItSchema = z.object({
  applicable: z.literal(true),
  verdict: z.enum(['safe_to_use', 'use_with_caution', 'avoid_if_possible', 'do_not_use']),
  explanation: z.string().min(1).max(400),
})

export const privacyAgentSchema = z.object({
  applicable: z.boolean(),
  notApplicableReason: z.string().max(300).optional(),
  summary: z.string().max(400).optional(),
  permissionExists: z.array(z.string().max(160)).max(15).optional(),
  confirmedDataCollection: z.array(z.string().max(160)).max(15).optional(),
  concerns: z.array(z.string().max(300)).max(10).optional(),
})

export const trackingAgentSchema = z.object({
  applicable: z.boolean(),
  notApplicableReason: z.string().max(300).optional(),
  classification: z.enum(['none_detected', 'normal_advertising', 'excessive_tracking', 'suspicious_collection']).optional(),
  summary: z.string().max(400).optional(),
  indicators: z.array(z.string().max(300)).max(10).optional(),
})

export const attackStorySchema = z.object({
  applicable: z.boolean(),
  notApplicableReason: z.string().max(300).optional(),
  stages: z
    .array(
      z.object({
        phase: z.enum(['initial_exposure', 'user_interaction', 'possible_exploitation', 'potential_impact']),
        title: z.string().max(160),
        detail: z.string().max(400),
      })
    )
    .max(4)
    .optional(),
})

export const whatCouldHappenSchema = z.object({
  applicable: z.boolean(),
  notApplicableReason: z.string().max(300).optional(),
  items: z
    .array(
      z.object({
        observed: z.string().max(300),
        possibleConsequence: z.string().max(400),
      })
    )
    .max(8)
    .optional(),
})

export const defenseAgentSchema = z.object({
  applicable: z.literal(true), // there is always at least generic guidance
  actions: z
    .array(
      z.object({
        action: z.string().max(160),
        detail: z.string().max(400),
        relatedFinding: z.string().max(80).optional(),
      })
    )
    .min(1)
    .max(8),
})
