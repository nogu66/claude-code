---
name: create-mods
description: Use when the user mentions "Claude Mods", asks what Claude Mods are, references CLAUDE_CODE_ENABLE_FUNCTION_HOOKS, asks how Claude Code's mod/plugin system relates to "function hooks", or needs the `$` API / event reference to build one.
---

# Claude Mods

## Overview

"Claude Mods" is the product name for plugins built on **function hooks** — Claude Code's
TypeScript hook system. "Function hook" is still the engineering term for the underlying
primitive; a **mod is just a plugin that uses function hooks**, nothing more.

Sources: GitHub issue [anthropics/claude-code#91870](https://github.com/anthropics/claude-code/issues/91870)
(community update thread — still iterating, treat exact APIs/affordances as subject to change;
re-check the issue before relying on specifics) and Anthropic's official "$ cheat sheet"
(2026-09-09). Run `/plugin-types` in a live session for the authoritative, current type
definitions (`.claude/types/claude-code.d.ts`) — everything below can drift.

## Mental Model

Classic hooks launch an external shell process at a fixed timing and can only trade text /
allow-deny decisions. Function hooks are **functions that run inside the Claude Code process
itself**, using an Express/Koa-style middleware pattern: an event arrives, hooks run in
registration order, each can call `next()` to hand off to the next hook (and eventually core),
and can inspect or rewrite the result on the way back up.

| Classic hooks | Function hooks |
|---|---|
| External shell script | Function running inside the Claude Code process |
| Text in / text out only | Can render UI (JSX), register tools, persist state, run timers |
| Called once, after the fact | `next()` lets a hook intervene before *and* after, and rewrite results |
| Hard to compose across plugins | Naturally chains by registration order/tier (prepend/user/append/builtin) |

## Core Primitives: `$`, `e`, `next`

Every hook function is `($, e, next) => ...`:

| Arg | Role |
|---|---|
| `$` | The **only** way to touch the outside world — UI, model, storage, timers, tool registration. Hooks run sandboxed; without `$` they can do nothing (this is the safety boundary). Every `$` method is itself a hookable event. |
| `e` | The event's input, a flat plain object. Identity fields (`tool`, `tool_use_id`, `agentId`, `origin`, `provider`, `trigger`, `keys`) are pinned; everything else is freely rewritable. |
| `next` | Calling `next(e)` runs every hook further in, then core, and returns the result. Returning without calling it short-circuits core (e.g. `{ deny: "..." }` for `tool.call`). |

```javascript
export function register(on) {
  on("tool.call", { tool: "Bash" }, async ($, e, next) => {
    if (e.command.includes("rm -rf /")) return { deny: "no" }
    const r = await next(e)               // run everything further in, then core
    return { ...r, text: redact(r.text) } // rewrite the result on the way back up
  })
  .catch(($, e, next) =>                  // on throw or timeout
    next.called ? next(e) : { deny: next.error.kind })
}
```

A hook can also observe rather than intervene: call `next(e)` first and react to the result
afterward (e.g. cc-arcade increments a turn counter and redraws only *after* `next(e)`
resolves in its `turn.complete` hook, and re-runs `next(e)` unmodified in `tool.call` just to
watch for a matching Bash command without slowing down the real tool execution).

### `next` cheat sheet

| Expression | Meaning |
|---|---|
| `next(e)` | Run all inner hooks → core, return the result |
| return without calling `next` | Answer instead of core: `{ deny }` for `tool.call`, or a custom result |
| `next.trace` (after await) | Per-link trace: plugin / tier / `e` / result / outcome |
| `next.origin` | Caller's `{ plugin, tier }` (or `{ engine, core }` if the engine dispatched) |
| `next.event` | The actual event name dispatched, inside a glob/`*` hook |
| `next.is("tool.*", e)` | Type predicate — narrows `e` (and the result) to matching events |
| `next.to(e, "builtin")` | managed-only: continue at a lower tier (narrowing only) |
| `next(e); next(e)` | Callable 0+ times; each call triggers a fresh inner dispatch |
| `next.error` / `next.called` | Inside `.catch`: `{ kind, message, budget }`, and whether `next` was called (retry with `next(e)`) |

## The Chain: Five Tiers of Authority

Authority decreases toward core: **prepend → user → append → builtin → core**.

| prepend | user | append | builtin | core |
|---|---|---|---|---|
| Org policy | What you installed | Org policy | Shipped with the binary | The engine itself |

```javascript
on("*", ($, e, next) => next.to(e, "builtin")) // "factory default" product, in one line
```

One fold applies to every event: going in, each link can edit `e` (append is closest to the
product); core answers by default; coming back out, each link can edit the result (prepend is
closest to the engine). Organizations hold both ends. **X = A · B · C · core =
A(B(C(core(⊥))))** — position in the chain literally *is* authority.

## Rules of the Road

| Rule | Content |
|---|---|
| spelling | `$` is always written as a literal `$.noun.verb(...)`; `on("event")` likewise. The loader statically enumerates both and rejects anything it can't see. |
| identity | Identity fields on `e` (`tool`, `tool_use_id`, `agentId`, `origin`, `provider`, `trigger`, `keys`) are pinned; everything else is freely rewritable. |
| failure | A throw or >10s hang skips that hook with a one-line notice (a declared `.catch` gets a grace budget with `next`-equivalent authority to answer instead). A malformed return type is always skipped too. |
| recursion | A hook never sees dispatches it caused itself (its own `$` calls, its own `next`, subagents it spawned). Sibling hooks and other origins do see them. |
| trust | Plugins are trusted code with the same reach as the process. Orgs can hook `plugin.register` to inspect each plugin's static `uses` and reject it. |
| classic | Every `settings`-based hook is wrapped 1:1 as `classic.<Event>` with the same JSON in/out. Configured shell hooks are core at that seam. |
| orgs | On a managed machine / Team-Enterprise plan, `sec-default` sits outermost, so personal plugins can't touch classic hooks, prompt sections, settings reads, or org tool descriptions. An org that sets `prependPlugins` owns that tier. |
| globs | `on("tool.*")`, `on("classic.*")`, `on("*")` narrow `e` to the union type of matching events. |
| agents | `tool.call` inside a subagent carries `agentId`; resolve via `$.agent.list()` (name/parentId/type). Origin (which plugin) and agent (which loop) are separate axes. |
| loading | `plugin.json` + `hooks/hooks.json` (`{ "modules": ["./hooks.js"] }`). `claude --plugin-dir ./my-mod` hot-reloads on save — Claude can write and iterate on a Mod live. |

## `$` API and Full Event List

See `references/api-reference.md` for the complete `$` noun/verb table and the definitive list
of every `on(...)` event (with ◆/◇ markers for whether it has a core side effect). Load it
before wiring a mod to anything beyond `tool.call`/`ui.render`.

## UI Rendering

See `references/ui-rendering.md` for the `ui.render` component/element lists, pane / redraw /
hover / `Client` mechanics, and the cc-arcade pattern of running a game board as its own
drawing-thread module.

## Enabling / Trying It

```
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

Or try a mod without installing it:

```sh
git clone https://github.com/sezaakgun/cc-arcade
cd cc-arcade
claude --plugin-dir .
```

Built-in mod source lives at [anthropics/claude-code/tree/main/mods](https://github.com/anthropics/claude-code/tree/main/mods).

## Building or Debugging a Mod

Use the **plugin-authoring** skill for the exact hooks module shape (`register(on, options)`,
`hooks($, e, next)`), how to run a plugin under development, and where the engine reports
refusals. This skill adds the architecture pattern below, learned from a real, high-quality
mod (`sezaakgun/cc-arcade`) rather than from first principles — a plugin built without it
tends to come out lower quality (monolithic hook, untestable logic, unhandled store errors).
It's cached locally: `~/.claude/plugins/marketplaces/cc-arcade` — read it directly for a full
worked example when building something non-trivial.

Shortest path to a first mod:

1. Set up `.claude-plugin/plugin.json` and `hooks/hooks.json`.
2. Write `hooks/register.tsx` with `export const register: Register = on => { on('event', ($, e, next) => {...}) }`.
3. Run `/plugin-types` in-session to generate `.claude/types/claude-code.d.ts` — the one
   authoritative spec for events and `$`.
4. Run `claude plugin validate .` to check the hook registrations.
5. Save — it hot-reloads into the running session (`register` re-runs from scratch).

## Architecture Pattern (from cc-arcade)

Split any non-trivial mod into three layers, not one big hook file:

1. **Hooks module** (`hooks/register.tsx`, referenced by `hooks/hooks.json`'s `modules` array).
   Registers on events (`session.start`, `command.run` filtered by `{ command: 'x' }`,
   `turn.start`/`turn.complete`, `tool.call`, `ui.message`, `ui.render` filtered by
   `{ component: 'AbovePrompt' }`, etc). Owns all persistent state via `$.store`, registers
   slash commands via `$.command.register`, and is the only layer that touches `$`.
2. **Surface modules** (`hooks/boards/*.tsx`), mounted from the hooks module via
   `<Client module="./boards/x.tsx" props={...} />`. Each runs on its own drawing thread with
   its own frame clock/keyboard/mouse and posts results back via `ui.message`. **Module paths
   must be string literals** — the engine reads them statically off the source, not at runtime.
   Extract shared rendering helpers (e.g. a `common.tsx`) instead of duplicating per-board.
3. **Pure logic modules** (`hooks/games/*.ts`) — plain functions with no `$`, no hooks, no UI.
   This is what makes the mod actually testable: tests hit these functions directly, never the
   hooks/UI layers.

cc-arcade wires exactly seven events this way — `session.start`, `command.run`, `turn.start`,
`turn.complete`, `tool.call`, `ui.message`, `ui.render` — each a thin, single-purpose hook
rather than one monolithic handler. That's the general pattern: hook the lifecycle at several
small, well-named points instead of writing one big function.

Quality rules worth copying directly:

- **Never let a `$.store` (or other async `$`) call reject unhandled** — an unhandled rejection
  in the hooks module unmounts the whole mod. Wrap every such call: `.catch(err => { $.ui.log(...); return fallback })`.
- Re-read shared state (e.g. `$.store.get(...)`) before mutating it when multiple sessions could
  run the same mod concurrently, instead of trusting an in-memory copy.
- Never name a local variable `h` in a `.tsx` hook/board file — JSX compiles every tag to a call
  to `h`, and a shadowing local `h` breaks the first draw.
- Keep the hooks module itself free of game/business rules; it should only wire events to the
  pure logic and surface modules.

## Implementation Ideas

See `references/implementation-ideas.md` for a categorized brainstorm — security/governance,
dev productivity, observability, UI/UX, knowledge/memory, external integration, onboarding.
Untested ideas for inspiration, not a roadmap; most reduce to one of three shapes: `tool.call` +
`{ deny }` (guard), `ui.render` + `Pane`/`Client` (persistent UI), or `$.store` + `prompt.submit`
(memory).

## Dev Workflow

From a mod's repo root (mirroring cc-arcade's):

```sh
bun test                                              # pure logic only — no $ or UI to mock
bunx --bun oxlint@<version> hooks tests --deny-warnings
claude plugin validate .claude-plugin/plugin.json     # lists hooked events, $ calls, surface modules
claude plugin validate .                              # checks the marketplace manifest
```

Type-checking needs early-access types: run `/plugin-types` in a session with function hooks on
(writes `.claude/types/`), then `tsc`. Edits hot-reload into a running session; if a reload fails
partway, restart the session rather than trusting the half-applied state.

## Manifest Files

- `.claude-plugin/plugin.json` — name, version, description, author, homepage/repository,
  license, keywords.
- `.claude-plugin/marketplace.json` — lets the plugin's own repo double as its marketplace.
- `hooks/hooks.json` — `{ "description": "...", "modules": ["./register.tsx"] }`. Builds without
  function hooks enabled simply ignore the `modules` key, so it's safe to ship unconditionally.
- Ship a `.claude/settings.json` with `{ "env": { "CLAUDE_CODE_ENABLE_FUNCTION_HOOKS": "1" } }`
  in the repo so `claude --plugin-dir .` works for local development without extra setup.
