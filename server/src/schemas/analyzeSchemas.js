import { z } from 'zod'

export const personalContextSchema = z
  .enum(['banking', 'email', 'college', 'social_media', 'personal_files', 'identity', 'general'])
  .default('general')

export const urlAnalyzeSchema = z.object({
  url: z
    .string({ required_error: 'A URL is required.' })
    .trim()
    .min(4, 'URL is too short.')
    .max(2048, 'URL is too long (max 2048 characters).')
    .refine((val) => {
      try {
        const u = new URL(val)
        return u.protocol === 'http:' || u.protocol === 'https:'
      } catch {
        return false
      }
    }, 'Must be a valid http:// or https:// URL.'),
  personalContext: personalContextSchema.optional().default('general'),
})

export const messageAnalyzeSchema = z.object({
  message: z
    .string({ required_error: 'Message text is required.' })
    .trim()
    .min(3, 'Message is too short to analyze.')
    .max(5000, 'Message is too long (max 5000 characters).'),
  personalContext: personalContextSchema.optional().default('general'),
})

export const investigationParamsSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^inv_[a-zA-Z0-9]{6,32}$/, 'Not a valid investigation id.'),
})

export const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(['url', 'file', 'apk', 'message', 'all']).default('all'),
  risk: z.enum(['safe', 'low', 'medium', 'high', 'critical', 'all']).default('all'),
  q: z.string().trim().max(200).optional().default(''),
})
