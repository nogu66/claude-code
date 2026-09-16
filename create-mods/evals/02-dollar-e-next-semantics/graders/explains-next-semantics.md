---
type: llm
focus: last_message
weight: 1
---
next(e) は0回以上呼び出し可能で、呼ぶたびに新しい内側の dispatch がトリガーされること（2回呼べば内側のフック連鎖とcoreがもう一度走る）を正しく説明している。
.catch ハンドラの中では next.called（next が呼ばれたかどうか）と next.error（{ kind, message, budget }）が使えること、next.called が false のときに next(e) を呼び直すことでリトライできる、という点を正しく説明している。
