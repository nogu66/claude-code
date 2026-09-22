// From the session's events to the tank: which tool means which action, what the speech
// bubble says, and how the subagent list becomes births and exits. Pure functions.
import { addBaby, colorForType, exitFish, findFish, PARENT_ID, setBubble, setError, startAction, type Action, type FishColor, type World } from './world.ts'

export type ToolAction = Action | 'none'

export type AgentRow = { id: string; type: string; status: string; parentId?: string }

const EAT = new Set(['Read', 'Grep', 'Glob', 'LS', 'NotebookRead'])
const NEST = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
const DASH = new Set(['Bash', 'BashOutput', 'PowerShell'])
const SURFACE = new Set(['WebFetch', 'WebSearch'])

export function actionFor(tool: string): ToolAction {
  if (EAT.has(tool)) return 'eat'
  if (NEST.has(tool)) return 'nest'
  if (DASH.has(tool)) return 'dash'
  if (SURFACE.has(tool) || tool.startsWith('mcp__')) return 'surface'
  return 'none'
}

const MAX_LABEL = 22

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined)
const basename = (p: string) => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? p
const host = (u: string) => {
  try { return new URL(u).hostname.replace(/^www\./, '') } catch { return u }
}

/** The tool's name for the bubble: `mcp__server__tool` shows as `tool`. */
export function shortToolName(tool: string): string {
  if (tool.startsWith('mcp__')) {
    const parts = tool.split('__')
    return parts[parts.length - 1] || tool
  }
  return tool
}

/** `Edit auth.ts`, `Grep TODO`, `Bash bun test`: the tool and its one telling argument, cut to fit a bubble. */
export function labelFor(tool: string, input: Record<string, unknown>): string {
  let arg: string | undefined
  switch (tool) {
    case 'Read': case 'Edit': case 'Write': case 'MultiEdit':
      arg = str(input.file_path); if (arg) arg = basename(arg); break
    case 'NotebookEdit': case 'NotebookRead':
      arg = str(input.notebook_path); if (arg) arg = basename(arg); break
    case 'Grep': case 'Glob':
      arg = str(input.pattern); break
    case 'Bash': case 'PowerShell':
      arg = str(input.description) ?? str(input.command)?.replace(/\s+/g, ' '); break
    case 'WebFetch':
      arg = str(input.url); if (arg) arg = host(arg); break
    case 'WebSearch':
      arg = str(input.query); break
    case 'Agent': case 'Task':
      arg = str(input.subagent_type) ?? str(input.description); break
    case 'Skill':
      arg = str(input.skill); break
    default:
      arg = str(input.file_path) ?? str(input.path) ?? str(input.query) ?? str(input.url)
      if (arg && (input.file_path !== undefined || input.path !== undefined)) arg = basename(arg)
  }
  const name = shortToolName(tool)
  const text = arg ? `${name} ${arg}` : name
  return text.length > MAX_LABEL ? `${text.slice(0, MAX_LABEL - 1)}~` : text
}

/**
 * One finished tool call: the fish for `fishId` (the parent, or a baby made on the spot for
 * a subagent the list has not named yet) gets the bubble and the action, or the error.
 */
export function applyTool(world: World, fishId: string, tool: string, input: Record<string, unknown>, isError: boolean, now: number, rand = Math.random): void {
  let fish = findFish(world, fishId)
  if (!fish) {
    if (fishId === PARENT_ID) return
    fish = addBaby(world, fishId, 'green', now, rand)
  }
  setBubble(fish, labelFor(tool, input), now)
  if (isError) {
    setError(world, fish, now)
    return
  }
  const action = actionFor(tool)
  if (action !== 'none') startAction(world, fish, action, now, rand)
}

/** A subagent started: a baby in the colour of its type. */
export function birth(world: World, agentId: string, type: string, now: number, rand = Math.random): void {
  const color: FishColor = colorForType(world, type)
  const fish = addBaby(world, agentId, color, now, rand)
  fish.color = color
}

/**
 * Reconciles the tank with `$.agent.list()`: a running agent without a fish is born, a fish
 * whose agent is listed and no longer running leaves. Fish the list does not know stay.
 */
export function syncAgents(world: World, agents: readonly AgentRow[], now: number, rand = Math.random): void {
  const listed = new Map(agents.map(a => [a.id, a] as const))
  for (const a of agents) {
    if (a.status !== 'running') continue
    const color = colorForType(world, a.type)
    const fish = findFish(world, a.id)
    if (!fish) addBaby(world, a.id, color, now, rand)
    else if (fish.kind === 'baby') fish.color = color
  }
  for (const fish of world.fish) {
    if (fish.kind !== 'baby' || fish.gone || fish.state === 'exit') continue
    const row = listed.get(fish.id)
    if (row && row.status !== 'running') exitFish(world, fish.id, now)
  }
}

/** A subagent's run ended (its `turn.complete` carries its id): it swims off. */
export function agentDone(world: World, agentId: string, now: number): void {
  exitFish(world, agentId, now)
}
