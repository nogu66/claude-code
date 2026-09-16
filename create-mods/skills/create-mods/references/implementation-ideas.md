# Implementation Ideas

A categorized brainstorm of what a Claude Mod could do, organized by the `$` API / event it
would use. Untested, unprioritized — a menu for inspiration, not a roadmap. Most reduce to one
of three shapes: `tool.call` + `{ deny }` (guard), `ui.render` + `Pane`/`Client` (persistent
UI), or `$.store` + `prompt.submit` (memory). Start with one or two, verify with
`claude --plugin-dir .`.

## Security & Governance

| Idea | API / Event |
|---|---|
| Audit gate for dangerous commands (`rm -rf`, force push, prod DB connections → deny/confirm) | `tool.call` (Bash matcher) + `{ deny }` |
| Two-step approval for production deploy commands | `tool.call` + `$.ui.ask` |
| Secret/PII scan before commit/PR (deny or redact API keys etc.) | `tool.call` + regex + `redact()` (the canonical `THE HOOK` example) |
| Forward tool calls to an external SIEM / audit log | `tool.call` + `$.http.fetch` |
| Org-wide guardrails individual plugins can't remove | `prependPlugins` (builtin/prepend tier) |
| Review/block plugin installation itself | `plugin.register` (inspect static `uses[]`) |
| Minimal-footprint logging of only compliance-relevant operations | `*` glob + `next.origin` to identify the source |

## Dev Productivity & Workflow

| Idea | API / Event |
|---|---|
| Auto lint/test gate before commit (deny on failure) | `tool.call` (detect `git commit`) + `$.agent.spawn` |
| Auto-generate a PR description from the diff | `command.run` + `$.fs.read` + `$.model.complete` |
| Block direct pushes to main, suggest a feature branch | `tool.call` (detect `git push`) + `{ deny }` |
| Monorepo blast-radius analysis (warn about dependent services from changed files) | `tool.call` (git diff) + `$.ui.log` |
| Flaky test detection/logging (track low-reproducibility tests) | `tool.call` (test run results) + `$.store` |
| Auto-display a code review checklist | `ui.render` (ToolResult) + `$.model.classify` |
| Detect breaking changes (API/schema) and inject context automatically | `tool.call` (Edit/Write) + `context` |

## Observability & Dashboards

| Idea | API / Event |
|---|---|
| Real-time cost/context-remaining HUD | `$.session.usage` + `$.ui.status` |
| Progress dashboard for parallel subagents | `$.agent.list` + `ui.render` (Pane) |
| Tool-usage heatmap at session end | `tool.call` aggregation + `$.store` + `ui.render` |
| Send team-wide usage stats to an internal dashboard | `$.session.usage` + `$.http.fetch` |
| Always-on panel showing latest CI build status | `$.http.fetch` (CI API) + `ui.render` (Pane) |

## UI/UX Extensions

| Idea | API / Event |
|---|---|
| Inline diff viewer on ToolResult (with syntax highlighting) | `ui.render` (ToolResult) + `Code`/`Svg` element |
| Voice notification when a long task finishes | `turn.complete` + `$.audio.speak` |
| Next-action suggestions in the prompt box (dimmed text) | `suggest` |
| Hover-to-expand detail panel on tool results | `ui.render` + `hover` |
| Mini-games / break features (cc-arcade style) | `ui.render` (AbovePrompt) + `Client` |

## Knowledge & Memory

| Idea | API / Event |
|---|---|
| Cross-session memory (auto-inject past failure patterns as context) | `prompt.submit` + `$.store` + `context` |
| Auto-reference an internal wiki/docs | `prompt.submit` (keyword detection) + `$.http.fetch` + `context` |
| Check and warn about project-specific naming conventions | `tool.call` (Write/Edit) + `$.ui.toast` |
| Auto-expand a glossary/acronym list into the system prompt | `section` |

## External Integration & Tooling

| Idea | API / Event |
|---|---|
| Turn internal APIs/DBs/ticketing systems into tools on the fly | `$.tool.register` + `$.mcp.call` |
| Slack/Teams notification when a long task completes | `turn.complete` + `$.http.fetch` (webhook) |
| Custom command like `/ticket create` to file a Jira/Linear issue | `$.command.register` + `$.http.fetch` |
| Orchestrate work across multiple MCP servers | `$.mcp.call` + `agent.spawn` |

## Learning & Onboarding

| Idea | API / Event |
|---|---|
| Stricter denies with explanations for risky ops, tuned for newcomers | `tool.call` + `check` (override the permission decision) |
| "Second opinion" button that fetches an independent review on the spot | `ui.render` + `Button` + `$.model.fork` |
| Per-session report of which skills/hooks fired how often | `*` glob aggregation + `$.store` |
