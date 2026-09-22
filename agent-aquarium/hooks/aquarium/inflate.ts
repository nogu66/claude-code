// Inflate (RFC 1951) in plain TypeScript. The hooks environment has no zlib and no
// DecompressionStream, and the sprite sheets are PNGs, so this is how they are read.
// Stored, fixed-Huffman and dynamic-Huffman blocks; the canonical-code walk is tinf's.

const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258]
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577]
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]
const CLEN_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]

type Tree = { count: Uint16Array; symbol: Uint16Array }

function buildTree(lengths: ArrayLike<number>, n: number): Tree {
  const count = new Uint16Array(16)
  const symbol = new Uint16Array(n)
  for (let i = 0; i < n; i++) count[lengths[i]]++
  count[0] = 0
  const offs = new Uint16Array(16)
  for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + count[i - 1]
  for (let i = 0; i < n; i++) if (lengths[i] !== 0) symbol[offs[lengths[i]]++] = i
  return { count, symbol }
}

let fixed: [Tree, Tree] | undefined
function fixedTrees(): [Tree, Tree] {
  if (!fixed) {
    const lit = new Uint8Array(288)
    for (let i = 0; i < 288; i++) lit[i] = i < 144 ? 8 : i < 256 ? 9 : i < 280 ? 7 : 8
    const dist = new Uint8Array(30).fill(5)
    fixed = [buildTree(lit, 288), buildTree(dist, 30)]
  }
  return fixed
}

/** Decompresses a raw deflate stream (no zlib or gzip wrapper). */
export function inflate(src: Uint8Array, sizeHint = src.length * 4): Uint8Array {
  let out = new Uint8Array(Math.max(1024, sizeHint))
  let outLen = 0
  let pos = 0
  let bitBuf = 0
  let bitCnt = 0

  const bits = (n: number): number => {
    while (bitCnt < n) {
      if (pos >= src.length) throw new Error('inflate: unexpected end of data')
      bitBuf |= src[pos++] << bitCnt
      bitCnt += 8
    }
    const v = bitBuf & ((1 << n) - 1)
    bitBuf >>>= n
    bitCnt -= n
    return v
  }
  const decode = (t: Tree): number => {
    let code = 0
    let first = 0
    let index = 0
    for (let len = 1; len < 16; len++) {
      code |= bits(1)
      const c = t.count[len]
      if (code - c < first) return t.symbol[index + (code - first)]
      index += c
      first += c
      first <<= 1
      code <<= 1
    }
    throw new Error('inflate: bad huffman code')
  }
  const ensure = (n: number) => {
    if (outLen + n <= out.length) return
    let cap = out.length * 2
    while (cap < outLen + n) cap *= 2
    const bigger = new Uint8Array(cap)
    bigger.set(out.subarray(0, outLen))
    out = bigger
  }

  for (;;) {
    const final = bits(1)
    const type = bits(2)
    if (type === 0) {
      // stored: the leftover bits (fewer than 8, all of the current byte) are dropped
      bitBuf = 0
      bitCnt = 0
      if (pos + 4 > src.length) throw new Error('inflate: truncated stored block')
      const len = src[pos] | (src[pos + 1] << 8)
      const nlen = src[pos + 2] | (src[pos + 3] << 8)
      pos += 4
      if ((len ^ 0xffff) !== nlen) throw new Error('inflate: stored block length mismatch')
      if (pos + len > src.length) throw new Error('inflate: truncated stored block')
      ensure(len)
      out.set(src.subarray(pos, pos + len), outLen)
      outLen += len
      pos += len
    } else if (type === 1 || type === 2) {
      let lit: Tree
      let dist: Tree
      if (type === 1) [lit, dist] = fixedTrees()
      else {
        const hlit = bits(5) + 257
        const hdist = bits(5) + 1
        const hclen = bits(4) + 4
        const cl = new Uint8Array(19)
        for (let i = 0; i < hclen; i++) cl[CLEN_ORDER[i]] = bits(3)
        const clTree = buildTree(cl, 19)
        const lengths = new Uint8Array(hlit + hdist)
        for (let i = 0; i < hlit + hdist;) {
          const sym = decode(clTree)
          if (sym < 16) lengths[i++] = sym
          else if (sym === 16) {
            if (i === 0) throw new Error('inflate: repeat with no previous length')
            const prev = lengths[i - 1]
            let n = 3 + bits(2)
            while (n-- > 0) lengths[i++] = prev
          } else if (sym === 17) {
            let n = 3 + bits(3)
            while (n-- > 0) lengths[i++] = 0
          } else {
            let n = 11 + bits(7)
            while (n-- > 0) lengths[i++] = 0
          }
        }
        lit = buildTree(lengths.subarray(0, hlit), hlit)
        dist = buildTree(lengths.subarray(hlit), hdist)
      }
      for (;;) {
        const sym = decode(lit)
        if (sym < 256) {
          ensure(1)
          out[outLen++] = sym
        } else if (sym === 256) {
          break
        } else {
          const li = sym - 257
          if (li >= 29) throw new Error('inflate: bad length code')
          const len = LEN_BASE[li] + bits(LEN_EXTRA[li])
          const di = decode(dist)
          if (di >= 30) throw new Error('inflate: bad distance code')
          const d = DIST_BASE[di] + bits(DIST_EXTRA[di])
          if (d > outLen) throw new Error('inflate: distance before start')
          ensure(len)
          for (let k = 0; k < len; k++) {
            out[outLen] = out[outLen - d]
            outLen++
          }
        }
      }
    } else {
      throw new Error('inflate: reserved block type')
    }
    if (final) break
  }
  return out.subarray(0, outLen)
}
