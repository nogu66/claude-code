// Renders a few frames of a staged tank to PNG files, for a look at the compositor outside
// Claude Code: `bun run tools/preview.ts [outDir]`. Reads the sprites with node's fs.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { applyTool, birth } from '../hooks/aquarium/events.ts'
import { decodePng, encodePng } from '../hooks/aquarium/png.ts'
import { createCanvas, drawWorld, toHalfBlocks } from '../hooks/aquarium/render.ts'
import { buildSprites, isManifest, scaleForHeight, type RawAssets } from '../hooks/aquarium/sprites.ts'
import { createWorld, setError, setLight, setWaterTarget, step } from '../hooks/aquarium/world.ts'

const ASSETS = new URL('../assets/', import.meta.url).pathname
const outDir = process.argv[2] ?? new URL('../docs/', import.meta.url).pathname
mkdirSync(outDir, { recursive: true })

const manifest: unknown = JSON.parse(readFileSync(`${ASSETS}manifest.json`, 'utf8'))
if (!isManifest(manifest)) throw new Error('bad manifest')
const png = (f: string) => decodePng(new Uint8Array(readFileSync(`${ASSETS}${f}`)))
const raw: RawAssets = { manifest, sheets: {}, props: png(manifest.props.file), seaweed: png(manifest.seaweed.file) }
for (const [k, m] of Object.entries(manifest.sheets)) raw.sheets[k] = png(m.file)

let seed = 7
const rand = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296 }

for (const [cols, rows] of [[80, 12], [140, 28]] as const) {
  const w = cols * 8
  const h = rows * 16
  const scale = scaleForHeight(h)
  const sprites = buildSprites(raw, scale)
  let now = 1_000_000
  const world = createWorld(w, h, scale, now)
  const canvas = createCanvas(w, h)
  setLight(world, true)
  setWaterTarget(world, 0.7)
  world.water = 0.7
  for (let i = 0; i < 40; i++) { now += 66; step(world, now, rand) }
  birth(world, 'a1', 'Explore', now, rand)
  birth(world, 'a2', 'general-purpose', now, rand)
  birth(world, 'a3', 'Plan', now, rand)
  birth(world, 'a4', 'codex:rescue', now, rand)
  birth(world, 'a5', 'Explore', now, rand)
  for (let i = 0; i < 12; i++) { now += 66; step(world, now, rand) }
  applyTool(world, 'main', 'Edit', { file_path: '/src/auth.ts' }, false, now, rand)
  applyTool(world, 'a1', 'Grep', { pattern: 'TODO' }, false, now, rand)
  applyTool(world, 'a2', 'Bash', { command: 'bun test' }, false, now, rand)
  applyTool(world, 'a3', 'WebFetch', { url: 'https://docs.example.com/x' }, false, now, rand)
  const a4 = world.fish.find(f => f.id === 'a4')
  if (a4) { a4.bubble = { text: 'Bash npm test', until: now + 9000 }; setError(world, a4, now) }
  for (let k = 13; k <= 16; k++) birth(world, `x${k}`, 'Explore', now, rand)
  const t0 = Date.now()
  let frames = 0
  let bytes = 0
  for (let i = 0; i < 20; i++) {
    now += 66
    step(world, now, rand)
    drawWorld(canvas, world, sprites, now)
    const out = encodePng(canvas.data, canvas.w, canvas.h)
    bytes += out.length
    frames++
    if (i === 5 || i === 19) writeFileSync(`${outDir}/preview_frame_${cols}x${rows}_${i}.png`, out)
  }
  const ms = Date.now() - t0
  const cells = toHalfBlocks(canvas, cols, rows)
  console.log(`${cols}x${rows}: canvas ${w}x${h}, sprites x${scale}, ${frames} frames in ${ms} ms (${(ms / frames).toFixed(1)} ms/frame), png ${(bytes / frames / 1024).toFixed(1)} KB avg, raster ${cells.length} bytes`)
}
