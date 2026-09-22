/* @jsx h */
import type { EngineInterface, Register, Timer } from 'claude-code'
import { agentDone, applyTool, birth, syncAgents } from './aquarium/events.ts'
import { decodePng, encodePng, fromBase64, toBase64, type Rgba } from './aquarium/png.ts'
import { createCanvas, drawWorld, toHalfBlocks, type Canvas } from './aquarium/render.ts'
import { buildSprites, isManifest, scaleForHeight, type RawAssets, type Sprites } from './aquarium/sprites.ts'
import { createWorld, drawnBabies, overflowCount, PARENT_ID, resizeWorld, setLight, setWaterTarget, step, waterLevelFor, type World } from './aquarium/world.ts'

// Agent Aquarium: the session as a fish tank in a pane. The main loop is the parent fish,
// each subagent a baby, each tool call an animation. This module only wires the session's
// events to the pure world (./aquarium/world.ts, events.ts) and the compositor
// (render.ts); it is observation only, every tool.call hook returns what next(e) gave it.
//
// Drawing: a keyed <Image> in the pane, swapped `fps` times a second by $.ui.blit with a PNG the
// compositor made (the terminal shows it through the kitty graphics protocol). A terminal
// without images refuses the blit, and the pane falls back to a <Raster> of half blocks.

const PANE = 'aquarium'
const KEY = 'tank'
const CELL_W = 8
const CELL_H = 16
const DEFAULT_FPS = 12
const MIN_FPS = 2
const MAX_FPS = 20
const AGENT_POLL_MS = 2000
const MAX_CELLS = 255
const FALLBACK_AFTER = 3
const ROWS_NORMAL = 12
const ROWS_FULL = 28
const COLUMNS_FULL = 140

type Mode = 'kitty' | 'raster'

const state = {
  active: false,
  full: false,
  mode: 'kitty' as Mode,
  forcedMode: undefined as Mode | undefined,
  cols: 0,
  rows: 0,
  raw: undefined as RawAssets | undefined,
  loading: undefined as Promise<RawAssets | undefined> | undefined,
  sprites: undefined as Sprites | undefined,
  world: undefined as World | undefined,
  canvas: undefined as Canvas | undefined,
  ticker: undefined as Timer | undefined,
  poller: undefined as Timer | undefined,
  busy: false,
  mounted: false,
  denies: 0,
  frames: 0,
  lastBytes: 0,
  encodeMs: 0,
  loggedTickError: false,
  fps: DEFAULT_FPS,
  // the picture last handed to the pane: a re-render returns it unchanged, so only blits move the tank
  last: undefined as { mode: Mode; cols: number; rows: number; png?: string; cells?: string } | undefined,
}

const log = ($: EngineInterface, text: string, debug = false) => $.ui.log(`agent-aquarium: ${text}`, debug ? { to: 'debug' } : undefined)

async function readPng($: EngineInterface, path: string): Promise<Rgba> {
  const { base64 } = await $.fs.read(path, { as: 'bytes' })
  return decodePng(fromBase64(base64))
}

// the sheets, decoded once per session; a failure is logged and leaves the tank closed
async function loadAssets($: EngineInterface): Promise<RawAssets | undefined> {
  if (state.raw) return state.raw
  if (state.loading) return state.loading
  state.loading = (async () => {
    try {
      const dir = `${$.plugin.root}/assets`
      const manifest: unknown = JSON.parse(await $.fs.read(`${dir}/manifest.json`))
      if (!isManifest(manifest)) throw new Error('manifest.json has not the expected shape')
      const sheets: Record<string, Rgba> = {}
      for (const [key, meta] of Object.entries(manifest.sheets)) sheets[key] = await readPng($, `${dir}/${meta.file}`)
      const props = await readPng($, `${dir}/${manifest.props.file}`)
      const seaweed = await readPng($, `${dir}/${manifest.seaweed.file}`)
      state.raw = { manifest, sheets, props, seaweed }
      return state.raw
    } catch (err) {
      log($, `could not load the sprites: ${err}`)
      return undefined
    } finally {
      state.loading = undefined
    }
  })()
  return state.loading
}

