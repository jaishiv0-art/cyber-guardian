import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'

/** Hash a Buffer synchronously. */
export function sha256Buffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

/** Hash a file on disk via streaming, so we never load huge files fully into memory just to hash them. */
export function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

/** Shannon entropy of a buffer, 0-8 bits/byte. High entropy (~7.5+) suggests packed/encrypted/compressed content. */
export function shannonEntropy(buffer) {
  if (!buffer || buffer.length === 0) return 0
  const freq = new Array(256).fill(0)
  for (let i = 0; i < buffer.length; i++) freq[buffer[i]]++
  let entropy = 0
  for (const count of freq) {
    if (count === 0) continue
    const p = count / buffer.length
    entropy -= p * Math.log2(p)
  }
  return entropy
}
