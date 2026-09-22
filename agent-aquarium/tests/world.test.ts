import { describe, expect, test } from 'bun:test'
import { addBaby, createWorld, drawnBabies, exitFish, findFish, floorY, MAX_BABIES, overflowCount, PARENT_ID, resizeWorld, setError, spriteFrame, startAction, step, waterLevelFor, waterlineY, type World } from '../hooks/aquarium/world.ts'

const seeded = (s = 1) => () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296 }

function run(world: World, ms: number, rand = seeded()) {
  const end = world.now + ms
  while (world.now < end) step(world, Math.min(end, world.now + 66), rand)
}

function inBounds(world: World) {
  const top = waterlineY(world)
  const floor = floorY(world)
  for (const f of world.fish) {
    if (f.gone || f.overflow || f.state === 'exit') continue
    expect(f.x).toBeGreaterThanOrEqual(0)
    expect(f.x).toBeLessThanOrEqual(world.w)
    expect(f.y).toBeGreaterThanOrEqual(top)
    expect(f.y).toBeLessThanOrEqual(floor)
  }
}

describe('world', () => {
  test('starts with the parent in the middle and full water', () => {
    const w = createWorld(640, 192, 0.5, 0)
    expect(w.fish).toHaveLength(1)
    expect(w.fish[0].id).toBe(PARENT_ID)
    expect(w.water).toBe(1)
    expect(waterlineY(w)).toBe(0)
    expect(w.seaweed).toHaveLength(3)
    expect(createWorld(320, 100, 0.5, 0).seaweed).toHaveLength(2)
  })

  test('the parent wanders and stays inside the water for a minute', () => {
    const w = createWorld(640, 192, 0.5, 0)
    const start = { x: w.fish[0].x, y: w.fish[0].y }
    run(w, 60_000)
    inBounds(w)
    expect(Math.hypot(w.fish[0].x - start.x, w.fish[0].y - start.y)).toBeGreaterThan(20)
  })

  test('water level follows the context fill and eases toward it', () => {
    expect(waterLevelFor(undefined)).toBe(1)
    expect(waterLevelFor(0)).toBe(1)
    expect(waterLevelFor(100)).toBeCloseTo(0.3)
    expect(waterLevelFor(50)).toBeCloseTo(0.65)
    const w = createWorld(640, 192, 0.5, 0)
    w.waterTarget = 0.5
    run(w, 500)
    expect(w.water).toBeLessThan(1)
    expect(w.water).toBeGreaterThan(0.5)
    run(w, 5000)
    expect(w.water).toBeCloseTo(0.5)
    inBounds(w)
  })

  test('babies are born with the spawn animation and swim once it ends', () => {
    const w = createWorld(640, 192, 0.5, 0)
    const b = addBaby(w, 'a1', 'blue', 0, seeded())
    expect(b.state).toBe('spawn')
    expect(spriteFrame(b, 0)).toEqual({ state: 'spawn', index: 0 })
    expect(spriteFrame(b, 500).index).toBe(3)
    run(w, 700)
    expect(findFish(w, 'a1')?.state).toBe('swim')
    expect(addBaby(w, 'a1', 'blue', 700)).toBe(findFish(w, 'a1')!)
  })

  test('past MAX_BABIES the rest wait as a badge and take a place when one leaves', () => {
    const w = createWorld(640, 192, 0.5, 0)
    for (let i = 0; i < MAX_BABIES + 3; i++) addBaby(w, `a${i}`, 'green', 0, seeded(i))
    expect(drawnBabies(w)).toHaveLength(MAX_BABIES)
    expect(overflowCount(w)).toBe(3)
    exitFish(w, 'a0', 0)
    expect(findFish(w, 'a0')?.state).toBe('exit')
    run(w, 3000)
    expect(findFish(w, 'a0')).toBeUndefined()
    expect(drawnBabies(w)).toHaveLength(MAX_BABIES)
    expect(overflowCount(w)).toBe(2)
    // a waiting one asked to leave just goes
    exitFish(w, `a${MAX_BABIES + 2}`, 3000)
    run(w, 100)
    expect(findFish(w, `a${MAX_BABIES + 2}`)).toBeUndefined()
  })

  test('an exiting fish heads off the nearest edge and is removed', () => {
    const w = createWorld(640, 192, 0.5, 0)
    const b = addBaby(w, 'a1', 'blue', 0, seeded())
    run(w, 700)
    b.x = 100
    exitFish(w, 'a1', w.now)
    expect(b.target?.x).toBeLessThan(0)
    expect(spriteFrame(b, w.now + 2500).state).toBe('exit')
    run(w, 3000)
    expect(findFish(w, 'a1')).toBeUndefined()
  })

  test('an error shakes in place, sinks, then swims again', () => {
    const w = createWorld(640, 192, 0.5, 0)
    const p = w.fish[0]
    run(w, 2000)
    const y0 = p.y
    setError(w, p, w.now)
    expect(spriteFrame(p, w.now + 200)).toEqual({ state: 'error', index: 1 })
    run(w, 500)
    expect(Math.abs(p.y - y0)).toBeLessThan(1)
    run(w, 1000)
    expect(spriteFrame(p, w.now).index).toBe(3)
    expect(p.y).toBeGreaterThan(y0 + 5)
    run(w, 1500)
    expect(p.state).toBe('swim')
    inBounds(w)
  })

  test('eating drops a pellet the fish reaches and removes', () => {
    const w = createWorld(640, 192, 0.5, 0)
    const p = w.fish[0]
    startAction(w, p, 'eat', 0, seeded(3))
    expect(w.food).toHaveLength(1)
    expect(p.state).toBe('eat')
    run(w, 4000)
    expect(w.food).toHaveLength(0)
    expect(p.state).toBe('swim')
  })

  test('a nest adds a mound and bubbles; a dash speeds up and ends; the surface is reached', () => {
    const w = createWorld(640, 192, 0.5, 0)
    const p = w.fish[0]
    run(w, 1000)
    startAction(w, p, 'nest', w.now, seeded())
    expect(w.nests).toHaveLength(1)
    expect(w.bubbles.length).toBeGreaterThanOrEqual(3)
    startAction(w, p, 'dash', w.now, seeded())
    expect(p.state).toBe('dash')
    run(w, 400)
    const dashSpeed = Math.hypot(p.vx, p.vy)
    run(w, 1500)
    expect(p.state).toBe('swim')
    run(w, 400)
    expect(dashSpeed).toBeGreaterThan(Math.hypot(p.vx, p.vy) * 1.5)
    w.waterTarget = 0.6
    w.water = 0.6
    startAction(w, p, 'surface', w.now, seeded())
    run(w, 2000)
    expect(p.y).toBeLessThan(waterlineY(w) + 60)
    run(w, 500)
    expect(p.state).toBe('swim')
  })

  test('spawn, exit and error are not interrupted by an action', () => {
    const w = createWorld(640, 192, 0.5, 0)
    const b = addBaby(w, 'a1', 'blue', 0, seeded())
    startAction(w, b, 'dash', 0)
    expect(b.state).toBe('spawn')
    run(w, 700)
    setError(w, b, w.now)
    startAction(w, b, 'eat', w.now)
    expect(b.state).toBe('error')
    expect(w.food).toHaveLength(0)
  })

  test('resizing keeps every fish in the new tank', () => {
    const w = createWorld(640, 192, 0.5, 0)
    for (let i = 0; i < 5; i++) addBaby(w, `a${i}`, 'blue', 0, seeded(i))
    run(w, 2000)
    resizeWorld(w, 1120, 448, 1)
    expect(w.scale).toBe(1)
    run(w, 200)
    inBounds(w)
    resizeWorld(w, 320, 96, 0.5)
    run(w, 200)
    inBounds(w)
  })

  test('ambient bubbles rise and pop at the waterline', () => {
    const w = createWorld(640, 192, 0.5, 0)
    run(w, 5000)
    expect(w.bubbles.length).toBeGreaterThan(0)
    for (const b of w.bubbles) expect(b.y).toBeGreaterThan(waterlineY(w))
  })
})
