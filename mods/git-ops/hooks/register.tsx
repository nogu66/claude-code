/* @jsx h */
// Hooks module. Wires events to the pure logic in ./lib/gitops.ts — this file owns all `$`
// calls; command parsing, git argv construction, and status/branch parsing live in
// lib/gitops.ts.
//
// `/git` (no args, or `show`) draws a clickable panel in the `AbovePrompt` band (above the
// prompt input, not a side Pane): a title row (current branch + ahead/behind on the left,
// pull/push/fetch/refresh buttons on the right) and two tabs — `branches` (the local branches
// most-recent first in side-by-side columns: click one, press its digit, or type in the
// filter box and press Enter — no match creates the branch; plus "previous branch") and
// `changes` (staged
// on the left, unstaged/untracked on the right, plus "stage all" and a commit Input).
// `/git stop` hides it. The original text subcommands (`status | branch | checkout <branch> |
// checkout -b <branch> | pull | push | fetch | stage | commit <message>`) still work for
// scripting/quick use and share the same pure argv builders.
//
// `Button`/`Input` are wired directly in this hooks module — no `Client` surface module, since
// nothing here needs its own frame clock. Function hooks are early-access: run `/plugin-types`
// and check the generated `.claude/types/claude-code.d.ts` if an event or `$` call is refused.
//
// Deliberately scoped to safe, everyday operations: status, branch listing, checkout, pull,
// push, fetch, stage-all, commit. No force-push, reset, rebase, or clean are exposed here — a
// panel button shouldn't make a destructive git operation a single click away.

import type { Register } from "claude-code"
import {
  buildBranchListArgv,
  buildStatusArgv,
  filterBranches,
  formatBranchRowLabel,
  formatCheckoutHint,
  formatGitFailure,
  formatStatusHeader,
  formatUsage,
  parseBranchListOutput,
  parseGitCommand,
  parseStatusOutput,
  resolveCheckoutTarget,
  rowsForWidth,
  splitIntoColumns,
  summarizeList,
  toArgv,
  type BranchInfo,
  type GitCommand,
  type StatusInfo,
} from "./lib/gitops"

const BRANCH_LIST_LIMIT = 60
const BRANCH_ROWS = 6
// `[ label ]` plus a hotkey prefix and a gap before the next column
const BUTTON_CHROME_WIDTH = 10
const FILE_LIST_LIMIT = 8

type Tab = "branches" | "changes"

let open = false
let tab: Tab = "branches"
let branches: BranchInfo[] = []
let status: StatusInfo | undefined
let loadError: string | undefined
let loadingRefresh = false

let branchQuery = ""
// a checkout waits here for the person's OK; nothing switches branches without it
let pendingCheckout: GitCommand | undefined
let commitDraft = ""
let actionBusy: string | undefined
let actionError: string | undefined

function runFailureText(result: { code?: number; stderr?: string; stdout?: string } | undefined, fallback: string) {
  return (result?.stderr || result?.stdout || fallback).trim()
}

async function refreshAll($: any): Promise<void> {
  loadingRefresh = true
  try {
    const branchResult = await $.process.run(["git", ...buildBranchListArgv()])
    if (branchResult && typeof branchResult.code === "number" && branchResult.code !== 0) {
      loadError = runFailureText(branchResult, "not a git repository (or git branch failed)")
      branches = []
      status = undefined
      return
    }
    const branchParsed = parseBranchListOutput(String(branchResult?.stdout ?? ""))
    branches = branchParsed.ok ? branchParsed.value : []

    const statusResult = await $.process.run(["git", ...buildStatusArgv()])
    if (statusResult && typeof statusResult.code === "number" && statusResult.code !== 0) {
      loadError = runFailureText(statusResult, "git status failed")
      status = undefined
      return
    }
    const statusParsed = parseStatusOutput(String(statusResult?.stdout ?? ""))
    if (!statusParsed.ok) {
      loadError = statusParsed.error
      status = undefined
      return
    }
    status = statusParsed.value
    loadError = undefined
  } catch (err) {
    loadError = `git unavailable: ${err}`
    branches = []
    status = undefined
  } finally {
    loadingRefresh = false
  }
}