// fits the world and the sprites to the pane's body; a new size resizes, a new scale rebuilds the sheets
function applyView(cols: number, rows: number): void {
  cols = Math.max(20, Math.min(MAX_CELLS, cols))
  rows = Math.max(5, Math.min(MAX_CELLS, rows))
  const w = cols * CELL_W
  const h = rows * CELL_H
  const scale = scaleForHeight(h)
  const now = Date.now()
  if (state.raw && (!state.sprites || state.sprites.scale !== scale)) state.sprites = buildSprites(state.raw, scale)
  if (!state.world) state.world = createWorld(w, h, scale, now)
  else if (state.world.w !== w || state.world.h !== h || state.world.scale !== scale) resizeWorld(state.world, w, h, scale)
  if (!state.canvas || state.canvas.w !== w || state.canvas.h !== h) state.canvas = createCanvas(w, h)
  state.cols = cols
  state.rows = rows
}

function renderFrame(now: number): Canvas | undefined {
  if (!state.world || !state.sprites || !state.canvas) return undefined
  step(state.world, now)
  drawWorld(state.canvas, state.world, state.sprites, now)
  return state.canvas
}

function pngSource(canvas: Canvas): { png: string } {
  const t0 = Date.now()
  const png = encodePng(canvas.data, canvas.w, canvas.h)
  state.encodeMs = Date.now() - t0
  state.lastBytes = png.length
  return { png: toBase64(png) }
}

function rasterCells(canvas: Canvas): string {
  return toBase64(toHalfBlocks(canvas, state.cols, state.rows))
}

// one frame: advance, draw, hand the pane its next picture. A refused blit while the pane is
// mounted means the terminal shows no images: switch to half blocks and redraw once.
async function tick($: EngineInterface): Promise<void> {
  if (!state.active || !state.mounted || state.busy) return
  state.busy = true
  try {
    const canvas = renderFrame(Date.now())
    if (!canvas) return
    const png = state.mode === 'kitty' ? pngSource(canvas).png : undefined
    const cells = state.mode === 'kitty' ? undefined : rasterCells(canvas)
    const result = png !== undefined
      ? await $.ui.blit({ requestId: PANE, key: KEY, source: { png } })
      : await $.ui.blit({ requestId: PANE, key: KEY, cells: cells ?? '' })
    if (result.deny === undefined) {
      state.denies = 0
      state.frames++
      state.last = { mode: state.mode, cols: state.cols, rows: state.rows, png, cells }
      return
    }
    state.denies++
    if (state.denies === 1) log($, `blit refused: ${result.deny}`, true)
    if (state.denies >= FALLBACK_AFTER && state.mode === 'kitty' && state.forcedMode === undefined) {
      state.mode = 'raster'
      state.denies = 0
      log($, 'this terminal shows no images here; drawing the tank with half blocks (/aquarium mode kitty to retry)')
      $.ui.invalidate('ui.render')
    }
  } catch (err) {
    if (!state.loggedTickError) {
      state.loggedTickError = true
      log($, `frame failed: ${err}`, true)
    }
  } finally {
    state.busy = false
  }
}

async function pollAgents($: EngineInterface): Promise<void> {
  if (!state.active || !state.world) return
  try {
    const agents = await $.agent.list()
    syncAgents(state.world, agents, Date.now())
  } catch (err) {
    log($, `agent list failed: ${err}`, true)
  }
}

const clampFps = (fps: number) => Math.max(MIN_FPS, Math.min(MAX_FPS, Math.round(fps)))

function startTimers($: EngineInterface): void {
  state.ticker ??= $.clock.every(Math.round(1000 / state.fps), () => { void tick($) })
  state.poller ??= $.clock.every(AGENT_POLL_MS, () => { void pollAgents($) })
}

function setFps($: EngineInterface, fps: number): void {
  state.fps = clampFps(fps)
  if (state.ticker) {
    state.ticker.cancel()
    state.ticker = undefined
    startTimers($)
  }
}

function stopTimers(): void {
  state.ticker?.cancel()
  state.poller?.cancel()
  state.ticker = undefined
  state.poller = undefined
}

async function openTank($: EngineInterface, full: boolean): Promise<string> {
  const raw = await loadAssets($)
  if (!raw) return 'aquarium: the sprites under assets/ could not be read; see the transcript line above'
  state.full = full
  state.active = true
  state.mounted = false
  state.denies = 0
  state.mode = state.forcedMode ?? 'kitty'
  await $.ui.open(full ? { id: PANE, title: 'aquarium', rows: ROWS_FULL, columns: COLUMNS_FULL } : { id: PANE, title: 'aquarium', rows: ROWS_NORMAL })
  $.ui.invalidate('ui.render')
  startTimers($)
  await $.store.set('autoOpen', true).catch(() => undefined)
  void pollAgents($)
  return `aquarium ${full ? 'full' : 'on'} · /aquarium off closes · /aquarium status`
}

