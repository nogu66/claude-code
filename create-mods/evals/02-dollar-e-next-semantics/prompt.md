---
max_turns: 8
timeout_seconds: 150
allowed_tools: [Skill, Read, Glob, Grep]
runs: 3
---
function hooks で next(e) を同じフックの中で2回呼んだらどうなりますか？また .catch ハンドラの中で next.called が false のとき、どうやって処理をリトライできますか？
