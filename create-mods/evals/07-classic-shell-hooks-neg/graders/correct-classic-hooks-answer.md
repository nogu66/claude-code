---
type: llm
focus: last_message
weight: 1
---
以下の3点をすべて満たせば合格、1つでも欠けば不合格とする（文章の自信度・網羅性・言い回しの違いでは判定しない）。
1. settings.json の hooks キー配下の構造（イベント名 → matcher → hooks 配列、または同等の説明）に触れている。
2. type: "command" を使う classic hooks の入出力（stdinでJSONを受け取る／exit codeやJSON出力で制御する、など）について、外部プロセス起動型の hook として説明している。
3. function hooks 特有の概念（$/e/next、five-tier chain、Claude Mods という語）を持ち出して classic hooks と混同していない。
