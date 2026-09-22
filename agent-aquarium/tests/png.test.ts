import { describe, expect, test } from 'bun:test'
import { deflateRawSync, deflateSync, inflateRawSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { deflateFixed } from '../hooks/aquarium/deflate.ts'
import { inflate } from '../hooks/aquarium/inflate.ts'
import { adler32, crc32, decodePng, encodePng, fromBase64, toBase64 } from '../hooks/aquarium/png.ts'

const ASSETS = new URL('../assets/', import.meta.url).pathname

function sample(n: number, seed = 1): Uint8Array {
  const out = new Uint8Array(n)
  let s = seed
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0
    // runs of a few values with noise: what a filtered frame looks like
    out[i] = (s >>> 24) < 40 ? (s >>> 16) & 0xff : i % 7 === 0 ? 3 : 0
  }
  return out
}

describe('inflate', () => {
  test('reads stored, fixed and dynamic blocks from node zlib', () => {
    for (const level of [0, 1, 6, 9]) {
      const data = sample(200_000, level + 1)
      const packed = new Uint8Array(deflateRawSync(data, { level }))
      expect(inflate(packed)).toEqual(data)
    }
  })
  test('reads an empty stream and a one-byte stream', () => {
    expect(inflate(new Uint8Array(deflateRawSync(new Uint8Array(0))))).toEqual(new Uint8Array(0))
    expect(inflate(new Uint8Array(deflateRawSync(new Uint8Array([7]))))).toEqual(new Uint8Array([7]))
  })
  test('rejects a truncated stream', () => {
    const packed = new Uint8Array(deflateRawSync(sample(5000)))
    expect(() => inflate(packed.subarray(0, packed.length - 10))).toThrow()
  })
})

describe('deflateFixed', () => {
  test('round-trips through node inflate', () => {
    for (const [n, seed] of [[0, 1], [1, 2], [2, 3], [3, 4], [1000, 5], [300_000, 6]] as const) {
      const data = sample(n, seed)
      const packed = deflateFixed(data)
      expect(new Uint8Array(inflateRawSync(packed))).toEqual(data)
      expect(inflate(packed)).toEqual(data)
    }
  })
  test('compresses long runs hard', () => {
    const zeros = new Uint8Array(500_000)
    const packed = deflateFixed(zeros)
    expect(packed.length).toBeLessThan(5000)
    expect(new Uint8Array(inflateRawSync(packed))).toEqual(zeros)
  })
  test('handles matches across the window edge', () => {
    const data = new Uint8Array(100_000)
    for (let i = 0; i < data.length; i++) data[i] = (i * 31) & 0xff
    // a repeat exactly 32768 back, and one further
    for (let i = 40_000; i < 41_000; i++) data[i] = data[i - 32768]
    for (let i = 60_000; i < 61_000; i++) data[i] = data[i - 40_000]
    expect(new Uint8Array(inflateRawSync(deflateFixed(data)))).toEqual(data)
  })
})

describe('checksums', () => {
  test('crc32 and adler32 match known values', () => {
    const bytes = new TextEncoder().encode('The quick brown fox jumps over the lazy dog')
    expect(crc32(bytes)).toBe(0x414fa339)
    expect(adler32(bytes)).toBe(0x5bdc0fda)
  })
})

describe('png', () => {
  test('decodes the sprite sheets with the sizes the manifest names', () => {
    const manifest = JSON.parse(readFileSync(`${ASSETS}manifest.json`, 'utf8'))
    for (const sheet of Object.values(manifest.sheets) as { file: string; w: number; h: number }[]) {
      const img = decodePng(new Uint8Array(readFileSync(`${ASSETS}${sheet.file}`)))
      expect(img.width).toBe(sheet.w * manifest.cols)
      expect(img.height).toBe(sheet.h * 6)
      // a corner of a frame is water (transparent); the middle of the swim frame is fish
      expect(img.data[3]).toBe(0)
      const cx = Math.floor(sheet.w * 0.6)
      const cy = Math.floor(sheet.h * 0.5)
      expect(img.data[(cy * img.width + cx) * 4 + 3]).toBeGreaterThan(200)
    }
    const props = decodePng(new Uint8Array(readFileSync(`${ASSETS}props.png`)))
    expect([props.width, props.height]).toEqual([96, 16])
    const weed = decodePng(new Uint8Array(readFileSync(`${ASSETS}seaweed.png`)))
    expect([weed.width, weed.height]).toEqual([128, 96])
  })
  test('encodes what it decodes', () => {
    const w = 37
    const h = 11
    const px = new Uint8Array(w * h * 4)
    for (let i = 0; i < px.length; i++) px[i] = (i * 7 + (i >> 5)) & 0xff
    const png = encodePng(px, w, h)
    const back = decodePng(png)
    expect([back.width, back.height]).toEqual([w, h])
    expect(back.data).toEqual(px)
  })
  test('reads a node-made PNG with every filter type', () => {
    const w = 16
    const h = 8
    const px = new Uint8Array(w * h * 4)
    for (let i = 0; i < px.length; i++) px[i] = (i * 13) & 0xff
    const raw = new Uint8Array((w * 4 + 1) * h)
    for (let y = 0; y < h; y++) {
      const f = y % 5
      raw[y * (w * 4 + 1)] = f
      for (let i = 0; i < w * 4; i++) {
        const cur = px[y * w * 4 + i]
        const left = i >= 4 ? px[y * w * 4 + i - 4] : 0
        const up = y > 0 ? px[(y - 1) * w * 4 + i] : 0
        const ul = y > 0 && i >= 4 ? px[(y - 1) * w * 4 + i - 4] : 0
        const p = left + up - ul
        const pa = Math.abs(p - left)
        const pb = Math.abs(p - up)
        const pc = Math.abs(p - ul)
        const paeth = pa <= pb && pa <= pc ? left : pb <= pc ? up : ul
        const pred = f === 0 ? 0 : f === 1 ? left : f === 2 ? up : f === 3 ? (left + up) >> 1 : paeth
        raw[y * (w * 4 + 1) + 1 + i] = (cur - pred) & 0xff
      }
    }
    const zlib = new Uint8Array(deflateSync(raw))
    const png = encodePng(new Uint8Array(w * h * 4), w, h)
    // splice node's IDAT in place of ours: same IHDR, our chunk framing
    const ihdrEnd = 8 + 12 + 13
    const out = new Uint8Array(ihdrEnd + 12 + zlib.length + 12)
    out.set(png.subarray(0, ihdrEnd))
    const dv = new DataView(out.buffer)
    dv.setUint32(ihdrEnd, zlib.length)
    out.set([0x49, 0x44, 0x41, 0x54], ihdrEnd + 4)
    out.set(zlib, ihdrEnd + 8)
    dv.setUint32(ihdrEnd + 8 + zlib.length, crc32(out, ihdrEnd + 4, ihdrEnd + 8 + zlib.length))
    out.set(png.subarray(png.length - 12), out.length - 12)
    expect(decodePng(out).data).toEqual(px)
  })
  test('base64 helpers agree with the platform', () => {
    const bytes = sample(1001, 9)
    const text = toBase64(bytes)
    expect(text).toBe(Buffer.from(bytes).toString('base64'))
    expect(fromBase64(text)).toEqual(bytes)
  })
})
