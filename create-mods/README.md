# create-mods

English | [日本語](./README.ja.md)

Reference and workflow for **Claude Mods** — plugins built on Claude Code's early-access
**function hooks** system.

## Overview

This plugin packages the `create-mods` skill. Claude invokes it automatically when the
conversation mentions "Claude Mods", `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS`, or asks how Claude
Code's plugin system relates to "function hooks" — including when it needs the full `$` API /
event reference to actually build one.

The skill covers:

1. **Mental model** — how function hooks (in-process, middleware-style) differ from classic
   shell-based hooks.
2. **Core primitives** — the `$` / `e` / `next` hook signature, and the full `next()` semantics
   (`next.trace`, `next.origin`, `next.is`, `next.to`, `.catch` recovery).
3. **The five-tier authority chain** — `prepend → user → append → builtin → core`, and the
   "Rules of the Road" (spelling, identity, failure, recursion, trust, orgs, globs, agents,
   loading).
4. **Full `$` API and event reference** (`references/api-reference.md`) — every noun/verb on
   `$`, and the definitive `on(...)` event list with core-side-effect markers.
5. **Official reference mods** — the three mods that actually ship in the binary (`sec-default`,
   `diff`, `telemetry`), read from [`anthropics/claude-code/tree/main/mods`](https://github.com/anthropics/claude-code/tree/main/mods)
   itself, plus the **noun contracts** pattern for a mod that adds to `$` via `engine.create`.
6. **UI rendering** (`references/ui-rendering.md`) — `ui.render` components/elements, pane /
   redraw / hover / `Client` mechanics, and the cc-arcade pattern of running interactive UI as
   its own drawing-thread module.
7. **Architecture pattern for building a mod** — split into a hooks module, surface (`Client`)
   modules, and pure logic modules, learned from a real high-quality mod (`sezaakgun/cc-arcade`).
8. **Testing** (`references/testing.md`) — the official testing kit (`claude-code/testing`),
   `claude plugin test`, mocking `$.env`/`$.store`/`$.clock`, and seating a provider plugin for a
   noun-contract dependency.
9. **Implementation ideas** (`references/implementation-ideas.md`) — a categorized brainstorm
   across security, dev productivity, observability, UI/UX, memory, integrations, and
   onboarding.

Sources, most authoritative first: the official
[`anthropics/claude-code/tree/main/mods`](https://github.com/anthropics/claude-code/tree/main/mods)
folder (the mods that actually ship in the binary, with their tests); GitHub issue
[anthropics/claude-code#91870](https://github.com/anthropics/claude-code/issues/91870); and
Anthropic's official "$ cheat sheet" (2026-09-09). Function hooks are still early-access and
iterating — run `/plugin-types` in a live session for the current, authoritative type
definitions.

## Installation

```
/plugin marketplace add nogu66/claude-code
/plugin install create-mods@nogu66/claude-code
```

Or locally:

```bash
git clone https://github.com/nogu66/claude-code.git
```

```
/plugin marketplace add ./claude-code
/plugin install create-mods@nogu-marketplace
```

## License

MIT