async function closeTank($: EngineInterface, remember: boolean): Promise<void> {
  state.active = false
  state.mounted = false
  stopTimers()
  if (remember) await $.store.set('autoOpen', false).catch(() => undefined)
  await $.ui.close({ id: PANE }).catch(() => undefined)
}

function statusText(): string {
  const w = state.world
  const fish = w ? drawnBabies(w).length : 0
  const extra = w ? overflowCount(w) : 0
  return [
    `aquarium ${state.active ? (state.full ? 'full' : 'on') : 'off'} · mode ${state.mode}${state.forcedMode ? ' (forced)' : ''} · ${state.fps} fps`,
    `pane ${state.cols}x${state.rows} cells · canvas ${w?.w ?? 0}x${w?.h ?? 0} px · sprites x${state.sprites?.scale ?? 0}`,
    `babies ${fish}${extra ? ` (+${extra} waiting)` : ''} · nests ${w?.nests.length ?? 0} · water ${Math.round((w?.water ?? 1) * 100)}%`,
    `frames ${state.frames} · last png ${Math.round(state.lastBytes / 1024)} KB in ${state.encodeMs} ms`,
  ].join('\n')
}

export const register: Register = (on, options) => {
  if (typeof options.fps === 'number') state.fps = clampFps(options.fps)

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command.register({
      name: 'aquarium',
      description: 'A fish tank of this session: the main loop, its subagents and their tool calls (agent-aquarium)',
      argumentHint: '[on | off | full | status | fps N | mode kitty|raster]',
      immediate: true,
    }).catch(err => log($, `/aquarium not registered: ${err}`))
    const surfaces = await $.session.surfaces().catch(() => [] as readonly string[])
    if (!surfaces.includes('terminal')) return r
    const fps = await $.store.get('fps').catch(() => undefined)
    if (typeof fps === 'number') state.fps = clampFps(fps)
    const autoOpen = await $.store.get('autoOpen').catch(() => undefined)
    if (autoOpen === true) {
      // reopen where it was left on; the surface may hold it until the terminal is wide enough
      void openTank($, false).catch(err => log($, `could not reopen: ${err}`, true))
    }
    return r
  })

  on('command.run', { command: 'aquarium' }, async ($, e) => {
    const [word = '', rest = ''] = e.args.trim().toLowerCase().split(/\s+/, 2)
    if (word === 'status') return { text: statusText() }
    if (word === 'fps') {
      const n = Number(rest)
      if (!Number.isFinite(n)) return { text: `aquarium: ${state.fps} fps · /aquarium fps N sets it (${MIN_FPS}-${MAX_FPS})` }
      setFps($, n)
      await $.store.set('fps', state.fps).catch(() => undefined)
      return { text: `aquarium: ${state.fps} fps` }
    }
    if (word === 'mode') {
      if (rest === 'kitty' || rest === 'raster') {
        state.forcedMode = rest
        state.mode = rest
        state.denies = 0
        $.ui.invalidate('ui.render')
        return { text: `aquarium: drawing mode ${rest}` }
      }
      state.forcedMode = undefined
      return { text: 'aquarium: /aquarium mode kitty|raster forces a drawing mode; the automatic choice is back' }
    }
    // a bare /aquarium closes only a tank that is on screen: one reopened at session.start may still be waiting unplaced
    if (word === 'off' || word === 'stop' || word === 'close' || (word === '' && state.active && state.mounted && !state.full)) {
      await closeTank($, true)
      return { text: 'aquarium off' }
    }
    if (word === 'full') return { text: await openTank($, true) }
    if (word === '' || word === 'on' || word === 'normal' || word === 'small') return { text: await openTank($, false) }
    return { text: `aquarium: no "${word}" · on, off, full, status, fps N, mode kitty|raster` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    if (e.surface !== 'terminal') {
      const { Text } = $.ui.resolve(e)
      return <Text dimColor>agent-aquarium draws in the terminal</Text>
    }
    const { Box, Image, Raster, Text } = $.ui.resolve(e)
    if (!state.active || !state.raw) return <Text dimColor>aquarium · /aquarium on</Text>
    const cols = e.props.bodyColumns > 0 ? e.props.bodyColumns : (e.viewport?.columns ?? 80)
    const rows = e.props.scroll.bodyRows > 0 ? e.props.scroll.bodyRows : Math.max(8, Math.floor((e.viewport?.rows ?? 30) / 3))
    applyView(cols, rows)
    state.mounted = true
    // the engine re-runs this hook on its own occasions (a spinner, a resize, a new row); the same
    // picture as the last blit keeps those re-runs from swapping the image under the frame clock
    const last = state.last
    const reuse = last !== undefined && last.mode === state.mode && last.cols === state.cols && last.rows === state.rows
    let png: string | undefined = reuse ? last.png : undefined
    let cells: string | undefined = reuse ? last.cells : undefined
    if ((state.mode === 'kitty' && png === undefined) || (state.mode === 'raster' && cells === undefined)) {
      const canvas = renderFrame(Date.now())
      if (!canvas) return <Text dimColor>aquarium · loading</Text>
      if (state.mode === 'kitty') png = pngSource(canvas).png
      else cells = rasterCells(canvas)
      state.last = { mode: state.mode, cols: state.cols, rows: state.rows, png, cells }
    }
    if (state.mode === 'kitty' && png !== undefined) {
      return (
        <Box flexDirection="column">
          <Image key={KEY} source={{ png }} columns={state.cols} rows={state.rows} alt="aquarium: this terminal shows no images; /aquarium mode raster draws it with blocks" />
        </Box>
      )
    }
    return (
      <Box flexDirection="column">
        <Raster key={KEY} columns={state.cols} rows={state.rows} cells={cells ?? ''} />
      </Box>
    )
  })

  // the person closed the pane (its mark, or ctrl+x x): stop drawing, and do not reopen next session
  on('ui.close', { id: PANE }, async ($, e, next) => {
    const r = await next(e)
    if (state.active) {
      state.active = false
      state.mounted = false
      stopTimers()
      if (e.origin.kind === 'person') await $.store.set('autoOpen', false).catch(() => undefined)
    }
    return r
  })

  // observation only: the call runs first, and only its outcome (which tool, error or not) moves a fish
  on('tool.call', async ($, e, next) => {
    const r = await next(e)
    if (state.active && state.world) {
      try {
        const isError = r.deny !== undefined || r.isError === true
        const fishId = e.agentId ?? PARENT_ID
        if (e.tool !== 'Agent' || e.agentId !== undefined) {
          const known = state.world.fish.some(f => f.id === fishId)
          applyTool(state.world, fishId, e.tool, e as unknown as Record<string, unknown>, isError, Date.now())
          if (!known && e.agentId !== undefined) void pollAgents($)
        }
      } catch (err) {
        log($, `tool event failed: ${err}`, true)
      }
    }
    return r
  }).catch(($, e, next) => next(e))

  // a subagent started: born at once, in the colour of its type
  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    if (state.active && state.world && r.agentId !== undefined) {
      birth(state.world, r.agentId, e.subagentType, Date.now())
      log($, `born ${r.agentId} (${e.subagentType}) · babies ${drawnBabies(state.world).length}, waiting ${overflowCount(state.world)}`, true)
    }
    return r
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    if (state.world) setLight(state.world, true)
    return next(e)
  })

  // the main loop's turn ended: lights down; a subagent's: it swims off
  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (state.world) {
      if (e.agentId !== undefined) {
        agentDone(state.world, e.agentId, Date.now())
        log($, `left ${e.agentId} · babies ${drawnBabies(state.world).length}, waiting ${overflowCount(state.world)}`, true)
      } else setLight(state.world, false)
    }
    return r
  })

  // the context window's fill is the water level
  on('session.measure', async ($, e, next) => {
    const r = await next(e)
    if (state.world && e.changed.includes('context')) setWaterTarget(state.world, waterLevelFor(e.context.percent))
    return r
  })

  // a compaction refills the tank
  on('session.compact', async ($, e, next) => {
    const r = await next(e)
    if (state.world && r.skip === undefined && e.trigger !== 'precompute') setWaterTarget(state.world, 1)
    return r
  })

  // no picture may outlive the session: close the pane so the surface deletes its placements
  on('session.end', async ($, e, next) => {
    const r = await next(e)
    if (state.active) await closeTank($, false).catch(() => undefined)
    return r
  })
}
