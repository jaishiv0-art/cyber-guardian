// Parses Android's compiled binary XML format (AXML) — the format every
// AndroidManifest.xml is stored in inside a real APK. This replaces
// "extract every printable string from the file and hope permission names
// happen to look right" with an actual structural parse: real element
// tree, real attributes, real boolean/int typed values. That's what lets
// Guardian reliably tell "android:exported=true" from "the word exported
// showed up somewhere in a resource string" and reason about component
// exposure, not just a permission wordlist.
//
// Format reference: androidxref.com/9.0.0_r3/xref/frameworks/base/libs/androidfw/include/androidfw/ResourceTypes.h
// (RES_XML_* chunk types, ResStringPool_header, ResXMLTree_node, etc.)
// No external dependencies — this is a from-scratch reader of a public,
// stable binary format.

const CHUNK_XML = 0x0003
const CHUNK_STRING_POOL = 0x0001
const CHUNK_RESOURCE_MAP = 0x0180
const CHUNK_START_NAMESPACE = 0x0100
const CHUNK_END_NAMESPACE = 0x0101
const CHUNK_START_ELEMENT = 0x0102
const CHUNK_END_ELEMENT = 0x0103
const CHUNK_CDATA = 0x0104

const UTF8_FLAG = 0x00000100

const TYPE_STRING_INLINE = -1 // sentinel: rawValue string index was used directly
const TYPE_REFERENCE = 0x01
const TYPE_INT_DEC = 0x10
const TYPE_INT_HEX = 0x11
const TYPE_INT_BOOLEAN = 0x12

class AxmlParseError extends Error {}

function readStringPool(buf, chunkStart, size) {
  const stringCount = buf.readUInt32LE(chunkStart + 8)
  const flags = buf.readUInt32LE(chunkStart + 16)
  const stringsStart = buf.readUInt32LE(chunkStart + 20)
  const isUtf8 = (flags & UTF8_FLAG) !== 0

  const offsets = new Array(stringCount)
  for (let i = 0; i < stringCount; i++) {
    offsets[i] = buf.readUInt32LE(chunkStart + 28 + i * 4)
  }

  const dataStart = chunkStart + stringsStart
  const cache = new Map()

  function readVarLen(pos) {
    // Android's "varint-ish" length encoding: 1 byte if <=0x7F, otherwise
    // the high bit of the first byte marks a 2-byte big-ish value.
    const b0 = buf[pos]
    if ((b0 & 0x80) === 0) return { len: b0, bytesRead: 1 }
    const b1 = buf[pos + 1]
    return { len: ((b0 & 0x7f) << 8) | b1, bytesRead: 2 }
  }

  function getString(index) {
    if (index == null || index < 0 || index >= stringCount) return null
    if (cache.has(index)) return cache.get(index)

    let value = null
    try {
      let pos = dataStart + offsets[index]
      if (isUtf8) {
        const utf16Len = readVarLen(pos)
        pos += utf16Len.bytesRead
        const utf8Len = readVarLen(pos)
        pos += utf8Len.bytesRead
        value = buf.toString('utf8', pos, pos + utf8Len.len)
      } else {
        let lenWord = buf.readUInt16LE(pos)
        let charLen
        let advance = 2
        if (lenWord & 0x8000) {
          const lenWord2 = buf.readUInt16LE(pos + 2)
          charLen = ((lenWord & 0x7fff) << 16) | lenWord2
          advance = 4
        } else {
          charLen = lenWord
        }
        pos += advance
        value = buf.toString('utf16le', pos, pos + charLen * 2)
      }
    } catch {
      value = null // corrupt offset — treat as unreadable, not fatal
    }
    cache.set(index, value)
    return value
  }

  return { getString }
}

