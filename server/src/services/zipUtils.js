import AdmZip from 'adm-zip'

const EXECUTABLE_ENTRY_PATTERN = /\.(exe|dll|scr|bat|cmd|msi|com|vbs|ps1)$/i

// Hardening: a small uploaded zip can still declare a huge *uncompressed*
// entry size (a "zip bomb"). We only ever read a handful of named entries
// (AndroidManifest.xml, classes.dex, docProps/core.xml, PDF /Info) for
// bounded string scanning — never the whole archive — so any single entry
// larger than this is refused rather than decompressed into memory.
const MAX_ENTRY_UNCOMPRESSED_BYTES = 30 * 1024 * 1024 // 30MB

/**
 * Best-effort zip inspection. Many document formats (docx/xlsx/pptx) and
 * archives (zip/jar/apk) are zip containers, so this is shared across
 * file and APK analysis. Returns null if the buffer isn't a valid zip.
 */
export function tryReadZip(buffer) {
  try {
    const zip = new AdmZip(buffer)
    const entries = zip.getEntries().map((e) => ({ name: e.entryName, size: e.header.size }))
    return { zip, entries }
  } catch {
    return null
  }
}

export function findExecutableEntries(entries) {
  return entries.filter((e) => EXECUTABLE_ENTRY_PATTERN.test(e.name))
}

export function getEntryBuffer(zip, entryName) {
  const entry = zip.getEntry(entryName)
  if (!entry) return null
  // Refuse to decompress implausibly large single entries — protects
  // against zip-bomb-style DoS regardless of the outer upload size cap.
  if (entry.header?.size > MAX_ENTRY_UNCOMPRESSED_BYTES) return null
  try {
    return zip.readFile(entry)
  } catch {
    return null
  }
}
