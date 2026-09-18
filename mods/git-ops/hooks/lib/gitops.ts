// Pure logic for git-ops. No `$`, no hooks, no UI — testable directly with `bun test`.
//
// Parses `/git ...` command text into a structured request, turns that request into the `git`
// CLI argv to run (argv array via $.process.run, never a shell string), and parses/formats
// git's output for the transcript and the clickable panel.
//
// Deliberately scoped to safe, everyday operations: status, branch listing, checkout (existing
// or new branch), pull, push, fetch, stage-all, commit. No force-push, reset, rebase, or clean —
// those stay a Bash command away, not a button.

export type GitCommand =
  | { kind: "status" }
  | { kind: "branch" }
  | { kind: "checkout"; branch: string; create: boolean }
  | { kind: "back" }
  | { kind: "pull" }
  | { kind: "push" }
  | { kind: "fetch" }
  | { kind: "stage" }
  | { kind: "commit"; message: string }
  | { kind: "help" }

export interface ParseResult {
  ok: boolean
  command?: GitCommand
  error?: string
}

const USAGE = [
  "/git status                 — show working tree status",
  "/git branch                 — list local branches",
  "/git checkout <branch>      — switch to an existing branch",
  "/git checkout -b <branch>   — create and switch to a new branch",
  "/git back                   — switch to the previously checked-out branch (git checkout -)",
  "/git pull                   — pull the current branch's upstream",
  "/git push                   — push the current branch to its upstream",
  "/git fetch                  — fetch from the remote",
  "/git stage                  — stage all changes (git add -A)",
  "/git commit <message>       — commit staged changes",
].join("\n")

export function formatUsage(): string {
  return `git-ops usage:\n${USAGE}`
}

// Guards against argument injection through a typed branch name (e.g. "--upload-pack=evil") —
// $.process.run's argv array already rules out shell injection, but a leading "-" would still
// be read by git itself as a flag rather than a branch name.
export function isValidBranchName(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed) return false
  if (trimmed.startsWith("-")) return false
  if (/\s/.test(trimmed)) return false
  return true
}

export function parseGitCommand(rawArgs: string): ParseResult {
  const trimmed = rawArgs.trim()
  if (trimmed.length === 0) return { ok: true, command: { kind: "help" } }

  const firstSpace = trimmed.search(/\s/)
  const sub = (firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace)).toLowerCase()
  const rest = (firstSpace === -1 ? "" : trimmed.slice(firstSpace + 1)).trim()

  switch (sub) {
    case "status":
      return { ok: true, command: { kind: "status" } }
    case "branch":
      return { ok: true, command: { kind: "branch" } }
    case "checkout": {
      let body = rest
      let create = false
      if (body === "-b" || body.startsWith("-b ")) {
        create = true
        body = body.slice(2).trim()
      } else if (body === "--create" || body.toLowerCase().startsWith("--create ")) {
        create = true
        body = body.slice("--create".length).trim()
      }
      if (!isValidBranchName(body)) {
        return {
          ok: false,
          error:
            "git-ops: /git checkout needs a branch name — `/git checkout <branch>` or `/git checkout -b <branch>`",
        }
      }
      return { ok: true, command: { kind: "checkout", branch: body, create } }
    }
    case "back":
      return { ok: true, command: { kind: "back" } }
    case "pull":
      return { ok: true, command: { kind: "pull" } }
    case "push":
      return { ok: true, command: { kind: "push" } }
    case "fetch":
      return { ok: true, command: { kind: "fetch" } }
    case "stage":
      return { ok: true, command: { kind: "stage" } }
    case "commit": {
      const message = rest.trim()
      if (!message) {
        return { ok: false, error: "git-ops: /git commit needs a message — `/git commit <message>`" }
      }
      return { ok: true, command: { kind: "commit", message } }
    }
    case "help":
      return { ok: true, command: { kind: "help" } }
    default:
      return { ok: false, error: `git-ops: unknown subcommand "${sub}"\n${USAGE}` }
  }
}

export function toArgv(command: GitCommand): string[] {
  switch (command.kind) {
    case "status":
      return ["status"]
    case "branch":
      return ["branch"]
    case "checkout":
      return command.create ? ["checkout", "-b", command.branch] : ["checkout", command.branch]
    case "back":
      return ["checkout", "-"]
    case "pull":
      return ["pull"]
    case "push":
      return ["push"]
    case "fetch":
      return ["fetch"]
    case "stage":
      return ["add", "-A"]
    case "commit":
      return ["commit", "-m", command.message]
    case "help":
      return []
  }
}

export function formatGitFailure(command: GitCommand, code: number | undefined, stderr: string, stdout: string): string {
  const detail = (stderr || stdout || "").trim() || "(no output)"
  return `git-ops: git failed on \`${command.kind}\` (exit ${code ?? "?"})\n${detail}`
}

// --- The clickable panel: branch list + status, fetch/parse/format -------------------------

export interface BranchInfo {
  name: string
  current: boolean
}

export function buildBranchListArgv(): string[] {
  // most recently committed-to first: the branch you want is usually one you just worked on
  return ["branch", "--sort=-committerdate", "--format=%(HEAD)\t%(refname:short)"]
}

export type JsonResult<T> = { ok: true; value: T } | { ok: false; error: string }

export function parseBranchListOutput(raw: string): JsonResult<BranchInfo[]> {
  const lines = raw
    .split("\n")
    .map((l) => l.replace(/\r$/, ""))
    .filter((l) => l.trim().length > 0)
  const branches: BranchInfo[] = []
  for (const line of lines) {
    const tabIdx = line.indexOf("\t")
    if (tabIdx === -1) continue
    const marker = line.slice(0, tabIdx).trim()
    const name = line.slice(tabIdx + 1).trim()
    if (!name) continue
    branches.push({ name, current: marker === "*" })
  }
  return { ok: true, value: branches }
}

