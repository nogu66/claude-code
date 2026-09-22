import { describe, expect, test } from 'bun:test'
import { actionFor, agentDone, applyTool, birth, labelFor, shortToolName, syncAgents } from '../hooks/aquarium/events.ts'
import { colorForType, createWorld, findFish, step } from '../hooks/aquarium/world.ts'

const seeded = (s = 1) => () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296 }

describe('tool mapping', () => {
  test('tools map to the spec table', () => {
    expect(actionFor('Read')).toBe('eat')
    expect(actionFor('Grep')).toBe('eat')
    expect(actionFor('Glob')).toBe('eat')
    expect(actionFor('Edit')).toBe('nest')
    expect(actionFor('Write')).toBe('nest')
    expect(actionFor('Bash')).toBe('dash')
    expect(actionFor('WebFetch')).toBe('surface')
    expect(actionFor('mcp__playwright__browser_click')).toBe('surface')
    expect(actionFor('TodoWrite')).toBe('none')
  })
  test('labels are the tool and one short argument', () => {
    expect(labelFor('Edit', { file_path: '/repo/src/auth.ts' })).toBe('Edit auth.ts')
    expect(labelFor('Grep', { pattern: 'TODO' })).toBe('Grep TODO')
    expect(labelFor('Bash', { command: 'bun   test\n' })).toBe('Bash bun test')
    expect(labelFor('Bash', { command: 'x', description: 'Run tests' })).toBe('Bash Run tests')
    expect(labelFor('WebFetch', { url: 'https://www.example.com/a/b' })).toBe('WebFetch example.com')
    expect(labelFor('mcp__playwright__browser_click', {})).toBe('browser_click')
    expect(labelFor('Read', { file_path: '/very/long/path/to/some-extremely-long-file-name.tsx' })).toHaveLength(22)
    expect(labelFor('TodoWrite', {})).toBe('TodoWrite')
    expect(shortToolName('mcp__a__b__c')).toBe('c')
  })
})

describe('tool events', () => {
  test('the parent gets the bubble and the action; an error sinks it', () => {
    const w = createWorld(640, 192, 0.5, 0)
    applyTool(w, 'main', 'Read', { file_path: 'a.ts' }, false, 0, seeded())
    expect(w.fish[0].bubble?.text).toBe('Read a.ts')
    expect(w.fish[0].state).toBe('eat')
    applyTool(w, 'main', 'Bash', { command: 'false' }, true, 100, seeded())
    expect(w.fish[0].state).toBe('error')
  })
  test('a tool from an unknown subagent makes a baby on the spot', () => {
    const w = createWorld(640, 192, 0.5, 0)
    applyTool(w, 'agent-9', 'Grep', { pattern: 'x' }, false, 0, seeded())
    const b = findFish(w, 'agent-9')
    expect(b?.kind).toBe('baby')
    expect(b?.state).toBe('spawn')
    expect(b?.bubble?.text).toBe('Grep x')
  })
})

describe('agents', () => {
  test('colours: Explore blue, general-purpose orange, a third type green, the rest purple', () => {
    const w = createWorld(640, 192, 0.5, 0)
    expect(colorForType(w, 'general-purpose')).toBe('orange')
    expect(colorForType(w, 'Explore')).toBe('blue')
    expect(colorForType(w, 'Plan')).toBe('green')
    expect(colorForType(w, 'codex:rescue')).toBe('purple')
    expect(colorForType(w, 'other')).toBe('purple')
    expect(colorForType(w, 'Plan')).toBe('green')
  })
  test('spawn births, list sync births and exits, turn.complete exits', () => {
    const w = createWorld(640, 192, 0.5, 0)
    birth(w, 'a1', 'Explore', 0, seeded())
    expect(findFish(w, 'a1')?.color).toBe('blue')
    syncAgents(w, [
      { id: 'a1', type: 'Explore', status: 'running' },
      { id: 'a2', type: 'general-purpose', status: 'running' },
      { id: 'a3', type: 'general-purpose', status: 'completed' },
    ], 10, seeded())
    expect(findFish(w, 'a2')?.color).toBe('orange')
    expect(findFish(w, 'a3')).toBeUndefined()
    syncAgents(w, [
      { id: 'a1', type: 'Explore', status: 'completed' },
      { id: 'a2', type: 'general-purpose', status: 'running' },
    ], 20, seeded())
    expect(findFish(w, 'a1')?.state).toBe('exit')
    expect(findFish(w, 'a2')?.state).toBe('spawn')
    agentDone(w, 'a2', 30)
    expect(findFish(w, 'a2')?.state).toBe('exit')
    let now = 30
    while (now < 4000) { now += 66; step(w, now, seeded()) }
    expect(w.fish).toHaveLength(1)
  })
  test('a fish the list does not know is left alone', () => {
    const w = createWorld(640, 192, 0.5, 0)
    applyTool(w, 'fresh', 'Read', { file_path: 'x' }, false, 0, seeded())
    syncAgents(w, [], 10, seeded())
    expect(findFish(w, 'fresh')?.state).toBe('spawn')
  })
})
