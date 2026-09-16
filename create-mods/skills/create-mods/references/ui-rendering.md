# UI Rendering (`ui.render`)

Hook `ui.render` filtered to a `{ component: ... }` to draw into a given UI region (above the
prompt box, below a tool result, etc):

```jsx
on("ui.render", { component: "ToolUse" }, async ($, e, next) => {
  const { Box, Text, Button } = await $.ui.resolve(e)
  const drawn = await next(e) // whatever the inner hooks drew
  return <Box>
    {drawn}
    <Text dimColor>{e.props.output.length} chars</Text>
    <Button label="copy" onPress={() => $.ui.toast("copied")} />
  </Box>
})
```

**Components**: `UserMessage`, `AssistantMessage`, `ToolUse`, `ToolResult`, `ToolGroup`,
`AskUserQuestion`, `Spinner`, `TurnDuration`, `InfoNotice`, `SessionMode`, `PromptHint`,
`AbovePrompt`, `Pane`.

**Elements**: `Box`, `Text`, `Button`, `Input`, `Select`, `Link`, `Code`, `Svg`, `Client`.

Terminal renders with Ink, desktop with DOM+SVG, mobile with a smaller table set — it's one
element tree, and the surface picks the actual constructor.

- **Pane**: a render site you opened yourself via `$.ui.open({ id })` +
  `on("ui.render", { component: "Pane", requestId: id }, ...)`. Body can be anything a hook
  draws; close with `$.ui.close({ id })`.
- **Redraw**: `$.ui.invalidate("ui.render")` — the engine re-queries all of your render sites.
  Scroll position doesn't move.
- **Hover**: `Box({ key, hover: { borderColor: "cyan" }, children })` — declared on the
  element, applied by the surface. No event or round trip fires.
- **Client**: `Client({ module: "./board.js", key, props })` — surface-side JS with no `$`
  (state, pointer, key input). It can only respond via a `Button` or by posting through
  `surface.post`, which arrives back as a `ui.message` event.

## `Client` Modules as Independent Drawing Threads (cc-arcade)

Each game board (e.g. `boards/snake.tsx`) runs in its **own execution context**, separate from
the main `register.tsx` hooks module. Reason: a game needs ~10 redraws/sec (Doom: 20/sec), and
mixing that with normal hook processing would either slow it down or block other plugins.
Separation gives it:

- Its own frame clock (`surface.every(100, () => {...})` — advance one tick every 100ms)
- Its own keyboard handling (`surface.onKey(...)`)
- Its own mouse handling
- A way to report back: `surface.post({ game: 'snake', score: ... })` (received by the parent
  as a `ui.message` event)

It's effectively a main-process/worker split — the game loop getting heavy never freezes
Claude Code itself.

Snake's actual logic (`games/snake.ts`) is a pure function with no UI awareness:

```ts
export type SnakeGame = { snake: Pt[]; dir: Pt; queued: Pt[]; food: Pt; w: number; h: number; score: number; over: boolean }

export function step(g: SnakeGame, rand = Math.random): SnakeGame {
  if (g.over) return g
  const [dir = g.dir, ...queued] = g.queued
  const head: Pt = [g.snake[0][0] + dir[0], g.snake[0][1] + dir[1]]
  const eats = same(head, g.food)
  const body = eats ? g.snake : g.snake.slice(0, -1)
  // over: true on hitting a wall or its own body
  return { ...g, snake: [head, ...body], food: eats ? newFood() : g.food, score: ... }
}
```

The drawing side (`boards/snake.tsx`) just calls `step()` every 100ms and renders the board with
full-width block characters (`██`, `▓▓`) via a `grid()` helper. **Logic stays a pure function,
rendering stays a separate module** — the split cc-arcade's own README credits for making it
testable.

## Example: `AbovePrompt` (cc-arcade)

Hooking `ui.render` filtered to `{ component: 'AbovePrompt' }` draws into the band above the
prompt input (roughly half the screen height):

```tsx
on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
  if (!active || e.surface !== 'terminal') return next(e)  // pass through if conditions don't match
  const { Box, Button, Client, Text } = await $.ui.resolve(e)  // this surface's element set

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" columnGap={1}>
        <Button label="← games" onPress={toPicker} />
        <Button label="close" onPress={close} />
      </Box>
      <Client key={key} module="./boards/snake.tsx" width={cols} height={rows} props={props} />
      {await next(e)}
    </Box>
  )
})
```

## Persistent State: `$.store`

```ts
await $.store.set('pet', pet)
const saved = await $.store.get('best:snake')
```

Stored in per-plugin storage on the local machine only — never sent over the network. State
(pet, best scores, ...) survives a session restart.
