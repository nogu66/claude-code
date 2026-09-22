// The tank's state and its physics: plain data and pure functions, no $ and no drawing.
// Positions are pixels of the canvas (floats), time is milliseconds, speeds are pixels a second.

export type FishColor = 'parent' | 'blue' | 'orange' | 'green' | 'purple'
export type FishState = 'swim' | 'eat' | 'dash' | 'surface' | 'error' | 'spawn' | 'exit'
export type SpriteState = 'swim' | 'eat' | 'dash' | 'error' | 'spawn' | 'exit'
export type Action = 'eat' | 'nest' | 'dash' | 'surface'

export type Fish = {
  id: string
  kind: 'parent' | 'baby'
  color: FishColor
  x: number
  y: number
  vx: number
  vy: number
  dir: 1 | -1
  state: FishState
  stateAt: number
  stateUntil: number
  sinkAt?: number
  target?: { x: number; y: number }
  foodId?: number
  wander?: { x: number; y: number; until: number }
  bubble?: { text: string; until: number }
  phase: number
  bornAt: number
  overflow: boolean
  gone: boolean
}

export type Food = { id: number; x: number; y: number; vy: number; landedAt?: number; eaten: boolean }
export type Bubble = { x: number; y: number; size: 'l' | 'm' | 's'; vy: number; phase: number }

export type World = {
  w: number
  h: number
  scale: number
  sandH: number
  now: number
  fish: Fish[]
  food: Food[]
  bubbles: Bubble[]
  nests: number[]
  water: number
  waterTarget: number
  light: number
  lightTarget: number
  seaweed: { x: number; phase: number }[]
  typeColors: Record<string, FishColor>
  nextAmbient: number
  nextFoodId: number
}

export const PARENT_ID = 'main'
export const MAX_BABIES = 12
export const MAX_NESTS = 24
export const SPRITE = { parent: { w: 160, h: 80 }, baby: { w: 96, h: 48 } } as const
export const FRAME_MS: Record<SpriteState, number> = { swim: 120, eat: 150, dash: 70, error: 150, spawn: 150, exit: 220 }
export const DURATION = { eat: 3000, chew: 500, dash: 1200, surface: 2200, errorShake: 600, errorSink: 2000, spawn: 600, exit: 2600, bubble: 1500, foodRest: 1200 } as const

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

export function fishSize(world: World, fish: Fish): { w: number; h: number } {
  const s = SPRITE[fish.kind]
  return { w: s.w * world.scale, h: s.h * world.scale }
}
export const floorY = (world: World) => world.h - world.sandH
export const waterlineY = (world: World) => Math.round(floorY(world) * (1 - world.water))

/** Water level for a context fill: full at 0%, down to 30% of the tank at 100%. */
export function waterLevelFor(percent: number | undefined): number {
  const p = clamp(percent ?? 0, 0, 100)
  return 1 - 0.7 * (p / 100)
}

function seaweedFor(w: number): { x: number; phase: number }[] {
  const spots = [{ x: 0.08, phase: 0 }, { x: 0.86, phase: 1 }, { x: 0.58, phase: 2 }]
  return spots.slice(0, w >= 400 ? 3 : 2).map(s => ({ x: Math.round(s.x * w), phase: s.phase }))
}

function makeFish(id: string, kind: Fish['kind'], color: FishColor, x: number, y: number, now: number, phase: number): Fish {
  return { id, kind, color, x, y, vx: 0, vy: 0, dir: 1, state: 'swim', stateAt: now, stateUntil: 0, phase, bornAt: now, overflow: false, gone: false }
}

export function createWorld(w: number, h: number, scale: number, now: number): World {
  const sandH = Math.max(6, Math.round(h * 0.09))
  const world: World = {
    w, h, scale, sandH, now,
    fish: [], food: [], bubbles: [], nests: [],
    water: 1, waterTarget: 1, light: 0, lightTarget: 0,
    seaweed: seaweedFor(w), typeColors: {}, nextAmbient: now + 800, nextFoodId: 1,
  }
  world.fish.push(makeFish(PARENT_ID, 'parent', 'parent', w / 2, (h - sandH) / 2, now, 0))
  return world
}

/** Fits the world to a new canvas: every position scales with it, the sand and weeds are re-seated. */
export function resizeWorld(world: World, w: number, h: number, scale: number): void {
  const fx = w / world.w
  const fy = h / world.h
  for (const f of world.fish) {
    f.x *= fx
    f.y *= fy
    f.wander = undefined
    if (f.target) f.target = { x: f.target.x * fx, y: f.target.y * fy }
  }
  for (const f of world.food) { f.x *= fx; f.y *= fy }
  for (const b of world.bubbles) { b.x *= fx; b.y *= fy }
  world.nests = world.nests.map(x => x * fx)
  world.w = w
  world.h = h
  world.scale = scale
  world.sandH = Math.max(6, Math.round(h * 0.09))
  world.seaweed = seaweedFor(w)
}