function resolveAttrValue(pool, rawValueIndex, dataType, data) {
  if (rawValueIndex !== -1) {
    return { kind: 'string', value: pool.getString(rawValueIndex) }
  }
  switch (dataType) {
    case TYPE_INT_BOOLEAN:
      return { kind: 'boolean', value: data !== 0 }
    case TYPE_INT_DEC:
      return { kind: 'int', value: data | 0 }
    case TYPE_INT_HEX:
      return { kind: 'int', value: data >>> 0 }
    case TYPE_REFERENCE:
      return { kind: 'reference', value: `@0x${(data >>> 0).toString(16)}` }
    default:
      return { kind: 'raw', value: data >>> 0 }
  }
}

/**
 * Parses a compiled AndroidManifest.xml buffer into a simple element tree:
 * { tag, attributes: [{ name, kind, value }], children: [] }
 *
 * Throws AxmlParseError on structurally invalid input rather than
 * returning a silently-wrong partial tree — callers should treat a thrown
 * parse error as its own signal (a manifest deliberately corrupted just
 * enough to break analyzers, while remaining installable on lenient
 * Android versions, is itself a known evasion trick worth flagging).
 */
export function parseAxml(buf) {
  if (buf.length < 8 || buf.readUInt16LE(0) !== CHUNK_XML) {
    throw new AxmlParseError('Not a binary XML chunk (missing RES_XML_TYPE header)')
  }

  let pool = null
  const root = { tag: '__root__', attributes: [], children: [] }
  const stack = [root]
  let cursor = 8 // past the top-level ResXMLTree chunk header
  let sawStartElement = false

  while (cursor + 8 <= buf.length) {
    const type = buf.readUInt16LE(cursor)
    const size = buf.readUInt32LE(cursor + 4)
    if (size < 8 || cursor + size > buf.length) {
      throw new AxmlParseError(`Corrupt chunk at offset ${cursor}: implausible size ${size}`)
    }
    const chunkStart = cursor

    if (type === CHUNK_STRING_POOL) {
      pool = readStringPool(buf, chunkStart, size)
    } else if (type === CHUNK_RESOURCE_MAP) {
      // Maps string-pool entries to Android resource IDs. We don't need
      // resource IDs — attribute/element names are already plain text in
      // the string pool — so this chunk is intentionally skipped.
    } else if (type === CHUNK_START_ELEMENT) {
      if (!pool) throw new AxmlParseError('START_ELEMENT before any string pool was seen')
      const nsIdx = buf.readInt32LE(chunkStart + 16)
      const nameIdx = buf.readInt32LE(chunkStart + 20)
      const attrStartOff = buf.readUInt16LE(chunkStart + 24)
      const attrSize = buf.readUInt16LE(chunkStart + 26)
      const attrCount = buf.readUInt16LE(chunkStart + 28)

      const node = {
        tag: pool.getString(nameIdx),
        namespace: nsIdx !== -1 ? pool.getString(nsIdx) : null,
        attributes: [],
        children: [],
      }

      const attrsBase = chunkStart + 16 + attrStartOff
      for (let i = 0; i < attrCount; i++) {
        const a = attrsBase + i * attrSize
        const aNsIdx = buf.readInt32LE(a)
        const aNameIdx = buf.readInt32LE(a + 4)
        const aRawValueIdx = buf.readInt32LE(a + 8)
        const aDataType = buf.readUInt8(a + 15)
        const aData = buf.readUInt32LE(a + 16)
        const resolved = resolveAttrValue(pool, aRawValueIdx, aDataType, aData)
        node.attributes.push({
          name: pool.getString(aNameIdx),
          namespace: aNsIdx !== -1 ? pool.getString(aNsIdx) : null,
          ...resolved,
        })
      }

      stack[stack.length - 1].children.push(node)
      stack.push(node)
      sawStartElement = true
    } else if (type === CHUNK_END_ELEMENT) {
      if (stack.length > 1) stack.pop()
    } else if (type === CHUNK_CDATA || type === CHUNK_START_NAMESPACE || type === CHUNK_END_NAMESPACE) {
      // Not needed for manifest fact extraction — skipped via cursor advance below.
    }
    // Unknown/irrelevant chunk types are safely skipped too: we always
    // advance by the chunk's own declared size, never by assumptions
    // about its contents.

    cursor += size
  }

  if (!sawStartElement) {
    throw new AxmlParseError('No XML elements found — not a valid compiled manifest')
  }

  return root.children[0] ?? root
}

