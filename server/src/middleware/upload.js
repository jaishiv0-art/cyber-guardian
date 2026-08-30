import path from 'node:path'
import crypto from 'node:crypto'
import fs from 'node:fs'
import multer from 'multer'
import env from '../config/env.js'
import { AppError } from '../utils/AppError.js'

fs.mkdirSync(env.uploadTmpDir, { recursive: true })

// Broad allowlist for the generic /file endpoint. Intentionally includes
// executable/archive types — a security scanner has to be able to accept
// the exact things it's meant to inspect. Safety comes from isolated
// storage, size caps, no execution, and guaranteed cleanup — not from
// pretending dangerous files don't exist.
const GENERIC_FILE_MIME_ALLOWLIST = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/rtf',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/gzip',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Executables / scripts — accepted deliberately for analysis.
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/vnd.microsoft.portable-executable',
  'application/x-msi',
  'application/octet-stream',
  'application/x-sh',
  'application/java-archive',
])

const APK_MIME_ALLOWLIST = new Set([
  'application/vnd.android.package-archive',
  'application/octet-stream', // many browsers/OSes mislabel .apk this way
  'application/zip',
])

function makeStorage(subdir) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const dest = path.join(env.uploadTmpDir, subdir)
      fs.mkdirSync(dest, { recursive: true })
      cb(null, dest)
    },
    filename: (req, file, cb) => {
      // Random name on disk — the original filename is preserved only in
      // metadata (req.file.originalname), never used for the actual path,
      // which prevents path traversal / overwrite tricks entirely.
      const safeSuffix = crypto.randomBytes(16).toString('hex')
      cb(null, `${Date.now()}_${safeSuffix}`)
    },
  })
}

function fileFilterFor(allowlist, { requireApkExtension = false } = {}) {
  return (req, file, cb) => {
    if (requireApkExtension && !file.originalname.toLowerCase().endsWith('.apk')) {
      return cb(AppError.badRequest('INVALID_FILE_TYPE', 'Only .apk files are accepted on this endpoint.'))
    }
    if (!allowlist.has(file.mimetype)) {
      return cb(
        AppError.badRequest(
          'INVALID_FILE_TYPE',
          `File type "${file.mimetype}" is not accepted.`,
        )
      )
    }
    cb(null, true)
  }
}

export const uploadGenericFile = multer({
  storage: makeStorage('files'),
  limits: { fileSize: env.maxFileSizeBytes, files: 1 },
  fileFilter: fileFilterFor(GENERIC_FILE_MIME_ALLOWLIST),
}).single('file')

export const uploadApkFile = multer({
  storage: makeStorage('apks'),
  limits: { fileSize: env.maxApkSizeBytes, files: 1 },
  fileFilter: fileFilterFor(APK_MIME_ALLOWLIST, { requireApkExtension: true }),
}).single('file')

/** Normalizes multer's own errors (size limit, etc.) into our AppError shape. */
export function handleUploadErrors(uploadMiddleware) {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (!err) {
        if (!req.file) {
          return next(AppError.badRequest('FILE_REQUIRED', 'No file was uploaded. Attach it as "file".'))
        }
        return next()
      }
      if (err instanceof AppError) return next(err)
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(
          AppError.tooLarge('FILE_TOO_LARGE', 'Uploaded file exceeds the maximum allowed size.')
        )
      }
      return next(AppError.badRequest('UPLOAD_ERROR', err.message || 'Upload failed.'))
    })
  }
}
