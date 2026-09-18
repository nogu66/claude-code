import { describe, expect, test } from "bun:test"
import {
  buildBranchListArgv,
  buildStatusArgv,
  filterBranches,
  formatCheckoutHint,
  resolveCheckoutTarget,
  formatBranchRowLabel,
  formatGitFailure,
  formatStatusHeader,
  formatUsage,
  isValidBranchName,
  parseBranchListOutput,
  parseGitCommand,
  parseStatusOutput,
  rowsForWidth,
  splitIntoColumns,
  summarizeList,
  toArgv,
} from "../hooks/lib/gitops"

describe("isValidBranchName", () => {
  test("accepts an ordinary name", () => {
    expect(isValidBranchName("feature/login")).toBe(true)
  })

  test("rejects empty / whitespace-only", () => {
    expect(isValidBranchName("")).toBe(false)
    expect(isValidBranchName("   ")).toBe(false)
  })

  test("rejects a leading dash (argument injection guard)", () => {
    expect(isValidBranchName("-b")).toBe(false)
    expect(isValidBranchName("--force")).toBe(false)
  })

  test("rejects internal whitespace", () => {
    expect(isValidBranchName("feature branch")).toBe(false)
  })

  test("trims before validating", () => {
    expect(isValidBranchName("  main  ")).toBe(true)
  })
})

describe("parseGitCommand — simple subcommands", () => {
  test("status", () => {
    expect(parseGitCommand("status").command).toEqual({ kind: "status" })
  })

  test("branch", () => {
    expect(parseGitCommand("branch").command).toEqual({ kind: "branch" })
  })

  test("pull / push / fetch / stage", () => {
    expect(parseGitCommand("pull").command).toEqual({ kind: "pull" })
    expect(parseGitCommand("push").command).toEqual({ kind: "push" })
    expect(parseGitCommand("fetch").command).toEqual({ kind: "fetch" })
    expect(parseGitCommand("stage").command).toEqual({ kind: "stage" })
  })

  test("is case-insensitive on the subcommand", () => {
    expect(parseGitCommand("STATUS").command).toEqual({ kind: "status" })
    expect(parseGitCommand("Pull").command).toEqual({ kind: "pull" })
  })
})

describe("parseGitCommand — checkout", () => {
  test("plain branch name", () => {
    const r = parseGitCommand("checkout main")
    expect(r.ok).toBe(true)
    expect(r.command).toEqual({ kind: "checkout", branch: "main", create: false })
  })

  test("-b creates a new branch", () => {
    const r = parseGitCommand("checkout -b feature/x")
    expect(r.ok).toBe(true)
    expect(r.command).toEqual({ kind: "checkout", branch: "feature/x", create: true })
  })

  test("--create is an alias for -b", () => {
    const r = parseGitCommand("checkout --create feature/y")
    expect(r.ok).toBe(true)
    expect(r.command).toEqual({ kind: "checkout", branch: "feature/y", create: true })
  })

  test("missing branch name is rejected", () => {
    const r = parseGitCommand("checkout")
    expect(r.ok).toBe(false)
    expect(r.error).toContain("needs a branch name")
  })

  test("-b with no name after it is rejected", () => {
    const r = parseGitCommand("checkout -b")
    expect(r.ok).toBe(false)
  })

  test("a name starting with '-' is rejected", () => {
    const r = parseGitCommand("checkout --upload-pack=evil")
    expect(r.ok).toBe(false)
  })

  test("a branch name containing spaces is rejected", () => {
    const r = parseGitCommand("checkout feature branch")
    expect(r.ok).toBe(false)
  })
})

describe("parseGitCommand — commit", () => {
  test("captures the rest of the line as the message", () => {
    const r = parseGitCommand("commit fix: handle the edge case")
    expect(r.ok).toBe(true)
    expect(r.command).toEqual({ kind: "commit", message: "fix: handle the edge case" })
  })

  test("missing message is rejected", () => {
    const r = parseGitCommand("commit")
    expect(r.ok).toBe(false)
    expect(r.error).toContain("needs a message")
  })

  test("whitespace-only message is rejected", () => {
    const r = parseGitCommand("commit    ")
    expect(r.ok).toBe(false)
  })
})