export const parentOf = (world: World): Fish | undefined => world.fish.find(f => f.id === PARENT_ID)
export const findFish = (world: World, id: string): Fish | undefined => world.fish.find(f => f.id === id && !f.gone)
export const drawnBabies = (world: World): Fish[] => world.fish.filter(f => f.kind === 'baby' && !f.overflow && !f.gone)
export const overflowCount = (world: World): number => world.fish.filter(f => f.kind === 'baby' && f.overflow && !f.gone).length

/** Which colour a subagent type wears: Explore blue, general-purpose orange, then green, then purple for the rest. */
export function colorForType(world: World, type: string): FishColor {
  const known = world.typeColors[type]
  if (known) return known
  const color: FishColor = type === 'Explore' ? 'blue' : type === 'general-purpose' ? 'orange' : Object.keys(world.typeColors).filter(t => t !== 'Explore' && t !== 'general-purpose').length === 0 ? 'green' : 'purple'
  world.typeColors[type] = color
  return color
}

/** A baby for a subagent id: born beside the parent with the spawn animation, or held back past MAX_BABIES. */
export function addBaby(world: World, id: string, color: FishColor, now: number, rand = Math.random): Fish {
  const existing = findFish(world, id)
  if (existing) return existing
  const parent = parentOf(world)
  const px = parent?.x ?? world.w / 2
  const py = parent?.y ?? world.h / 2
  const fish = makeFish(id, 'baby', color, px + (rand() - 0.5) * 80 * world.scale, py + (rand() - 0.5) * 40 * world.scale, now, rand() * Math.PI * 2)
  fish.dir = parent?.dir ?? 1
  if (drawnBabies(world).length >= MAX_BABIES) {
    fish.overflow = true
  } else {
    fish.state = 'spawn'
    fish.stateAt = now
    fish.stateUntil = now + DURATION.spawn
  }
  world.fish.push(fish)
  return fish
}

/** Sends a fish off the nearest edge with the exit animation; a held-back one just leaves. */
export function exitFish(world: World, id: string, now: number): void {
  const fish = findFish(world, id)
  if (!fish || fish.kind !== 'baby' || fish.state === 'exit') return
  if (fish.overflow) {
    fish.gone = true
    return
  }
  const { w } = fishSize(world, fish)
  fish.state = 'exit'
  fish.stateAt = now
  fish.stateUntil = now + DURATION.exit
  fish.target = { x: fish.x < world.w / 2 ? -w : world.w + w, y: fish.y }
  fish.foodId = undefined
  fish.bubble = undefined
}

export function setBubble(fish: Fish, text: string, now: number): void {
  fish.bubble = { text, until: now + DURATION.bubble }
}

function spitBubbles(world: World, fish: Fish, rand: () => number): void {
  const { w, h } = fishSize(world, fish)
  const mouthX = fish.x + fish.dir * w * 0.45
  const sizes: Bubble['size'][] = ['s', 'm', 'l']
  for (let i = 0; i < 3; i++) {
    world.bubbles.push({ x: mouthX + (rand() - 0.5) * 6 * world.scale, y: fish.y - h * 0.1 - i * 4 * world.scale, size: sizes[i], vy: (22 + rand() * 12) * world.scale, phase: rand() * Math.PI * 2 })
  }
}

/** Puts a fish into the animation a tool call asks for; spawn, exit and error are not interrupted. */
export function startAction(world: World, fish: Fish, action: Action, now: number, rand = Math.random): void {
  if (fish.gone || fish.overflow || fish.state === 'spawn' || fish.state === 'exit' || fish.state === 'error') return
  const { w } = fishSize(world, fish)
  switch (action) {
    case 'eat': {
      const id = world.nextFoodId++
      const x = clamp(fish.x + (rand() - 0.5) * world.w * 0.35, 8, world.w - 8)
      world.food.push({ id, x, y: waterlineY(world) + 2, vy: 10 * world.scale, eaten: false })
      fish.state = 'eat'
      fish.stateAt = now
      fish.stateUntil = now + DURATION.eat
      fish.foodId = id
      break
    }
    case 'nest': {
      spitBubbles(world, fish, rand)
      world.nests.push(clamp(fish.x + (rand() - 0.5) * 60 * world.scale, w * 0.3, world.w - w * 0.3))
      if (world.nests.length > MAX_NESTS) world.nests.shift()
      break
    }
    case 'dash': {
      fish.state = 'dash'
      fish.stateAt = now
      fish.stateUntil = now + DURATION.dash
      const far = fish.x < world.w / 2 ? world.w - w : w
      fish.wander = { x: far, y: clamp(fish.y + (rand() - 0.5) * world.h * 0.3, 0, world.h), until: now + DURATION.dash }
      break
    }
    case 'surface': {
      fish.state = 'surface'
      fish.stateAt = now
      fish.stateUntil = now + DURATION.surface
      fish.target = { x: clamp(fish.x + (rand() - 0.5) * 40 * world.scale, w / 2, world.w - w / 2), y: 0 }
      break
    }
  }
}