// Case-insensitive match, best first: exact, then prefix of the whole name, then prefix of a
// "/"-separated segment, then substring. Order within a rank is the input's (recency).
export function filterBranches(branches: BranchInfo[], query: string): BranchInfo[] {
  const q = query.trim().toLowerCase()
  if (!q) return branches
  const rank = (name: string): number => {
    const n = name.toLowerCase()
    if (n === q) return 0
    if (n.startsWith(q)) return 1
    if (n.split("/").some((segment) => segment.startsWith(q))) return 2
    if (n.includes(q)) return 3
    return -1
  }
  return branches
    .map((branch, index) => ({ branch, index, rank: rank(branch.name) }))
    .filter((entry) => entry.rank !== -1)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.branch)
}

export type CheckoutTarget =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "checkout"; branch: string }
  | { kind: "create"; branch: string }

// What Enter in the branch box does: check out the best match that isn't already checked out,
// or, when nothing matches, create a branch of that name.
export function resolveCheckoutTarget(branches: BranchInfo[], query: string): CheckoutTarget {
  const q = query.trim()
  if (!q) return { kind: "none" }
  const matches = filterBranches(branches, q)
  if (matches.length === 0) return isValidBranchName(q) ? { kind: "create", branch: q } : { kind: "invalid" }
  const target = matches.find((b) => !b.current)
  return target ? { kind: "checkout", branch: target.name } : { kind: "none" }
}

export function formatCheckoutHint(target: CheckoutTarget): string {
  switch (target.kind) {
    case "checkout":
      return `Enter → checkout ${target.branch}`
    case "create":
      return `Enter → create new branch ${target.branch}`
    case "invalid":
      return "not a valid branch name (no spaces, can't start with '-')"
    case "none":
      return "type to filter · Enter checks out the first match, or creates the branch if nothing matches"
  }
}

export interface StatusInfo {
  branch: string
  upstream?: string
  ahead: number
  behind: number
  staged: string[]
  unstaged: string[]
  untracked: string[]
}

export function buildStatusArgv(): string[] {
  return ["status", "--porcelain=v1", "-b"]
}

export function parseStatusOutput(raw: string): JsonResult<StatusInfo> {
  const lines = raw.split("\n").map((l) => l.replace(/\r$/, ""))
  if (lines.length === 0 || !lines[0].startsWith("##")) {
    return { ok: false, error: "unexpected git status output (missing branch header)" }
  }

  const header = lines[0].slice(2).trim()
  let ahead = 0
  let behind = 0
  let headPart = header

  const bracketMatch = header.match(/^(.*?)\s*\[(.+)\]$/)
  if (bracketMatch) {
    headPart = bracketMatch[1].trim()
    const bracket = bracketMatch[2]
    const aheadMatch = bracket.match(/ahead (\d+)/)
    const behindMatch = bracket.match(/behind (\d+)/)
    if (aheadMatch) ahead = Number(aheadMatch[1])
    if (behindMatch) behind = Number(behindMatch[1])
  }

  let branch = headPart
  let upstream: string | undefined
  const dotsIdx = headPart.indexOf("...")
  if (dotsIdx !== -1) {
    branch = headPart.slice(0, dotsIdx)
    upstream = headPart.slice(dotsIdx + 3)
  }

  const staged: string[] = []
  const unstaged: string[] = []
  const untracked: string[] = []

  for (const line of lines.slice(1)) {
    if (line.trim().length === 0) continue
    const x = line[0]
    const y = line[1]
    const file = line.slice(3)
    if (x === "?" && y === "?") {
      untracked.push(file)
      continue
    }
    if (x !== " " && x !== undefined) staged.push(file)
    if (y !== " " && y !== undefined && y !== "?") unstaged.push(file)
  }

  return { ok: true, value: { branch, upstream, ahead, behind, staged, unstaged, untracked } }
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text
}

export function formatBranchRowLabel(branch: BranchInfo, maxLen = 60): string {
  const marker = branch.current ? "* " : "  "
  return truncate(`${marker}${branch.name}`, maxLen)
}

export function formatStatusHeader(status: StatusInfo): string {
  const bits: string[] = []
  if (status.upstream) bits.push(status.upstream)
  if (status.ahead > 0) bits.push(`ahead ${status.ahead}`)
  if (status.behind > 0) bits.push(`behind ${status.behind}`)
  const tracking = bits.length > 0 ? ` (${bits.join(", ")})` : ""
  return `${status.branch}${tracking}`
}

// Column-major split: the first column fills top to bottom before the second starts, so an
// alphabetical branch list still reads down, then across.
export function splitIntoColumns<T>(items: T[], rowsPerColumn: number): T[][] {
  const rows = Math.max(1, Math.floor(rowsPerColumn))
  const columns: T[][] = []
  for (let i = 0; i < items.length; i += rows) columns.push(items.slice(i, i + rows))
  return columns
}

// Rows per column so that `count` cells of `cellWidth` fit across `bodyColumns`: the preferred
// height when that many columns fit, taller when the band is too narrow for them.
export function rowsForWidth(count: number, cellWidth: number, bodyColumns: number, preferredRows: number): number {
  const maxColumns = Math.max(1, Math.floor(bodyColumns / Math.max(1, cellWidth)))
  return Math.max(preferredRows, Math.ceil(count / maxColumns))
}

export function summarizeList(items: string[], limit: number): { shown: string[]; more: number } {
  if (items.length <= limit) return { shown: items, more: 0 }
  return { shown: items.slice(0, limit), more: items.length - limit }
}
