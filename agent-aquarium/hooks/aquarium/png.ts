// PNG read and write over the plain-TypeScript inflate/deflate: 8-bit RGB or RGBA, no
// interlace, which is what the sprite sheets are and what a frame needs to be.
import { deflateFixed } from './deflate.ts'
import { inflate } from './inflate.ts'

export type Rgba = { width: number; height: number; data: Uint8Array }

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c >>> 0
}

export function crc32(bytes: Uint8Array, start = 0, end = bytes.length): number {
  let c = 0xffffffff
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export function adler32(bytes: Uint8Array): number {
  let a = 1
  let b = 0
  const n = bytes.length
  for (let i = 0; i < n;) {
    // 5552 is the most bytes before the sums may overflow 32 bits
    const end = Math.min(n, i + 5552)
    for (; i < end; i++) {
      a += bytes[i]
      b += a
    }
    a %= 65521
    b %= 65521
  }
  return ((b << 16) | a) >>> 0
}

const readU32 = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0
const writeU32 = (b: Uint8Array, i: number, v: number) => {
  b[i] = (v >>> 24) & 0xff
  b[i + 1] = (v >>> 16) & 0xff
  b[i + 2] = (v >>> 8) & 0xff
  b[i + 3] = v & 0xff
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/** Decodes an 8-bit RGB or RGBA, non-interlaced PNG to RGBA pixels. */
export function decodePng(bytes: Uint8Array): Rgba {
  for (let i = 0; i < 8; i++) if (bytes[i] !== SIGNATURE[i]) throw new Error('png: not a PNG file')
  let width = 0
  let height = 0
  let colorType = -1
  let bitDepth = 0
  let interlace = 0
  const idat: Uint8Array[] = []
  let idatLen = 0
  let pos = 8
  while (pos + 8 <= bytes.length) {
    const len = readU32(bytes, pos)
    const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7])
    const dataStart = pos + 8
    const dataEnd = dataStart + len
    if (dataEnd + 4 > bytes.length) throw new Error(`png: truncated ${type} chunk`)
    if (type === 'IHDR') {
      width = readU32(bytes, dataStart)
      height = readU32(bytes, dataStart + 4)
      bitDepth = bytes[dataStart + 8]
      colorType = bytes[dataStart + 9]
      interlace = bytes[dataStart + 12]
    } else if (type === 'IDAT') {
      idat.push(bytes.subarray(dataStart, dataEnd))
      idatLen += len
    } else if (type === 'IEND') {
      break
    }
    pos = dataEnd + 4
  }
  if (width === 0 || height === 0) throw new Error('png: no IHDR')
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) throw new Error(`png: unsupported format (bit depth ${bitDepth}, color type ${colorType})`)
  if (interlace !== 0) throw new Error('png: interlaced images are not supported')
  const bpp = colorType === 6 ? 4 : 3
  const stride = width * bpp
  const zlib = new Uint8Array(idatLen)
  let off = 0
  for (const part of idat) {
    zlib.set(part, off)
    off += part.length
  }
  // skip the 2-byte zlib header; the adler32 trailer is left unchecked
  const raw = inflate(zlib.subarray(2), (stride + 1) * height)
  if (raw.length < (stride + 1) * height) throw new Error('png: image data is short')
  const data = new Uint8Array(width * height * 4)
  const line = new Uint8Array(stride)
  const prevLine = new Uint8Array(stride)
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1)
    const filter = raw[rowStart]
    line.set(raw.subarray(rowStart + 1, rowStart + 1 + stride))
    switch (filter) {
      case 0: break
      case 1: for (let i = bpp; i < stride; i++) line[i] = (line[i] + line[i - bpp]) & 0xff; break
      case 2: for (let i = 0; i < stride; i++) line[i] = (line[i] + prevLine[i]) & 0xff; break
      case 3: for (let i = 0; i < stride; i++) line[i] = (line[i] + (((i >= bpp ? line[i - bpp] : 0) + prevLine[i]) >> 1)) & 0xff; break
      case 4: for (let i = 0; i < stride; i++) line[i] = (line[i] + paeth(i >= bpp ? line[i - bpp] : 0, prevLine[i], i >= bpp ? prevLine[i - bpp] : 0)) & 0xff; break
      default: throw new Error(`png: bad filter ${filter} on row ${y}`)
    }
    if (bpp === 4) data.set(line, y * width * 4)
    else {
      let di = y * width * 4
      for (let i = 0; i < stride; i += 3) {
        data[di++] = line[i]
        data[di++] = line[i + 1]
        data[di++] = line[i + 2]
        data[di++] = 255
      }
    }
    prevLine.set(line)
  }
  return { width, height, data }
}