/** The error animation: a shake in place, then a sink, then back to swimming. */
export function setError(world: World, fish: Fish, now: number): void {
  if (fish.gone || fish.overflow || fish.state === 'spawn' || fish.state === 'exit') return
  fish.state = 'error'
  fish.stateAt = now
  fish.sinkAt = now + DURATION.errorShake
  fish.stateUntil = now + DURATION.errorShake + DURATION.errorSink
  fish.foodId = undefined
  fish.target = undefined
  fish.vx = 0
  fish.vy = 0
}

export function setWaterTarget(world: World, level: number): void {
  world.waterTarget = clamp(level, 0.2, 1)
}
export function setLight(world: World, on: boolean): void {
  world.lightTarget = on ? 1 : 0
}

/** The sheet row and frame index a fish shows now. */
export function spriteFrame(fish: Fish, now: number): { state: SpriteState; index: number } {
  const elapsed = Math.max(0, now - fish.stateAt)
  switch (fish.state) {
    case 'spawn': return { state: 'spawn', index: Math.min(3, Math.floor(elapsed / FRAME_MS.spawn)) }
    case 'exit': return { state: 'exit', index: Math.min(3, Math.floor((elapsed / DURATION.exit) * 4)) }
    case 'error': return { state: 'error', index: fish.sinkAt !== undefined && now >= fish.sinkAt ? 3 : Math.floor(elapsed / FRAME_MS.error) % 4 }
    case 'eat': return { state: 'eat', index: Math.floor(elapsed / FRAME_MS.eat) % 4 }
    case 'dash': return { state: 'dash', index: Math.floor(elapsed / FRAME_MS.dash) % 4 }
    default: return { state: 'swim', index: Math.floor((now + fish.phase * 1000) / FRAME_MS.swim) % 6 }
  }
}

function speedOf(world: World, fish: Fish): number {
  const base = clamp(world.w * 0.09, 24, 90)
  return fish.kind === 'parent' ? base : base * 1.35
}

// steers toward a point; returns true once within reach
function steer(fish: Fish, tx: number, ty: number, speed: number, dt: number, reach: number): boolean {
  const dx = tx - fish.x
  const dy = ty - fish.y
  const d = Math.hypot(dx, dy)
  if (d < 0.5) {
    fish.vx *= 0.7
    fish.vy *= 0.7
    return true
  }
  const k = Math.min(1, 4 * dt)
  fish.vx += ((dx / d) * speed - fish.vx) * k
  fish.vy += ((dy / d) * speed - fish.vy) * k
  return d <= reach
}

function pickWander(world: World, fish: Fish, minY: number, maxY: number, now: number, rand: () => number): void {
  const { w } = fishSize(world, fish)
  let x: number
  let y: number
  if (fish.kind === 'parent') {
    x = world.w * (0.2 + rand() * 0.6)
    y = minY + (maxY - minY) * (0.25 + rand() * 0.5)
  } else {
    const parent = parentOf(world)
    const cx = parent?.x ?? world.w / 2
    const cy = parent?.y ?? (minY + maxY) / 2
    x = cx + (rand() - 0.5) * world.w * 0.55
    y = cy + (rand() - 0.5) * (maxY - minY) * 0.7
  }
  fish.wander = { x: clamp(x, w / 2, world.w - w / 2), y: clamp(y, minY, maxY), until: now + 1800 + rand() * 3200 }
}