describe("parseGitCommand — help / unknown", () => {
  test("empty args yield help", () => {
    expect(parseGitCommand("").command).toEqual({ kind: "help" })
  })

  test("whitespace-only args yield help", () => {
    expect(parseGitCommand("   ").command).toEqual({ kind: "help" })
  })

  test("explicit help subcommand", () => {
    expect(parseGitCommand("help").command).toEqual({ kind: "help" })
  })

  test("unknown subcommand is rejected with usage", () => {
    const r = parseGitCommand("rebase")
    expect(r.ok).toBe(false)
    expect(r.error).toContain("unknown subcommand")
    expect(r.error).toContain("/git status")
  })
})

describe("toArgv", () => {
  test("status / branch / pull / push / fetch / stage", () => {
    expect(toArgv({ kind: "status" })).toEqual(["status"])
    expect(toArgv({ kind: "branch" })).toEqual(["branch"])
    expect(toArgv({ kind: "pull" })).toEqual(["pull"])
    expect(toArgv({ kind: "push" })).toEqual(["push"])
    expect(toArgv({ kind: "fetch" })).toEqual(["fetch"])
    expect(toArgv({ kind: "stage" })).toEqual(["add", "-A"])
  })

  test("checkout without create", () => {
    expect(toArgv({ kind: "checkout", branch: "main", create: false })).toEqual(["checkout", "main"])
  })

  test("checkout with create", () => {
    expect(toArgv({ kind: "checkout", branch: "feature/x", create: true })).toEqual(["checkout", "-b", "feature/x"])
  })

  test("commit", () => {
    expect(toArgv({ kind: "commit", message: "fix bug" })).toEqual(["commit", "-m", "fix bug"])
  })

  test("help produces no argv", () => {
    expect(toArgv({ kind: "help" })).toEqual([])
  })
})

describe("formatGitFailure", () => {
  test("prefers stderr over stdout", () => {
    const msg = formatGitFailure({ kind: "pull" }, 1, "conflict", "")
    expect(msg).toContain("pull")
    expect(msg).toContain("exit 1")
    expect(msg).toContain("conflict")
  })

  test("falls back to stdout when stderr is empty", () => {
    const msg = formatGitFailure({ kind: "push" }, 1, "", "rejected")
    expect(msg).toContain("rejected")
  })

  test("falls back to a placeholder when both are empty", () => {
    const msg = formatGitFailure({ kind: "fetch" }, undefined, "", "")
    expect(msg).toContain("(no output)")
    expect(msg).toContain("exit ?")
  })
})

describe("formatUsage", () => {
  test("lists every subcommand", () => {
    const usage = formatUsage()
    expect(usage).toContain("/git status")
    expect(usage).toContain("/git branch")
    expect(usage).toContain("/git checkout")
    expect(usage).toContain("/git pull")
    expect(usage).toContain("/git push")
    expect(usage).toContain("/git fetch")
    expect(usage).toContain("/git stage")
    expect(usage).toContain("/git commit")
  })
})

describe("buildBranchListArgv / buildStatusArgv", () => {
  test("branch list argv", () => {
    expect(buildBranchListArgv()).toEqual(["branch", "--sort=-committerdate", "--format=%(HEAD)\t%(refname:short)"])
  })

  test("status argv", () => {
    expect(buildStatusArgv()).toEqual(["status", "--porcelain=v1", "-b"])
  })
})

describe("parseBranchListOutput", () => {
  test("marks the current branch from the HEAD marker", () => {
    const raw = "*\tmain\n \tfeature/x\n \tfeature/y\n"
    const r = parseBranchListOutput(raw)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toEqual([
      { name: "main", current: true },
      { name: "feature/x", current: false },
      { name: "feature/y", current: false },
    ])
  })

  test("ignores blank lines", () => {
    const raw = "*\tmain\n\n \tfeature/x\n"
    const r = parseBranchListOutput(raw)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toHaveLength(2)
  })

  test("ignores a line with no tab separator", () => {
    const raw = "*\tmain\nmalformed-line\n"
    const r = parseBranchListOutput(raw)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toEqual([{ name: "main", current: true }])
  })
})

