# `$` API and Event Reference

This is a snapshot from Anthropic's official "$ cheat sheet" (2026-09-09) and the community
update thread on [anthropics/claude-code#91870](https://github.com/anthropics/claude-code/issues/91870).
Function hooks are still early-access and iterating — treat this as a map, not a contract.
For the current, authoritative shape, run `/plugin-types` in a live session (writes
`.claude/types/claude-code.d.ts`) and read that instead.

Every verb below is itself a hookable event (e.g. `on("fs.read", ...)`, `on("http.fetch", ...)`).

## `$` Nouns and Verbs

| Noun | Verb | Description |
|---|---|---|
| `$.tool` | `.call` | Run a tool through hooks and permissions |
| | `.list` | Tools currently available to the model |
| | `.register` | Give the model a new tool |
| `$.command` | `.run` | Execute as if `/command` had been typed |
| | `.list` | Slash commands currently available |
| | `.register` | Add `/yourcommand` |
| `$.prompt` | `.submit` | Queue a prompt as this plugin |
| | `.fill` / `.suggest` | Write into the prompt box / show a dimmed post-turn suggestion |
| `$.agent` | `.spawn` | Start a subagent, resolves on completion |
| | `.list` | Subagents: id, name, parentId, status |
| `$.turn` | `.abort` | Cancel the running turn |
| `$.session` | `.id` / `.cwd` / `.repo` / `.model` | Read: identifiers, location, repo, active model |
| | `.surfaces` / `.turns` | Read: currently connected surfaces / turn count so far |
| | `.messages` | Transcript, message by message |
| | `.usage` | Context window usage, rate limits, cost |
| | `.compact` | Compact now (like `/compact`), goes through `session.compact` |
| | `.authorize` | Opaque credential handle, consumed by `http.fetch` |
| `$.model` | `.complete` | One completion on the session's client |
| | `.fork` | Tool-less completion on this transcript (shares cache) |
| | `.classify` | Pick one label for a piece of text from your own label set |
| `$.ui` | `.log` / `.notice` | Transcript line / line under the dialog |
| | `.toast` / `.status` | Notification banner / your own status-line slot |
| | `.ask` | The engine's AskUserQuestion dialog |
| | `.open` / `.close` | Open/close a pane (render surface) |
| | `.invalidate` | Re-run a cached event: `ui.render`, `prompt.section`, `tool.describe` |
| | `.resolve` | Element constructor set for `e.surface` |
| `$.fs` | `.read` / `.write` / `.list` | Host filesystem (same reach as the process) |
| | `.stat` / `.exists` | Type/size/mtime / never throws |
| | `.ancestors` | Named instruction files above cwd |
| `$.settings` | `.read` | Resolved settings, or one layer: `{ source: "policy" }` |
| `$.config` | `.set` / `.list` | Change a `/config` row via the same path as the menu / list rows |
| `$.env` | `.get` / `.set` | Get/set one variable by literal name (`validate` enumerates allowed r/w) |
| `$.store` | `.get` / `.set` / `.delete` / `.keys` | Per-plugin persistent JSON |
| `$.http` | `.fetch` | Fetch via the host; `{ auth }` consumes an authorize handle |
| `$.process` | `.run` | Run argv on the host (no shell); stdout/stderr/code |
| `$.mcp` | `.call` | Call a tool on a connected MCP server |
| `$.clock` | `.now` / `.sleep` / `.after` / `.every` | Time and cancellable timers |
| `$.audio` | `.play` / `.speak` | Play a clip / platform text-to-speech |
| `$.plugin` | `.name` / `.root` | Who am I, where am I |

## Full Event List (`on("...")`)

Legend: ◆ = has a core-side side effect (won't happen unless `next` is called; calling it twice
runs it twice) · ◇ = no core side effect.

| | Event | Description |
|---|---|---|
| ◆ | `tool.call` | `e = { tool, tool_use_id, agentId?, ...input }` → result \| `{ deny }` |
| ◇ | `describe` (tool) | The tool description shown to the model. `e.provider` = source |
| ◇ | `check` | Permission decision → `{ decision }` |
| ◆ | `prompt.submit` | The submitted prompt; core runs the turn → `{ text, context[] }` |
| ◆ | `fill` / `suggest` | Writing into the box / post-turn dimmed suggestion. Rewritable/denyable |
| ◇ | `context` | Context injected per turn |
| ◇ | `section` | One section of the system prompt |
| ◇ | `turn.start` | `{ turnId, text }` — before the turn starts |
| ◆ | `step` | One streaming request to the model: `async function*` hook, `yield* next({ ...e, model, effort })` |
| ◇ | `complete` (turn) | `{ text }` + usage, after the turn ends |
| ◇ | `session.start` | `{ cwd, ... }` — once per session |
| ◇ | `receive` | Before incoming data enters context → `{ text }` \| `{ consumed }` |
| ◆ | `compact` | `{ trigger, instructions?, messages }` → `{ messages }` \| `{ skip }` |
| ◇ | `attach` / `detach` | Surface (desktop/mobile) connect/disconnect: `{ surface, clientId }` |
| ◆ | `agent.spawn` | `{ prompt, model, provider, parentAgentId?, ... }` → `{ text }` |
| ◇ | `offer` | Agent types offered to the model |
| ◆ | `command.run` | `/name args` → `{ text }` |
| ◇ | `describe` (command) | Command listing content. `e.provider` |
| ◆ | `config.set` | `/config` row change: `{ key, value, previous, provider }` → `{ value }` \| `{ deny }` |
| ◇ | `describe` (config) | How a menu row is displayed; can relabel or hide it |
| ◇ | `ui.render` | `{ surface, component, props }` → element tree |
| ◆ | `press` / `input` | A Button/Input you drew was used |
| ◆ | `message` (ui.message) | Your `Client` surface module posted data |
| ◇ | `resolve` | Element table for a given surface |
| ◇ | `skill.prompt` | When a skill's text loads |
| ◇ | `engine.create` | The `$` fold itself — add/remove nouns |
| ◇ | `plugin.register` | Install-time review: `{ name, tier, uses[] }` → allow \| deny |
| ◆ | `classic.*` | Same JSON in/out as classic settings hooks; a configured shell hook is core at that seam |
| ◆ | `*` | Every event above, and every `$` operation (`fs.read`, `http.fetch`, `store.set`, ...), at your position with your authority: rewrite, deny, or `next.to` |

### Ordering = Nesting

**X = A · B · C · core = A(B(C(core(⊥))))**. Front-on it's a sequence diagram (call → `next(e)` →
wait → resume); side-on each bar is really a ring (its hollow is the inner call); top-down it's
an onion with core innermost — position *is* authority. Anyone can add a noun to the fold:

```javascript
on("engine.create", async ($, e, next) => ({ ...await next(e), audit: { record } }))
```
