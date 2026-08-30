import { shannonEntropy } from '../utils/hashing.js'
import { tryReadZip, findExecutableEntries, getEntryBuffer } from './zipUtils.js'

function finding(code, category, severity, title, detail) {
  return { code, category, severity, title, detail }
}

const EXECUTABLE_EXTENSIONS = new Set(['exe', 'scr', 'bat', 'cmd', 'js', 'vbs', 'jar', 'msi', 'com', 'ps1'])

const SIGNATURES = [
  { bytes: [0x4d, 0x5a], type: 'Windows executable (PE/EXE)', family: 'executable' },
  { bytes: [0x7f, 0x45, 0x4c, 0x46], type: 'Linux executable (ELF)', family: 'executable' },
  { bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], type: 'Legacy Office document or MSI installer (OLE Compound File)', family: 'ole' },
  { bytes: [0x25, 0x50, 0x44, 0x46], type: 'PDF document', family: 'pdf' },
  { bytes: [0x50, 0x4b, 0x03, 0x04], type: 'ZIP-based container (zip/docx/xlsx/pptx/jar/apk)', family: 'zip' },
  { bytes: [0xff, 0xd8, 0xff], type: 'JPEG image', family: 'image' },
  { bytes: [0x89, 0x50, 0x4e, 0x47], type: 'PNG image', family: 'image' },
]

function detectSignature(buffer) {
  for (const sig of SIGNATURES) {
    if (buffer.length >= sig.bytes.length && sig.bytes.every((b, i) => buffer[i] === b)) {
      return { type: sig.type, family: sig.family }
    }
  }
  return { type: 'Unrecognized / no known signature match', family: 'unknown' }
}

function extensionsOf(filename) {
  const parts = filename.toLowerCase().split('.')
  return parts.slice(1)
}

function identifyZipFlavor(entries) {
  const names = entries.map((e) => e.name)
  if (names.includes('AndroidManifest.xml')) return 'Android APK'
  if (names.some((n) => n.startsWith('word/'))) return 'Word document (.docx)'
  if (names.some((n) => n.startsWith('xl/'))) return 'Excel spreadsheet (.xlsx)'
  if (names.some((n) => n.startsWith('ppt/'))) return 'PowerPoint presentation (.pptx)'
  if (names.some((n) => n.toLowerCase() === 'meta-inf/manifest.mf')) return 'Java archive (JAR)'
  return 'Generic ZIP archive'
}

function extractXmlTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'))
  return m ? m[1].trim() : null
}

function extractOoxmlMetadata(zip) {
  const buf = getEntryBuffer(zip, 'docProps/core.xml')
  if (!buf) return null
  const xml = buf.toString('utf-8')
  const meta = {
    title: extractXmlTag(xml, 'dc:title'),
    creator: extractXmlTag(xml, 'dc:creator'),
    created: extractXmlTag(xml, 'dcterms:created'),
    lastModifiedBy: extractXmlTag(xml, 'cp:lastModifiedBy'),
  }
  return Object.values(meta).some(Boolean) ? meta : null
}

function extractPdfMetadata(buffer) {
  const text = buffer.subarray(0, Math.min(buffer.length, 200000)).toString('latin1')
  const get = (key) => {
    const m = text.match(new RegExp(`/${key}\\s*\\(([^)]{0,200})\\)`))
    return m ? m[1].trim() : null
  }
  const meta = { title: get('Title'), author: get('Author'), creator: get('Creator'), producer: get('Producer') }
  return Object.values(meta).some(Boolean) ? meta : null
}

