# fable-implementation-flow

English | [日本語](./README.ja.md)

Build software features, apps, games, prototypes, or bug fixes with a **Fable-style implementation workflow** — drive a broad request all the way from brief to verified, working code.

## Overview

This plugin packages the `fable-implementation-flow` skill. Claude invokes it automatically when you ask to implement something thoroughly (rather than only get advice), or when you reference a "Fable thought" / "思考プロセス" / "実装ログのように" style of execution.

The skill encodes a repeatable engineering loop:

1. **Frame the request** — infer platform, framework, UI language, assets, persistence, and the verification path.
2. **Gather local context first** — read project files, config, and conventions before editing.
3. **Choose a concrete architecture** — name state objects, services, models, constants, and isolation constraints.
4. **Start long-running work early** — kick off asset/build tasks in the background while implementing.
5. **Implement foundation outward** — config first, then models, then core mechanics, then polish.
6. **Validate by replaying the system** — walk critical flows, check numerical edge cases, run builds/tests.
7. **Fix errors with tight feedback loops** — inspect the exact API, prefer minimal local fixes.
8. **Finish with evidence** — confirm it works, summarize what changed and how it was verified.

## Installation

### From Claude Code (Recommended)

```
/plugin marketplace add nogu66/claude-code
/plugin install fable-implementation-flow@nogu66/claude-code
```

Restart Claude Code to activate the plugin.

### Manual Installation

```bash
git clone https://github.com/nogu66/claude-code.git
```

Then in Claude Code:

```
/plugin marketplace add ./claude-code
```

## Usage

The skill is invoked automatically by Claude when a task matches its description. You can also nudge it explicitly:

```
Use fable-implementation-flow to build this feature from brief through verification.
```

## What it produces

- Finished, verified results instead of plan-only output.
- Short, useful progress updates (decisions and checks, not raw deliberation).
- A concise final summary of what changed, how it was verified, and any residual risk.

## License

MIT
