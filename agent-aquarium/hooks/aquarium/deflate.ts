// Deflate (RFC 1951) in plain TypeScript: one fixed-Huffman block over a greedy LZ77
// with a hash chain. Every frame goes to the terminal as a PNG through $.ui.blit, and the
// hooks environment has no zlib or CompressionStream, so the encoder lives here. Frames are
// mostly flat water (and, after PNG's Up filter, mostly zeros), where long matches at
// distance 1 do the work; fixed codes are enough and cheap to emit.

const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258]
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577]
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]

const WSIZE = 32768
const WMASK = WSIZE - 1
const HBITS = 15
const MAX_CHAIN = 8
const MIN_MATCH = 3
const MAX_MATCH = 258

// length (3..258) -> length code, extra bit count, extra bit value
const LEN_CODE = new Uint16Array(259)
const LEN_EB = new Uint8Array(259)
const LEN_EV = new Uint16Array(259)
for (let i = 0; i < 29; i++) {
  const end = i === 28 ? 259 : LEN_BASE[i + 1]
  for (let l = LEN_BASE[i]; l < end; l++) {
    LEN_CODE[l] = 257 + i
    LEN_EB[l] = LEN_EXTRA[i]
    LEN_EV[l] = l - LEN_BASE[i]
  }
}

function reverseBits(code: number, len: number): number {
  let r = 0
  for (let i = 0; i < len; i++) {
    r = (r << 1) | (code & 1)
    code >>= 1
  }
  return r
}

// fixed literal/length codes (RFC 1951 3.2.6), stored bit-reversed for an LSB-first writer
const LIT_RCODE = new Uint16Array(288)
const LIT_LEN = new Uint8Array(288)
for (let sym = 0; sym < 288; sym++) {
  let code: number
  let len: number
  if (sym < 144) { code = 0x30 + sym; len = 8 }
  else if (sym < 256) { code = 0x190 + (sym - 144); len = 9 }
  else if (sym < 280) { code = sym - 256; len = 7 }
  else { code = 0xc0 + (sym - 280); len = 8 }
  LIT_RCODE[sym] = reverseBits(code, len)
  LIT_LEN[sym] = len
}
const DIST_RCODE = new Uint8Array(30)
for (let i = 0; i < 30; i++) DIST_RCODE[i] = reverseBits(i, 5)

function distCode(d: number): number {
  for (let i = 29; i >= 0; i--) if (d >= DIST_BASE[i]) return i
  return 0
}

/** Compresses to a raw deflate stream: one final fixed-Huffman block. */
export function deflateFixed(src: Uint8Array): Uint8Array {
  const n = src.length
  let out = new Uint8Array(n + (n >> 3) + 64)
  let outPos = 0
  let bitBuf = 0
  let bitCnt = 0
  const grow = () => {
    const bigger = new Uint8Array(out.length * 2)
    bigger.set(out)
    out = bigger
  }
  const put = (v: number, bits: number) => {
    bitBuf |= v << bitCnt
    bitCnt += bits
    while (bitCnt >= 8) {
      if (outPos >= out.length) grow()
      out[outPos++] = bitBuf & 0xff
      bitBuf >>>= 8
      bitCnt -= 8
    }
  }

  put(1, 1) // BFINAL
  put(1, 2) // BTYPE = 01, fixed Huffman

  const head = new Int32Array(1 << HBITS).fill(-1)
  const prev = new Int32Array(WSIZE)
  const hash = (p: number) => Math.imul((src[p] << 16) | (src[p + 1] << 8) | src[p + 2], 0x9e3779b1) >>> (32 - HBITS)
  const insert = (p: number) => {
    if (p + 2 >= n) return
    const hv = hash(p)
    prev[p & WMASK] = head[hv]
    head[hv] = p
  }

  let i = 0
  while (i < n) {
    let bestLen = 0
    let bestDist = 0
    if (i + 2 < n) {
      const maxLen = Math.min(MAX_MATCH, n - i)
      let cand = head[hash(i)]
      let chain = MAX_CHAIN
      while (cand >= 0 && chain-- > 0 && i - cand <= WSIZE) {
        if (src[cand + bestLen] === src[i + bestLen] && src[cand] === src[i]) {
          let l = 0
          while (l < maxLen && src[cand + l] === src[i + l]) l++
          if (l > bestLen) {
            bestLen = l
            bestDist = i - cand
            if (l === maxLen) break
          }
        }
        const nxt = prev[cand & WMASK]
        if (nxt >= cand) break // the ring slot was reused by a newer position
        cand = nxt
      }
    }
    if (bestLen >= MIN_MATCH) {
      const lc = LEN_CODE[bestLen]
      put(LIT_RCODE[lc], LIT_LEN[lc])
      if (LEN_EB[bestLen] > 0) put(LEN_EV[bestLen], LEN_EB[bestLen])
      const dc = distCode(bestDist)
      put(DIST_RCODE[dc], 5)
      if (DIST_EXTRA[dc] > 0) put(bestDist - DIST_BASE[dc], DIST_EXTRA[dc])
      // a long match (a run of water) is hashed at its head only: the next run finds it there
      const hashed = bestLen > 32 ? 4 : bestLen
      for (let k = 0; k < hashed; k++) insert(i + k)
      i += bestLen
    } else {
      const sym = src[i]
      put(LIT_RCODE[sym], LIT_LEN[sym])
      insert(i)
      i++
    }
  }
  put(LIT_RCODE[256], LIT_LEN[256])
  if (bitCnt > 0) {
    if (outPos >= out.length) grow()
    out[outPos++] = bitBuf & 0xff
  }
  return out.subarray(0, outPos)
}