function findChild(node, tag) {
  return node.children.find((c) => c.tag === tag)
}
function findChildren(node, tags) {
  return node.children.filter((c) => tags.includes(c.tag))
}
function getAttr(node, name) {
  return node.attributes.find((a) => a.name === name)
}
function attrString(node, name) {
  const a = getAttr(node, name)
  if (!a) return null
  return a.kind === 'string' ? a.value : a.value != null ? String(a.value) : null
}
function attrBoolean(node, name) {
  const a = getAttr(node, name)
  if (!a) return null
  if (a.kind === 'boolean') return a.value
  if (a.kind === 'string') return a.value === 'true'
  return null
}
function attrInt(node, name) {
  const a = getAttr(node, name)
  if (!a) return null
  if (a.kind === 'int') return a.value
  if (a.kind === 'string' && /^-?\d+$/.test(a.value)) return parseInt(a.value, 10)
  return null
}

const COMPONENT_TAGS = ['activity', 'activity-alias', 'service', 'receiver', 'provider']

/**
 * Walks a parsed AXML tree rooted at <manifest> and pulls out the facts
 * apkHeuristics.js actually needs, using real attribute values rather
 * than substring guesses.
 */
export function extractManifestFacts(manifestNode) {
  if (!manifestNode || manifestNode.tag !== 'manifest') {
    throw new AxmlParseError(`Expected root element "manifest", got "${manifestNode?.tag}"`)
  }

  const permissions = new Set()
  for (const child of findChildren(manifestNode, ['uses-permission', 'uses-permission-sdk-23'])) {
    const name = attrString(child, 'name')
    if (name) permissions.add(name)
  }

  const usesSdk = findChild(manifestNode, 'uses-sdk')
  const minSdkVersion = usesSdk ? attrInt(usesSdk, 'minSdkVersion') : null
  const targetSdkVersion = usesSdk ? attrInt(usesSdk, 'targetSdkVersion') : null

  const application = findChild(manifestNode, 'application')
  const components = []
  if (application) {
    for (const comp of findChildren(application, COMPONENT_TAGS)) {
      const hasIntentFilter = Boolean(findChild(comp, 'intent-filter'))
      const explicitExported = attrBoolean(comp, 'exported')
      components.push({
        type: comp.tag,
        name: attrString(comp, 'name'),
        // Android's real default-exported rule (pre-API 31 behavior, still
        // the common case in the wild): a component with no explicit
        // android:exported is exported anyway if it declares an
        // intent-filter. That distinction is exactly what plain string
        // extraction can't reliably reproduce.
        exported: explicitExported !== null ? explicitExported : hasIntentFilter,
        exportedExplicit: explicitExported !== null,
        hasIntentFilter,
        permission: attrString(comp, 'permission'),
      })
    }
  }

  return {
    packageName: attrString(manifestNode, 'package'),
    versionCode: attrInt(manifestNode, 'versionCode'),
    versionName: attrString(manifestNode, 'versionName'),
    minSdkVersion,
    targetSdkVersion,
    permissions: Array.from(permissions),
    application: application
      ? {
          allowBackup: attrBoolean(application, 'allowBackup'),
          debuggable: attrBoolean(application, 'debuggable'),
          usesCleartextTraffic: attrBoolean(application, 'usesCleartextTraffic'),
          networkSecurityConfig: attrString(application, 'networkSecurityConfig'),
        }
      : {},
    components,
  }
}

export { AxmlParseError }
