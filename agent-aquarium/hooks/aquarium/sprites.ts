// The sprite sheets as the compositor uses them: decoded once at 1:1, then boxed down to
// the tank's sprite scale. Frame rectangles come from assets/manifest.json, never from here.
import type { Rgba } from './png.ts'

export type Manifest = {
  cols: number
  states: Record<string, { row: number; frames: number }>
  sheets: Record<string, { file: string; w: number; h: number }>
  props: { file: string; rects: Record<string, [number, number, number, number]> }
  seaweed: { file: string; w: number; h: number; frames: number }
}

/** Everything decoded at 1:1: keyed as the manifest keys them. */
export type RawAssets = { manifest: Manifest; sheets: Record<string, Rgba>; props: Rgba; seaweed: Rgba }

export type Sheet = { w: number; h: number; data: Uint8Array }
export type Rect = { x: number; y: number; w: number; h: number }

/** The sheets at one scale, with the frame and prop rectangles scaled to match. */
export type Sprites = {
  scale: number
  sheets: Record<string, Sheet>
  frame: Record<string, { w: number; h: number }>
  props: Sheet
  propRects: Record<string, Rect>
  seaweed: Sheet
  seaweedFrame: { w: number; h: number; frames: number }
  states: Record<string, { row: number; frames: number }>
  cols: number
}

export function isManifest(value: unknown): value is Manifest {
  const m = value as Manifest
  return typeof m === 'object' && m !== null && typeof m.cols === 'number' && typeof m.states === 'object' && typeof m.sheets === 'object' && typeof m.props === 'object' && typeof m.seaweed === 'object'
}

/** Shrinks an image by an integer factor with a box filter weighted by alpha, so edges keep their colour. */
export function downscale(src: Rgba, factor: number): Sheet {
  if (factor <= 1) return { w: src.width, h: src.height, data: src.data }
  const w = Math.floor(src.width / factor)
  const h = Math.floor(src.height / factor)
  const out = new Uint8Array(w * h * 4)
  const s = src.data
  const area = factor * factor
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sa = 0
      let sr = 0
      let sg = 0
      let sb = 0
      for (let dy = 0; dy < factor; dy++) {
        let i = ((y * factor + dy) * src.width + x * factor) * 4
        for (let dx = 0; dx < factor; dx++, i += 4) {
          const a = s[i + 3]
          sa += a
          sr += s[i] * a
          sg += s[i + 1] * a
          sb += s[i + 2] * a
        }
      }
      const o = (y * w + x) * 4
      if (sa > 0) {
        out[o] = Math.round(sr / sa)
        out[o + 1] = Math.round(sg / sa)
        out[o + 2] = Math.round(sb / sa)
        out[o + 3] = Math.round(sa / area)
      }
    }
  }
  return { w, h, data: out }
}

/** The sprite scale for a tank of `h` pixels: full-size sprites once the tank is tall enough for them. */
export function scaleForHeight(h: number): number {
  return h >= 300 ? 1 : 0.5
}

export function buildSprites(raw: RawAssets, scale: number): Sprites {
  const factor = Math.max(1, Math.round(1 / scale))
  const sheets: Record<string, Sheet> = {}
  const frame: Record<string, { w: number; h: number }> = {}
  for (const [key, meta] of Object.entries(raw.manifest.sheets)) {
    const img = raw.sheets[key]
    if (!img) continue
    sheets[key] = downscale(img, factor)
    frame[key] = { w: Math.floor(meta.w / factor), h: Math.floor(meta.h / factor) }
  }
  const propRects: Record<string, Rect> = {}
  for (const [name, [x, y, w, h]] of Object.entries(raw.manifest.props.rects)) {
    propRects[name] = { x: Math.floor(x / factor), y: Math.floor(y / factor), w: Math.max(1, Math.floor(w / factor)), h: Math.max(1, Math.floor(h / factor)) }
  }
  const sw = raw.manifest.seaweed
  return {
    scale: 1 / factor,
    sheets,
    frame,
    props: downscale(raw.props, factor),
    propRects,
    seaweed: downscale(raw.seaweed, factor),
    seaweedFrame: { w: Math.floor(sw.w / factor), h: Math.floor(sw.h / factor), frames: sw.frames },
    states: raw.manifest.states,
    cols: raw.manifest.cols,
  }
}

/** The source rectangle of one frame of a sheet: `(col * w, row * h, w, h)` as the manifest notes. */
export function frameRect(sprites: Sprites, sheetKey: string, state: string, index: number): Rect | undefined {
  const size = sprites.frame[sheetKey]
  const st = sprites.states[state]
  if (!size || !st) return undefined
  const col = Math.max(0, Math.min(st.frames - 1, index)) % sprites.cols
  return { x: col * size.w, y: st.row * size.h, w: size.w, h: size.h }
}