describe("parseStatusOutput", () => {
  test("no upstream", () => {
    const r = parseStatusOutput("## main\n")
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.branch).toBe("main")
    expect(r.value.upstream).toBeUndefined()
    expect(r.value.ahead).toBe(0)
    expect(r.value.behind).toBe(0)
  })

  test("with upstream, no ahead/behind", () => {
    const r = parseStatusOutput("## main...origin/main\n")
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.branch).toBe("main")
    expect(r.value.upstream).toBe("origin/main")
    expect(r.value.ahead).toBe(0)
    expect(r.value.behind).toBe(0)
  })

  test("ahead only", () => {
    const r = parseStatusOutput("## main...origin/main [ahead 1]\n")
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.ahead).toBe(1)
    expect(r.value.behind).toBe(0)
  })

  test("behind only", () => {
    const r = parseStatusOutput("## main...origin/main [behind 2]\n")
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.ahead).toBe(0)
    expect(r.value.behind).toBe(2)
  })

  test("ahead and behind", () => {
    const r = parseStatusOutput("## main...origin/main [ahead 1, behind 2]\n")
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.ahead).toBe(1)
    expect(r.value.behind).toBe(2)
  })

  test("detached HEAD header", () => {
    const r = parseStatusOutput("## HEAD (no branch)\n")
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.branch).toBe("HEAD (no branch)")
  })

  test("classifies staged, unstaged, and untracked files", () => {
    const raw = ["## main...origin/main", "M  staged-only.txt", " M unstaged-only.txt", "MM both.txt", "?? new-file.txt"].join(
      "\n",
    )
    const r = parseStatusOutput(raw)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.staged).toEqual(["staged-only.txt", "both.txt"])
    expect(r.value.unstaged).toEqual(["unstaged-only.txt", "both.txt"])
    expect(r.value.untracked).toEqual(["new-file.txt"])
  })

  test("keeps rename arrows intact in the filename", () => {
    const raw = ["## main", "R  old-name.txt -> new-name.txt"].join("\n")
    const r = parseStatusOutput(raw)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.staged).toEqual(["old-name.txt -> new-name.txt"])
  })

  test("clean tree yields empty file lists", () => {
    const r = parseStatusOutput("## main...origin/main\n")
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.staged).toEqual([])
    expect(r.value.unstaged).toEqual([])
    expect(r.value.untracked).toEqual([])
  })

  test("rejects output missing the branch header", () => {
    const r = parseStatusOutput("M  file.txt\n")
    expect(r.ok).toBe(false)
  })

  test("rejects empty output", () => {
    const r = parseStatusOutput("")
    expect(r.ok).toBe(false)
  })
})

describe("formatBranchRowLabel", () => {
  test("current branch gets a leading marker", () => {
    expect(formatBranchRowLabel({ name: "main", current: true })).toBe("* main")
  })

  test("non-current branch has no marker character", () => {
    expect(formatBranchRowLabel({ name: "feature/x", current: false })).toBe("  feature/x")
  })

  test("long names are truncated to maxLen", () => {
    const label = formatBranchRowLabel({ name: "x".repeat(100), current: false }, 20)
    expect(label.length).toBe(20)
    expect(label.endsWith("…")).toBe(true)
  })
})

describe("formatStatusHeader", () => {
  test("branch only, no upstream", () => {
    expect(formatStatusHeader({ branch: "main", ahead: 0, behind: 0, staged: [], unstaged: [], untracked: [] })).toBe(
      "main",
    )
  })

  test("with upstream", () => {
    expect(
      formatStatusHeader({
        branch: "main",
        upstream: "origin/main",
        ahead: 0,
        behind: 0,
        staged: [],
        unstaged: [],
        untracked: [],
      }),
    ).toBe("main (origin/main)")
  })

  test("with upstream and ahead/behind", () => {
    expect(
      formatStatusHeader({
        branch: "main",
        upstream: "origin/main",
        ahead: 1,
        behind: 2,
        staged: [],
        unstaged: [],
        untracked: [],
      }),
    ).toBe("main (origin/main, ahead 1, behind 2)")
  })
})

describe("summarizeList", () => {
  test("returns everything when under the limit", () => {
    expect(summarizeList(["a", "b"], 5)).toEqual({ shown: ["a", "b"], more: 0 })
  })

  test("truncates and reports the remainder when over the limit", () => {
    expect(summarizeList(["a", "b", "c", "d"], 2)).toEqual({ shown: ["a", "b"], more: 2 })
  })

  test("exactly at the limit reports no remainder", () => {
    expect(summarizeList(["a", "b"], 2)).toEqual({ shown: ["a", "b"], more: 0 })
  })
})

