import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { applyTool, birth } from '../hooks/aquarium/events.ts'
import { forEachTextPixel, measureText } from '../hooks/aquarium/font.ts'
import { decodePng } from '../hooks/aquarium/png.ts'
import { createCanvas, drawWorld, fillRect, toHalfBlocks } from '../hooks/aquarium/render.ts'
import { buildSprites, downscale, frameRect, isManifest, scaleForHeight, type RawAssets } from '../hooks/aquarium/sprites.ts'
import { createWorld, setError, step } from '../hooks/aquarium/world.ts'

const ASSETS = new URL('../assets/', import.meta.url).pathname
const seeded = (s = 1) => () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296 }

function loadRaw(): RawAssets {
  const manifest: unknown = JSON.parse(readFileSync(`${ASSETS}manifest.json`, 'utf8'))
  if (!isManifest(manifest)) throw new Error('bad manifest')
  const png = (f: string) => decodePng(new Uint8Array(readFileSync(`${ASSETS}${f}`)))
  const raw: RawAssets = { manifest, sheets: {}, props: png(manifest.props.file), seaweed: png(manifest.seaweed.file) }
  for (const [k, m] of Object.entries(manifest.sheets)) raw.sheets[k] = png(m.file)
  return raw
}
const RAW = loadRaw()

describe('font', () => {
  test('measures and plots', () => {
    expect(measureText('', 1)).toBe(0)
    expect(measureText('AB', 1)).toBe(7)
    expect(measureText('AB', 2)).toBe(14)
    const dots: string[] = []
    forEachTextPixel('I', 10, 20, 1, (x, y) => dots.push(`${x},${y}`))
    expect(dots).toEqual(['10,20', '11,20', '12,20', '11,21', '11,22', '11,23', '10,24', '11,24', '12,24'])
    let n = 0
    forEachTextPixel('é', 0, 0, 1, () => n++)
    expect(n).toBeGreaterThan(0)
  })
})

describe('sprites', () => {
  test('scale follows the tank height and frame rects follow the manifest', () => {
    expect(scaleForHeight(192)).toBe(0.5)
    expect(scaleForHeight(448)).toBe(1)
    const full = buildSprites(RAW, 1)
    const half = buildSprites(RAW, 0.5)
    expect(full.frame.parent_right).toEqual({ w: 160, h: 80 })
    expect(half.frame.parent_right).toEqual({ w: 80, h: 40 })
    expect(half.sheets.parent_right.w).toBe(480)
    expect(frameRect(full, 'blue_left', 'error', 2)).toEqual({ x: 192, y: 144, w: 96, h: 48 })
    expect(frameRect(half, 'blue_left', 'swim', 5)).toEqual({ x: 240, y: 0, w: 48, h: 24 })
    expect(frameRect(full, 'blue_left', 'eat', 9)?.x).toBe(288)
    expect(frameRect(full, 'nope', 'swim', 0)).toBeUndefined()
    expect(half.propRects.nest).toEqual({ x: 26, y: 0, w: 20, h: 8 })
  })
  test('downscale keeps colour at soft edges', () => {
    const img = { width: 2, height: 2, data: new Uint8Array([255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0]) }
    const s = downscale(img, 2)
    expect([s.w, s.h]).toEqual([1, 1])
    expect(Array.from(s.data)).toEqual([255, 0, 0, 128])
  })
})

describe('compositor', () => {
  test('draws a staged tank at both sizes without touching pixels outside', () => {
    for (const [cols, rows] of [[80, 12], [140, 28]] as const) {
      const w = cols * 8
      const h = rows * 16
      const scale = scaleForHeight(h)
      const sprites = buildSprites(RAW, scale)
      const world = createWorld(w, h, scale, 0)
      const rand = seeded(4)
      birth(world, 'a1', 'Explore', 0, rand)
      birth(world, 'a2', 'general-purpose', 0, rand)
      for (let i = 13; i <= 15; i++) birth(world, `x${i}`, 'Plan', 0, rand)
      let now = 0
      for (let i = 0; i < 15; i++) { now += 66; step(world, now, rand) }
      applyTool(world, 'main', 'Edit', { file_path: 'auth.ts' }, false, now, rand)
      applyTool(world, 'a1', 'Read', { file_path: 'x' }, false, now, rand)
      const a2 = world.fish.find(f => f.id === 'a2')!
      setError(world, a2, now)
      a2.bubble = { text: 'Bash test', until: now + 5000 }
      world.water = 0.6
      const canvas = createCanvas(w, h)
      for (let i = 0; i < 10; i++) { now += 66; step(world, now, rand); drawWorld(canvas, world, sprites, now) }
      // every pixel opaque, sand at the bottom, air at the top
      for (let i = 3; i < canvas.data.length; i += 4 * 997) expect(canvas.data[i]).toBe(255)
      expect(canvas.data[((h - 1) * w + 3) * 4]).toBe(0xc8)
      expect(canvas.data[(0 * w + 3) * 4 + 2]).toBe(0x1a)
      const cells = toHalfBlocks(canvas, cols, rows)
      expect(cells.length).toBe(cols * rows * 12)
      const words = new Uint32Array(cells.buffer, cells.byteOffset, cells.length / 4)
      expect(words[0]).toBe(0x2580)
      // the lowest cell's background is sand (its grains darken the mean a little)
      const sand = words[(cols * rows - 1) * 3 + 2]
      expect(sand >> 16).toBeGreaterThan(0xb0)
      expect((sand >> 8) & 0xff).toBeGreaterThan(0x98)
      expect(sand & 0xff).toBeLessThan(0x90)
    }
  })
  test('fillRect clips and blends', () => {
    const c = createCanvas(4, 4)
    fillRect(c, -2, -2, 4, 4, 100, 0, 0)
    expect(Array.from(c.data.subarray(0, 4))).toEqual([100, 0, 0, 255])
    expect(c.data[(3 * 4 + 3) * 4 + 3]).toBe(0)
    fillRect(c, 0, 0, 1, 1, 0, 0, 100, 128)
    expect(c.data[0]).toBeCloseTo(50, -1)
    expect(c.data[2]).toBeCloseTo(50, -1)
  })
})