/** Encodes RGBA pixels as a PNG (8-bit RGBA, Up-filtered rows, one fixed-Huffman deflate block). */
export function encodePng(data: Uint8Array, width: number, height: number): Uint8Array {
  const stride = width * 4
  if (data.length < stride * height) throw new Error('png: pixel buffer is short')
  const raw = new Uint8Array((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    const ro = y * (stride + 1)
    const so = y * stride
    if (y === 0) {
      raw[ro] = 0
      raw.set(data.subarray(so, so + stride), ro + 1)
    } else {
      raw[ro] = 2
      const po = so - stride
      for (let i = 0; i < stride; i++) raw[ro + 1 + i] = (data[so + i] - data[po + i]) & 0xff
    }
  }
  const body = deflateFixed(raw)
  const zlib = new Uint8Array(body.length + 6)
  zlib[0] = 0x78
  zlib[1] = 0x01
  zlib.set(body, 2)
  writeU32(zlib, body.length + 2, adler32(raw))

  const ihdr = new Uint8Array(13)
  writeU32(ihdr, 0, width)
  writeU32(ihdr, 4, height)
  ihdr[8] = 8
  ihdr[9] = 6
  const out = new Uint8Array(8 + (12 + 13) + (12 + zlib.length) + 12)
  out.set(SIGNATURE, 0)
  let p = 8
  const chunk = (type: string, payload: Uint8Array) => {
    writeU32(out, p, payload.length)
    for (let i = 0; i < 4; i++) out[p + 4 + i] = type.charCodeAt(i)
    out.set(payload, p + 8)
    writeU32(out, p + 8 + payload.length, crc32(out, p + 4, p + 8 + payload.length))
    p += 12 + payload.length
  }
  chunk('IHDR', ihdr)
  chunk('IDAT', zlib)
  chunk('IEND', new Uint8Array(0))
  return out
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Standard padded base64; the environment's `toBase64` when it has one. */
export function toBase64(bytes: Uint8Array): string {
  const native = (bytes as unknown as { toBase64?: () => string }).toBase64
  if (typeof native === 'function') return native.call(bytes)
  let s = ''
  const n = bytes.length
  for (let i = 0; i < n; i += 3) {
    const a = bytes[i]
    const b = i + 1 < n ? bytes[i + 1] : 0
    const c = i + 2 < n ? bytes[i + 2] : 0
    s += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)] + (i + 1 < n ? B64[((b & 15) << 2) | (c >> 6)] : '=') + (i + 2 < n ? B64[c & 63] : '=')
  }
  return s
}

export function fromBase64(text: string): Uint8Array {
  const native = (Uint8Array as unknown as { fromBase64?: (s: string) => Uint8Array }).fromBase64
  if (typeof native === 'function') return native.call(Uint8Array, text)
  const clean = text.replace(/[^A-Za-z0-9+/]/g, '')
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let o = 0
  for (let i = 0; i + 1 < clean.length; i += 4) {
    const a = B64.indexOf(clean[i])
    const b = B64.indexOf(clean[i + 1])
    const c = i + 2 < clean.length ? B64.indexOf(clean[i + 2]) : -1
    const d = i + 3 < clean.length ? B64.indexOf(clean[i + 3]) : -1
    out[o++] = (a << 2) | (b >> 4)
    if (c >= 0) out[o++] = ((b & 15) << 4) | (c >> 2)
    if (d >= 0) out[o++] = ((c & 3) << 6) | d
  }
  return out.subarray(0, o)
}