const URL_PATTERN = /https?:\/\/[a-zA-Z0-9._~%\-/?#[\]@!$&'()*+,;=]{4,300}/g

function extractEmbeddedUrls(buffer) {
  const text = buffer.subarray(0, Math.min(buffer.length, 3000000)).toString('latin1')
  const found = new Set()
  const matches = text.match(URL_PATTERN)
  if (matches) for (const m of matches) found.add(m.replace(/[.,)"'\]]+$/, ''))
  return [...found]
}

export async function analyzeGenericFile({ buffer, originalName, mimetype }) {
  const findings = []

  const { type: signature, family } = detectSignature(buffer)
  const exts = extensionsOf(originalName)
  const finalExt = exts[exts.length - 1]

  const looksExecutable = family === 'executable'
  const claimsSafeDoc = finalExt && !EXECUTABLE_EXTENSIONS.has(finalExt)
  if (looksExecutable && claimsSafeDoc) {
    findings.push(
      finding(
        'EXECUTABLE_DISGUISED_AS_DOCUMENT',
        'security',
        'critical',
        'File is a disguised executable',
        `The file's actual content is a ${signature}, but its name ("${originalName}") and declared type suggest a document. This is a common malware-delivery trick.`
      )
    )
  }

  if (exts.length >= 2 && EXECUTABLE_EXTENSIONS.has(finalExt) && !EXECUTABLE_EXTENSIONS.has(exts[exts.length - 2])) {
    findings.push(
      finding(
        'DOUBLE_EXTENSION',
        'security',
        'high',
        'Double file extension',
        `The filename "${originalName}" ends in an executable extension after another extension \u2014 many file explorers hide the final ".${finalExt}", making it look like a document.`
      )
    )
  }

  const entropy = shannonEntropy(buffer.subarray(0, Math.min(buffer.length, 2000000)))
  if (entropy > 7.5 && claimsSafeDoc) {
    findings.push(
      finding(
        'HIGH_ENTROPY_PACKED',
        'security',
        'medium',
        'Unusually high data entropy',
        `The file's byte-level entropy is ${entropy.toFixed(2)}/8, typical of packed or encrypted executables rather than a plain ${finalExt ?? 'document'} file.`
      )
    )
  }

  let documentType = null
  let metadata = null

  if (family === 'executable') {
    findings.push(
      finding(
        'PUBLISHER_VERIFICATION_NOT_AVAILABLE',
        'security',
        'info',
        'Publisher/code-signature verification not performed',
        'Confirming a real Authenticode publisher signature requires deeper PE-format parsing not implemented in this phase. Guardian does not claim a publisher identity it has not actually verified.'
      )
    )
  }

  if (family === 'ole') {
    documentType = finalExt === 'msi' || originalName.toLowerCase().endsWith('.msi') ? 'MSI installer' : 'Legacy Office document (.doc/.xls, OLE format)'
    findings.push(finding('OLE_CONTAINER_IDENTIFIED', 'security', 'info', `Identified as: ${documentType}`, 'Signature bytes confirm this is a genuine OLE Compound File container, matching a legacy Office or MSI format.'))
  }

  const zipResult = tryReadZip(buffer)
  if (zipResult) {
    const exeEntries = findExecutableEntries(zipResult.entries)
    if (exeEntries.length > 0) {
      findings.push(
        finding(
          'ARCHIVE_CONTAINS_EXECUTABLE',
          'security',
          'high',
          'Archive contains executable content',
          `This archive contains ${exeEntries.length} executable entr${exeEntries.length === 1 ? 'y' : 'ies'} (e.g. "${exeEntries[0].name}").`
        )
      )
    }

    documentType = identifyZipFlavor(zipResult.entries)
    if (documentType.includes('.docx') || documentType.includes('.xlsx') || documentType.includes('.pptx')) {
      metadata = extractOoxmlMetadata(zipResult.zip)
      if (metadata) {
        findings.push(
          finding(
            'DOCUMENT_METADATA_FOUND',
            'privacy',
            'info',
            'Document metadata found',
            `Author/creator metadata embedded in the file: ${[metadata.creator && `creator "${metadata.creator}"`, metadata.lastModifiedBy && `last modified by "${metadata.lastModifiedBy}"`].filter(Boolean).join(', ') || 'present but unlabeled'}.`
          )
        )
      }
    }
  }

  if (family === 'pdf') {
    documentType = 'PDF document'
    metadata = extractPdfMetadata(buffer)
    if (metadata) {
      findings.push(
        finding(
          'DOCUMENT_METADATA_FOUND',
          'privacy',
          'info',
          'Document metadata found',
          `Embedded metadata: ${[metadata.author && `author "${metadata.author}"`, metadata.producer && `producer "${metadata.producer}"`].filter(Boolean).join(', ') || 'present but unlabeled'}.`
        )
      )
    }
  }

  const embeddedUrls = extractEmbeddedUrls(buffer)
  if (embeddedUrls.length > 0) {
    findings.push(
      finding(
        'EMBEDDED_URLS_FOUND',
        'security',
        'low',
        `${embeddedUrls.length} embedded URL${embeddedUrls.length === 1 ? '' : 's'} found`,
        `Found ${embeddedUrls.length} URL${embeddedUrls.length === 1 ? '' : 's'} referenced inside the file: ${embeddedUrls.slice(0, 3).join(', ')}${embeddedUrls.length > 3 ? ', \u2026' : ''}.`
      )
    )
  }

  if (findings.filter((f) => f.severity !== 'info').length === 0) {
    findings.push(
      finding('NO_STRUCTURAL_ANOMALIES', 'security', 'info', 'No structural anomalies found', `File signature (${signature}) is consistent with its declared type, and no packing or disguise patterns were detected.`)
    )
  }

  if (!metadata) {
    findings.push(finding('PRIVACY_NOT_APPLICABLE', 'privacy', 'info', 'No privacy-relevant content found', 'No embedded author/creator metadata was found in this file.'))
  }
  findings.push(finding('TRACKING_NOT_APPLICABLE', 'tracking', 'info', 'No tracking mechanism applies', 'Standalone files carry no network trackers themselves.'))

  return {
    findings,
    meta: {
      signature,
      family,
      documentType: documentType ?? signature,
      entropy: Math.round(entropy * 100) / 100,
      mimetype,
      documentMetadata: metadata,
      embeddedUrls,
    },
  }
}
