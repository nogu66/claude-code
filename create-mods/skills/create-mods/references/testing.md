# Testing a Mod

Source: the "Testing" and "Composing mods: noun contracts" sections of the official
[`anthropics/claude-code/tree/main/mods`](https://github.com/anthropics/claude-code/tree/main/mods)
README — the mods that actually ship in the binary (`sec-default`, `diff`, `telemetry`), not a
third-party example. Treat this as more authoritative than the community issue thread for
anything it covers.

## Running Tests

A mod's tests live in its own `tests/` folder and run with:

```sh
claude plugin test mods/diff
```

A test file is named for what it covers under `hooks/` — `register.test.ts` beside
`hooks/register.ts`, `git.test.ts` beside `hooks/git/` — and holds its imports, the tier the mod
loads in, and one `describe` titled with that name. What several tests share sits under
`tests/fixtures/`, one export per file.

## The Testing Kit (`claude-code/testing`)

```ts
import { describe, expect, mock, test, tier } from 'claude-code/testing'

tier('builtin')

describe('register', () => {
  test('outside a git repository /diff says so, opens nothing', async ($, on) => {
    const opened: string[] = []
    mock.clock(on)
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('command.register', ($, e) => ({ value: { command: e.name } }))
    on('process.run', () => ({
      value: { exitCode: 128, stdout: '', stderr: 'fatal: not a git repository' },
    }))
    on('ui.open', ($, e, next) => {
      opened.push(e.id)
      return next(e)
    })

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    const { text } = await $.command.run({
      command: 'diff',
      args: '',
      origin: { kind: 'composer' },
    })

    expect(text).toContain("isn't in a git repository")
    expect(opened).toEqual([])
  })
})
```

A test gets the engine's own `$` and a plugin's `on`. Each call on `$` is one the engine makes,
through every hook of the mod loaded as it ships. The hooks the test registers with `on` sit
beneath the mod, where the rest of the world would be, and nothing is beneath them: a call they
leave unanswered throws, naming its event.

`tier(...)` declares which tier the mod under test loads in (`'prepend' | 'user' | 'append' |
'builtin'`) — needed because some moves (e.g. `sec-default`'s `next.to`) are only legal from a
managed tier.

### `mock` — answering the world beneath the mod

| Call | Mocks |
|---|---|
| `mock.env(on, variables)` | `$.env` |
| `mock.store(on, entries)` | `$.store` |
| `mock.clock(on)` | `$.clock` — its `advance(ms)` resolves every wait the mod asked for (`$.clock.sleep`, `after`, `every`) as the clock crosses it |

To see what a dispatch does before it answers, start it unawaited, `await clock.settle()`, then
look: the clock stays where it was.

`$.ui.press({ plugin, key })` presses a `Button` the test rendered, as a click in the terminal
does.

## Typechecking

```sh
tsc -p mods/tsconfig.json
```

Typechecks every mod's hooks and tests against the shared `types/` and each mod's own `types/`
contract in one pass.

## Noun Contracts: Testing a Mod That Depends on Another Mod's Noun

When a mod calls a noun another mod added (e.g. `diff` calling `$.telemetry.log(...)`, a noun
`telemetry` adds via its `engine.create` hook), the test seats a **provider** for it: an inline
plugin whose `engine.create` hook adds the noun, answering the calls the way it answers the
engine's:

```ts
on('telemetry.log', ($, e) => ({ value: undefined }))
```

typed by the noun's own contract (`import type { Telemetry } from '../../telemetry/types'`).
With no provider loaded, the `$` build refuses the hook, naming the noun nobody provides — so a
test that never seats `telemetry` and never calls `$.telemetry` still passes; one that calls it
without seating a provider fails loudly, by name, rather than silently returning `undefined`.

This mirrors production behavior: `diff` calls `$.telemetry.log`/`.mark`, but says explicitly
that "`$.telemetry` is the telemetry plugin's noun; where it is absent the rows are dropped and
nothing else changes" — a mod that depends on an optional noun should degrade the same way, not
throw when the noun isn't there.

See `SKILL.md`'s "Composing Mods: Noun Contracts" section for how a mod owns and publishes a
noun's types in the first place.
