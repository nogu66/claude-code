// The compositor: the world and the sprites to one RGBA canvas, and that canvas to the
// half-block cells of a Raster for a terminal without images. Pure pixel work, no $.
import { forEachTextPixel, measureText } from './font.ts'
import { frameRect, type Sheet, type Sprites } from './sprites.ts'
import { drawnBabies, fishSize, floorY, overflowCount, parentOf, spriteFrame, waterlineY, type Fish, type World } from './world.ts'

export type Canvas = { w: number; h: number; data: Uint8Array; u32: Uint32Array }

export function createCanvas(w: number, h: number): Canvas {
  const data = new Uint8Array(w * h * 4)
  return { w, h, data, u32: new Uint32Array(data.buffer) }
}

// little-endian RGBA as one u32: 0xAABBGGRR
const pack = (r: number, g: number, b: number, a = 255) => (((a & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff)) >>> 0
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const WATER_TOP = [0x28, 0x78, 0xb4]
const WATER_BOTTOM = [0x08, 0x1e, 0x46]
const AIR = [0x07, 0x0d, 0x1a]
const SAND = [0xc8, 0xaf, 0x7d]
const SAND_DARK = [0xa8, 0x8e, 0x5f]
const WATERLINE = [0xa8, 0xe0, 0xff]

export function fillRect(c: Canvas, x: number, y: number, w: number, h: number, r: number, g: number, b: number, a = 255): void {
  const x0 = Math.max(0, Math.round(x))
  const y0 = Math.max(0, Math.round(y))
  const x1 = Math.min(c.w, Math.round(x + w))
  const y1 = Math.min(c.h, Math.round(y + h))
  if (a >= 255) {
    const v = pack(r, g, b)
    for (let yy = y0; yy < y1; yy++) c.u32.fill(v, yy * c.w + x0, yy * c.w + x1)
    return
  }
  const ia = 255 - a
  for (let yy = y0; yy < y1; yy++) {
    let i = (yy * c.w + x0) * 4
    for (let xx = x0; xx < x1; xx++, i += 4) {
      c.data[i] = (r * a + c.data[i] * ia + 127) / 255
      c.data[i + 1] = (g * a + c.data[i + 1] * ia + 127) / 255
      c.data[i + 2] = (b * a + c.data[i + 2] * ia + 127) / 255
      c.data[i + 3] = 255
    }
  }
}

/** Alpha-blends a sheet rectangle onto the canvas at (dx, dy), clipped to the canvas. */
export function blit(c: Canvas, s: Sheet, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number): void {
  dx = Math.round(dx)
  dy = Math.round(dy)
  const x0 = Math.max(0, -dx)
  const y0 = Math.max(0, -dy)
  const x1 = Math.min(sw, c.w - dx)
  const y1 = Math.min(sh, c.h - dy)
  const d = c.data
  const src = s.data
  for (let y = y0; y < y1; y++) {
    let si = ((sy + y) * s.w + sx + x0) * 4
    let di = ((dy + y) * c.w + dx + x0) * 4
    for (let x = x0; x < x1; x++, si += 4, di += 4) {
      const a = src[si + 3]
      if (a === 0) continue
      if (a === 255) {
        d[di] = src[si]
        d[di + 1] = src[si + 1]
        d[di + 2] = src[si + 2]
        d[di + 3] = 255
      } else {
        const ia = 255 - a
        d[di] = (src[si] * a + d[di] * ia + 127) / 255
        d[di + 1] = (src[si + 1] * a + d[di + 1] * ia + 127) / 255
        d[di + 2] = (src[si + 2] * a + d[di + 2] * ia + 127) / 255
        d[di + 3] = 255
      }
    }
  }
}

function drawText(c: Canvas, text: string, x: number, y: number, scale: number, r: number, g: number, b: number): void {
  const v = pack(r, g, b)
  forEachTextPixel(text, Math.round(x), Math.round(y), scale, (px, py) => {
    if (px >= 0 && py >= 0 && px < c.w && py < c.h) c.u32[py * c.w + px] = v
  })
}

function drawBackground(c: Canvas, world: World): void {
  const top = waterlineY(world)
  const floor = floorY(world)
  const light = world.light
  for (let y = 0; y < c.h; y++) {
    let v: number
    if (y >= floor) {
      v = pack(SAND[0], SAND[1], SAND[2])
    } else if (y < top) {
      v = pack(AIR[0], AIR[1], AIR[2])
    } else if (y === top || (y === top + 1 && world.scale >= 1)) {
      v = pack(WATERLINE[0], WATERLINE[1], WATERLINE[2])
    } else {
      const t = y / Math.max(1, floor)
      const r = lerp(WATER_TOP[0], WATER_BOTTOM[0], t)
      const g = lerp(WATER_TOP[1], WATER_BOTTOM[1], t)
      const b = lerp(WATER_TOP[2], WATER_BOTTOM[2], t)
      const k = 0.22 * light
      v = pack(lerp(r, 255, k), lerp(g, 255, k), lerp(b, 255, k))
    }
    c.u32.fill(v, y * c.w, (y + 1) * c.w)
  }
  // grains in the sand
  const dark = pack(SAND_DARK[0], SAND_DARK[1], SAND_DARK[2])
  for (let y = floor + 1; y < c.h; y++) {
    for (let x = (y * 7) % 11; x < c.w; x += 11) if (((x * 13 + y * 7) & 3) === 0) c.u32[y * c.w + x] = dark
  }
}

function drawFish(c: Canvas, world: World, sprites: Sprites, fish: Fish, now: number): void {
  const { state, index } = spriteFrame(fish, now)
  const key = `${fish.color}_${fish.dir > 0 ? 'right' : 'left'}`
  const rect = frameRect(sprites, key, state, index)
  const sheet = sprites.sheets[key]
  if (!rect || !sheet) return
  blit(c, sheet, rect.x, rect.y, rect.w, rect.h, fish.x - rect.w / 2, fish.y - rect.h / 2)
}

function drawBubbleText(c: Canvas, world: World, fish: Fish, text: string): void {
  const { h } = fishSize(world, fish)
  const scale = world.scale >= 1 ? 2 : 1
  const tw = measureText(text, scale)
  const th = 5 * scale
  const pad = 2 * scale
  const bw = tw + pad * 2
  const bh = th + pad * 2
  let bx = Math.round(fish.x - bw / 2)
  bx = Math.max(1, Math.min(c.w - bw - 1, bx))
  let by = Math.round(fish.y - h / 2 - bh - 3 * scale)
  if (by < 1) by = Math.round(fish.y + h / 2 + 3 * scale)
  fillRect(c, bx, by, bw, bh, 255, 255, 255, 215)
  fillRect(c, bx + 1, by - 1, bw - 2, 1, 255, 255, 255, 215)
  fillRect(c, bx + 1, by + bh, bw - 2, 1, 255, 255, 255, 215)
  // the tail toward the fish
  const tx = Math.round(Math.max(bx + 2, Math.min(bx + bw - 3, fish.x)))
  fillRect(c, tx, by + bh + 1, scale, scale, 255, 255, 255, 215)
  drawText(c, text, bx + pad, by + pad, scale, 0x0b, 0x1e, 0x3a)
}

function drawBadge(c: Canvas, world: World, count: number): void {
  const parent = parentOf(world)
  if (!parent) return
  const { w, h } = fishSize(world, parent)
  const scale = world.scale >= 1 ? 2 : 1
  const text = `+${count}`
  const tw = measureText(text, scale)
  const pad = 2 * scale
  const bx = Math.round(Math.min(c.w - tw - pad * 2 - 1, parent.x + w / 2 - 4 * scale))
  const by = Math.round(Math.max(1, parent.y - h / 2 - 8 * scale))
  fillRect(c, bx, by, tw + pad * 2, 5 * scale + pad * 2, 0xff, 0xb3, 0x3c, 235)
  drawText(c, text, bx + pad, by + pad, scale, 0x1a, 0x10, 0x05)
}

/** Draws the whole tank for `now` into the canvas. */
export function drawWorld(c: Canvas, world: World, sprites: Sprites, now: number): void {
  drawBackground(c, world)
  const floor = floorY(world)

  const weed = sprites.seaweed
  const wf = sprites.seaweedFrame
  for (const s of world.seaweed) {
    const frame = (Math.floor(now / 250) + s.phase) % wf.frames
    blit(c, weed, frame * wf.w, 0, wf.w, wf.h, s.x - wf.w / 2, floor - wf.h + 3 * world.scale)
  }

  const nest = sprites.propRects.nest
  if (nest) for (const x of world.nests) blit(c, sprites.props, nest.x, nest.y, nest.w, nest.h, x - nest.w / 2, floor - nest.h + 2 * world.scale)

  const food = sprites.propRects.food
  if (food) for (const f of world.food) blit(c, sprites.props, food.x, food.y, food.w, food.h, f.x - food.w / 2, f.y - food.h / 2)

  const parent = parentOf(world)
  if (parent) drawFish(c, world, sprites, parent, now)
  for (const baby of drawnBabies(world)) drawFish(c, world, sprites, baby, now)

  for (const b of world.bubbles) {
    const rect = sprites.propRects[`bubble_${b.size}`]
    if (rect) blit(c, sprites.props, rect.x, rect.y, rect.w, rect.h, b.x - rect.w / 2, b.y - rect.h / 2)
  }

  for (const fish of world.fish) if (!fish.gone && !fish.overflow && fish.bubble) drawBubbleText(c, world, fish, fish.bubble.text)
  const extra = overflowCount(world)
  if (extra > 0) drawBadge(c, world, extra)
}

const DEFAULT_COLOR = 0x01000000
const UPPER_HALF = 0x2580

/**
 * The canvas as `columns * rows` half-block cells: each cell's glyph is ▀, its foreground the
 * mean colour of the cell's upper half, its background the lower half's. Packed as RasterProps wants.
 */
export function toHalfBlocks(c: Canvas, columns: number, rows: number): Uint8Array {
  const cw = Math.max(1, Math.floor(c.w / columns))
  const ch = Math.max(2, Math.floor(c.h / rows))
  const half = Math.floor(ch / 2)
  const words = new Uint32Array(columns * rows * 3)
  const mean = (x0: number, y0: number, w: number, h: number): number => {
    let r = 0
    let g = 0
    let b = 0
    let n = 0
    for (let y = y0; y < y0 + h && y < c.h; y++) {
      let i = (y * c.w + x0) * 4
      for (let x = x0; x < x0 + w && x < c.w; x++, i += 4) {
        r += c.data[i]
        g += c.data[i + 1]
        b += c.data[i + 2]
        n++
      }
    }
    if (n === 0) return DEFAULT_COLOR
    return ((Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n)) >>> 0
  }
  let o = 0
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      words[o++] = UPPER_HALF
      words[o++] = mean(col * cw, row * ch, cw, half)
      words[o++] = mean(col * cw, row * ch + half, cw, ch - half)
    }
  }
  return new Uint8Array(words.buffer, words.byteOffset, words.byteLength)
}