async function runAction($: any, command: GitCommand, busyLabel: string): Promise<void> {
  actionBusy = busyLabel
  actionError = undefined
  pendingCheckout = undefined
  $.ui.invalidate("ui.render")
  try {
    const result = await $.process.run(["git", ...toArgv(command)])
    if (result && typeof result.code === "number" && result.code !== 0) {
      actionError = formatGitFailure(command, result.code, result.stderr ?? "", result.stdout ?? "")
      return
    }
    if (command.kind === "commit") commitDraft = ""
    if (command.kind === "checkout" || command.kind === "back") branchQuery = ""
    await refreshAll($)
  } catch (err) {
    actionError = `git unavailable: ${err}`
  } finally {
    actionBusy = undefined
    $.ui.invalidate("ui.render")
  }
}

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    const r = await next(e)
    await $.command
      .register({
        name: "git",
        description:
          "Browse branches/status and checkout/pull/push/fetch/stage/commit in a clickable panel, or via text subcommands (git-ops)",
        argumentHint:
          "[show | stop | status | branch | checkout <branch> | checkout -b <branch> | back | pull | push | fetch | stage | commit <message>]",
        immediate: true,
      })
      .catch((err: unknown) => $.ui.log(`git-ops: command.register failed: ${err}`))
    return r
  })

  on("command.run", { command: "git" }, async ($, e) => {
    const trimmed = e.args.trim()
    const lower = trimmed.toLowerCase()

    if (trimmed === "" || lower === "show") {
      if (!open) {
        open = true
        await refreshAll($)
        $.ui.invalidate("ui.render")
      }
      return {
        text: "Git panel showing above the prompt — click a branch to check it out, or use pull/push/fetch/stage/commit · /git stop hides it",
      }
    }
    if (lower === "stop") {
      open = false
      $.ui.invalidate("ui.render")
      return { text: "Git panel hidden · /git show brings it back" }
    }

    // Text subcommands still work standalone, sharing the same argv builders the panel's
    // buttons use.
    const parsed = parseGitCommand(trimmed)
    if (!parsed.ok) return { text: parsed.error ?? formatUsage() }
    const command = parsed.command as GitCommand
    if (command.kind === "help") return { text: formatUsage() }

    try {
      const result = await $.process.run(["git", ...toArgv(command)])
      const code = result?.code
      if (typeof code === "number" && code !== 0) {
        return { text: formatGitFailure(command, code, result?.stderr ?? "", result?.stdout ?? "") }
      }
      if (open) {
        await refreshAll($)
        $.ui.invalidate("ui.render")
      }
      // git often writes normal progress (pull/push/fetch) to stderr even on success
      const stdout = String(result?.stdout ?? "").trim()
      const stderr = String(result?.stderr ?? "").trim()
      return { text: stdout || stderr || "(git reported success with no output)" }
    } catch (err) {
      return {
        text: `git-ops: failed to run git — ${err}\nIs git installed and on PATH, and are you inside a git repository?`,
      }
    }
  })

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    if (!open || e.surface !== "terminal") return next(e)
    const { Box, Text, Button, Input } = await $.ui.resolve(e)
    const cols = e.props.bodyColumns ?? 80

    const header = status ? formatStatusHeader(status) : loadingRefresh ? "loading…" : "(no status yet)"
    const changeCount = status ? status.staged.length + status.unstaged.length + status.untracked.length : 0

    const selectTab = (target: Tab) => () => {
      tab = target
      $.ui.invalidate("ui.render")
    }

    const askCheckout = (command: GitCommand) => {
      pendingCheckout = command
      actionError = undefined
      $.ui.invalidate("ui.render")
    }

    const titleRow = (
      <Box flexDirection="row" justifyContent="space-between" width={cols}>
        <Text bold wrap="truncate-end">
          Git · {header}
        </Text>
        <Box flexDirection="row" columnGap={2}>
          <Button key="act-pull" label="↓ pull" plain onPress={() => runAction($, { kind: "pull" }, "pulling…")} />
          <Button key="act-push" label="↑ push" plain onPress={() => runAction($, { kind: "push" }, "pushing…")} />
          <Button key="act-fetch" label="fetch" plain onPress={() => runAction($, { kind: "fetch" }, "fetching…")} />
          <Button
            key="act-refresh"
            label="refresh"
            plain
            dimColor
            onPress={async () => {
              await refreshAll($)
              $.ui.invalidate("ui.render")
            }}
          />
        </Box>
      </Box>
    )

    const tabRow = (
      <Box flexDirection="row" columnGap={3}>
        <Button
          key="tab-branches"
          label={`${tab === "branches" ? "▸ " : "  "}branches (${branches.length})`}
          plain
          dimColor={tab !== "branches"}
          onPress={selectTab("branches")}
        />
        <Button
          key="tab-changes"
          label={`${tab === "changes" ? "▸ " : "  "}changes (${changeCount})`}
          plain
          dimColor={tab !== "changes"}
          onPress={selectTab("changes")}
        />
        {actionBusy && <Text color="cyan">{actionBusy}</Text>}
      </Box>
    )

    const notices = (
      <Box flexDirection="column">
        {loadError && <Text color="red">{loadError}</Text>}
        {actionError && <Text color="red">{actionError}</Text>}
      </Box>
    )

    let body
    if (pendingCheckout) {
      const pending = pendingCheckout
      const question =
        pending.kind === "back"
          ? "Switch back to the previous branch?"
          : pending.kind === "checkout" && pending.create
            ? `Create new branch ${pending.branch} and check it out?`
            : pending.kind === "checkout"
              ? `Check out ${pending.branch}?`
              : ""
      const dirty = status ? status.staged.length + status.unstaged.length : 0
      const busyLabel =
        pending.kind === "checkout" ? `checking out ${pending.branch}…` : "switching back…"
      body = (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
          <Text bold>{question}</Text>
          {dirty > 0 && (
            <Text color="yellow">
              {dirty} uncommitted change{dirty === 1 ? "" : "s"} will come along (git refuses if they conflict)
            </Text>
          )}
          <Box flexDirection="row" columnGap={2}>
            <Button key="confirm-ok" label="OK" hotkey="y" autoFocus onPress={() => runAction($, pending, busyLabel)} />
            <Button
              key="confirm-cancel"
              label="cancel"
              hotkey="n"
              onPress={() => {
                pendingCheckout = undefined
                $.ui.invalidate("ui.render")
              }}
            />
          </Box>
        </Box>
      )
    } else if (tab === "branches") {
      const matches = filterBranches(branches, branchQuery)
      const shown = matches.slice(0, BRANCH_LIST_LIMIT)
      const more = Math.max(0, matches.length - BRANCH_LIST_LIMIT)
      const target = resolveCheckoutTarget(branches, branchQuery)
      // hotkeys go to the branches a press can actually switch to, in the order drawn
      const hotkeys = new Map(
        shown
          .filter((b) => !b.current)
          .slice(0, 9)
          .map((b, i) => [b.name, String(i + 1)]),
      )
      const cellWidth = Math.min(
        cols,
        Math.max(0, ...shown.map((b) => b.name.length + (b.current ? 12 : 0))) + BUTTON_CHROME_WIDTH,
      )
      const columns = splitIntoColumns(shown, rowsForWidth(shown.length, cellWidth, cols, BRANCH_ROWS))

      body = (
        <Box flexDirection="column">
          <Box flexDirection="row" columnGap={2}>
            <Input
              key="branch-query"
              label="checkout"
              placeholder="type to filter…"
              value={branchQuery}
              submitLabel="go"
              autoFocus
              onInput={(v: string) => {
                branchQuery = v
                $.ui.invalidate("ui.render")
              }}
              onSubmit={(v: string) => {
                branchQuery = v
                const submitted = resolveCheckoutTarget(branches, v)
                if (submitted.kind === "checkout") {
                  askCheckout({ kind: "checkout", branch: submitted.branch, create: false })
                } else if (submitted.kind === "create") {
                  askCheckout({ kind: "checkout", branch: submitted.branch, create: true })
                } else {
                  actionError =
                    submitted.kind === "invalid"
                      ? `git-ops: ${formatCheckoutHint(submitted)}`
                      : v.trim()
                        ? `git-ops: already on ${v.trim()} — nothing to check out`
                        : "git-ops: type a branch name first, or click a branch button"
                  $.ui.invalidate("ui.render")
                }
              }}
            />
            <Button key="act-back" label="← previous branch" plain onPress={() => askCheckout({ kind: "back" })} />
          </Box>
          <Text dimColor={target.kind === "none"} color={target.kind === "invalid" ? "red" : target.kind === "none" ? undefined : "cyan"}>
            {formatCheckoutHint(target)}
          </Text>
          <Box flexDirection="row">
            {columns.map((column, i) => (
              <Box key={`branch-col-${i}`} flexDirection="column" width={cellWidth}>
                {column.map((b) =>
                  b.current ? (
                    <Text key={`branch-${b.name}`} bold color="green" wrap="truncate-end">
                      ● {b.name} (current)
                    </Text>
                  ) : (
                    <Button
                      key={`branch-${b.name}`}
                      label={formatBranchRowLabel(b, cellWidth - BUTTON_CHROME_WIDTH).trimStart()}
                      hotkey={hotkeys.get(b.name)}
                      onPress={() => askCheckout({ kind: "checkout", branch: b.name, create: false })}
                    />
                  ),
                )}
              </Box>
            ))}
          </Box>
          {more > 0 && <Text dimColor>+{more} more — type to narrow</Text>}
        </Box>
      )
    } else {
      const half = Math.max(20, Math.floor(cols / 2))
      const fileList = (title: string, files: string[], color: string | undefined, keyPrefix: string) => {
        const info = summarizeList(files, FILE_LIST_LIMIT)
        return (
          <Box flexDirection="column">
            <Text bold color={color}>
              {title} ({files.length})
            </Text>
            {files.length === 0 && <Text dimColor>  —</Text>}
            {info.shown.map((f, i) => (
              <Text key={`${keyPrefix}-${i}`} color={color} wrap="truncate-start">
                {"  "}
                {f}
              </Text>
            ))}
            {info.more > 0 && <Text dimColor>  +{info.more} more</Text>}
          </Box>
        )
      }

      body = (
        <Box flexDirection="column">
          <Box flexDirection="row">
            <Box flexDirection="column" width={half} borderStyle="round" borderDimColor paddingX={1}>
              {fileList("staged", status?.staged ?? [], "green", "staged")}
            </Box>
            <Box flexDirection="column" width={half} borderStyle="round" borderDimColor paddingX={1}>
              {fileList("unstaged", status?.unstaged ?? [], "yellow", "unstaged")}
              {fileList("untracked", status?.untracked ?? [], undefined, "untracked")}
            </Box>
          </Box>
          <Box flexDirection="row" columnGap={2}>
            <Button key="act-stage" label="+ stage all" plain onPress={() => runAction($, { kind: "stage" }, "staging…")} />
            <Input
              key="commit-message"
              label="commit"
              placeholder="message — Enter commits staged changes"
              value={commitDraft}
              submitLabel="commit"
              onInput={(v: string) => {
                commitDraft = v
              }}
              onSubmit={(v: string) => {
                commitDraft = v
                if (!v.trim()) {
                  actionError = "git-ops: commit needs a message"
                  $.ui.invalidate("ui.render")
                  return
                }
                runAction($, { kind: "commit", message: v.trim() }, "committing…")
              }}
            />
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        {titleRow}
        {tabRow}
        {notices}
        {body}
        {await next(e)}
      </Box>
    )
  })
}