describe("splitIntoColumns", () => {
  test("fills each column top to bottom before starting the next", () => {
    expect(splitIntoColumns(["a", "b", "c", "d", "e"], 2)).toEqual([["a", "b"], ["c", "d"], ["e"]])
  })

  test("a short list is a single column", () => {
    expect(splitIntoColumns(["a", "b"], 6)).toEqual([["a", "b"]])
  })

  test("an empty list has no columns", () => {
    expect(splitIntoColumns([], 6)).toEqual([])
  })

  test("a non-positive row count is treated as one row", () => {
    expect(splitIntoColumns(["a", "b"], 0)).toEqual([["a"], ["b"]])
  })
})

describe("rowsForWidth", () => {
  test("keeps the preferred height when the columns fit", () => {
    expect(rowsForWidth(12, 30, 120, 6)).toBe(6)
  })

  test("grows taller when the band is too narrow", () => {
    expect(rowsForWidth(12, 30, 60, 4)).toBe(6)
  })

  test("a band narrower than one cell still yields one column", () => {
    expect(rowsForWidth(5, 40, 20, 3)).toBe(5)
  })
})

const BRANCHES = [
  { name: "main", current: true },
  { name: "feat/sandbox-rewrite", current: false },
  { name: "fix/sandbox-trailing-slash", current: false },
  { name: "sandbox", current: false },
  { name: "feature/seo", current: false },
]

describe("filterBranches", () => {
  test("an empty query keeps everything in order", () => {
    expect(filterBranches(BRANCHES, "  ")).toEqual(BRANCHES)
  })

  test("ranks exact, then prefix/segment-prefix, then substring", () => {
    expect(filterBranches(BRANCHES, "sandbox").map((b) => b.name)).toEqual([
      "sandbox",
      "feat/sandbox-rewrite",
      "fix/sandbox-trailing-slash",
    ])
  })

  test("is case-insensitive and matches substrings", () => {
    expect(filterBranches(BRANCHES, "SEO").map((b) => b.name)).toEqual(["feature/seo"])
    expect(filterBranches(BRANCHES, "trailing").map((b) => b.name)).toEqual(["fix/sandbox-trailing-slash"])
  })

  test("no match yields an empty list", () => {
    expect(filterBranches(BRANCHES, "zzz")).toEqual([])
  })
})

describe("resolveCheckoutTarget", () => {
  test("empty query does nothing", () => {
    expect(resolveCheckoutTarget(BRANCHES, "")).toEqual({ kind: "none" })
  })

  test("checks out the best match", () => {
    expect(resolveCheckoutTarget(BRANCHES, "sand")).toEqual({ kind: "checkout", branch: "sandbox" })
  })

  test("skips the current branch for the next match", () => {
    const branches = [{ name: "main", current: true }, { name: "main-v2", current: false }]
    expect(resolveCheckoutTarget(branches, "main")).toEqual({ kind: "checkout", branch: "main-v2" })
  })

  test("only the current branch matching does nothing", () => {
    expect(resolveCheckoutTarget(BRANCHES, "main")).toEqual({ kind: "none" })
  })

  test("no match creates the branch", () => {
    expect(resolveCheckoutTarget(BRANCHES, "feat/new-thing")).toEqual({ kind: "create", branch: "feat/new-thing" })
  })

  test("no match with an invalid name is refused", () => {
    expect(resolveCheckoutTarget(BRANCHES, "-x")).toEqual({ kind: "invalid" })
    expect(resolveCheckoutTarget(BRANCHES, "two words")).toEqual({ kind: "invalid" })
  })
})

describe("formatCheckoutHint", () => {
  test("names the branch Enter acts on", () => {
    expect(formatCheckoutHint({ kind: "checkout", branch: "dev" })).toContain("checkout dev")
    expect(formatCheckoutHint({ kind: "create", branch: "dev" })).toContain("create new branch dev")
  })
})

describe("back", () => {
  test("parses and maps to git checkout -", () => {
    expect(parseGitCommand("back").command).toEqual({ kind: "back" })
    expect(toArgv({ kind: "back" })).toEqual(["checkout", "-"])
  })
})