/** Advances the tank to `now`. Deterministic given `rand`. */
export function step(world: World, now: number, rand = Math.random): void {
  const dt = clamp((now - world.now) / 1000, 0, 0.2)
  world.now = now
  world.water += clamp(world.waterTarget - world.water, -0.2 * dt, 0.2 * dt)
  world.light += clamp(world.lightTarget - world.light, -2.5 * dt, 2.5 * dt)
  const top = waterlineY(world)
  const floor = floorY(world)

  for (const fish of world.fish) {
    if (fish.gone || fish.overflow) continue
    const { w: sw, h: sh } = fishSize(world, fish)
    const minY = top + sh / 2 + 2
    const maxY = floor - sh / 2
    const speed = speedOf(world, fish)
    const reach = 6 * world.scale + speed * dt

    switch (fish.state) {
      case 'spawn':
        fish.vx = 0
        fish.vy = -4 * world.scale
        if (now >= fish.stateUntil) { fish.state = 'swim'; fish.stateAt = now }
        break
      case 'exit':
        if (fish.target) steer(fish, fish.target.x, fish.target.y, speed * 1.6, dt, reach)
        if (now >= fish.stateUntil || fish.x < -sw || fish.x > world.w + sw) fish.gone = true
        break
      case 'error':
        if (fish.sinkAt !== undefined && now < fish.sinkAt) {
          fish.vx = 0
          fish.vy = 0
        } else {
          fish.vx *= 0.9
          fish.vy = 26 * world.scale
        }
        if (now >= fish.stateUntil) { fish.state = 'swim'; fish.stateAt = now; fish.vy = 0; fish.sinkAt = undefined }
        break
      case 'eat': {
        const food = fish.foodId === undefined ? undefined : world.food.find(f => f.id === fish.foodId && !f.eaten)
        if (food) {
          if (steer(fish, food.x, food.y, speed * 1.5, dt, reach)) {
            food.eaten = true
            fish.foodId = undefined
            fish.stateUntil = now + DURATION.chew
          }
        } else if (now >= fish.stateUntil) {
          fish.state = 'swim'
          fish.stateAt = now
          fish.foodId = undefined
        } else if (fish.foodId !== undefined) {
          // the pellet is gone: give up on it
          fish.foodId = undefined
          fish.stateUntil = now + DURATION.chew
        } else {
          fish.vx *= 0.9
          fish.vy *= 0.9
        }
        break
      }
      case 'surface':
        if (fish.target) steer(fish, fish.target.x, minY, speed * 1.2, dt, reach)
        if (now >= fish.stateUntil) { fish.state = 'swim'; fish.stateAt = now; fish.target = undefined }
        break
      case 'dash':
      case 'swim': {
        const dash = fish.state === 'dash'
        if (!fish.wander || now > fish.wander.until) pickWander(world, fish, minY, maxY, now, rand)
        const target = fish.wander
        if (target) {
          const reached = steer(fish, target.x, target.y, dash ? speed * 3 : speed, dt, reach)
          if (reached) pickWander(world, fish, minY, maxY, now, rand)
        }
        fish.vy += Math.cos(now / 450 + fish.phase) * 14 * world.scale * dt
        if (dash && now >= fish.stateUntil) { fish.state = 'swim'; fish.stateAt = now; fish.wander = undefined }
        break
      }
    }

    fish.x += fish.vx * dt
    fish.y += fish.vy * dt
    if (fish.state !== 'exit') fish.x = clamp(fish.x, sw / 2, world.w - sw / 2)
    fish.y = clamp(fish.y, minY, maxY)
    if (Math.abs(fish.vx) > 2) fish.dir = fish.vx > 0 ? 1 : -1
    if (fish.bubble && now >= fish.bubble.until) fish.bubble = undefined
  }

  // a fish that left frees a place for one that was held back
  world.fish = world.fish.filter(f => !f.gone)
  let room = MAX_BABIES - drawnBabies(world).length
  for (const f of world.fish) {
    if (room <= 0) break
    if (f.kind === 'baby' && f.overflow) {
      f.overflow = false
      f.state = 'spawn'
      f.stateAt = now
      f.stateUntil = now + DURATION.spawn
      const parent = parentOf(world)
      f.x = clamp((parent?.x ?? world.w / 2) + (rand() - 0.5) * 60 * world.scale, 0, world.w)
      f.y = clamp(parent?.y ?? world.h / 2, top, floor)
      room--
    }
  }

  for (const food of world.food) {
    if (food.eaten) continue
    if (food.landedAt === undefined) {
      food.vy += 30 * world.scale * dt
      food.y += food.vy * dt
      if (food.y >= floor - 3 * world.scale) {
        food.y = floor - 3 * world.scale
        food.landedAt = now
      }
    } else if (now - food.landedAt > DURATION.foodRest) {
      food.eaten = true
    }
  }
  world.food = world.food.filter(f => !f.eaten)

  for (const b of world.bubbles) {
    b.y -= b.vy * dt
    b.x += Math.sin(now / 300 + b.phase) * 10 * world.scale * dt
  }
  world.bubbles = world.bubbles.filter(b => b.y > top + 1)
  if (now >= world.nextAmbient) {
    const sizes: Bubble['size'][] = ['s', 's', 'm']
    world.bubbles.push({ x: 4 + rand() * (world.w - 8), y: floor, size: sizes[Math.floor(rand() * sizes.length)], vy: (18 + rand() * 14) * world.scale, phase: rand() * Math.PI * 2 })
    world.nextAmbient = now + 700 + rand() * 1600
  }
}
