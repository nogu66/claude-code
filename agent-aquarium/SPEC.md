# SPEC: Agent Aquarium

## 登場キャラ
- 親魚 = メインループ。シート `parent_*`（160x80px）
- 稚魚 = サブエージェント。`$.agent.list()` の parentId で親の近くに群れる。type ごとに色:
  Explore=blue / general-purpose=orange / その他=green / 4種目以降=purple（シート 96x48px）
- 未知の agentId が tool.call に現れたら誕生（spawn 4コマ → swim）
- 完了したら端へ泳ぎ去り exit 4コマ → 削除
- 稚魚は最大12匹。超過分は群れの横に「+N」バッジ

## ツール → 状態
| ツール | 状態 | 演出 |
|---|---|---|
| Read / Grep / Glob | eat | 水面から餌（props: food）が落ち、食べに行く |
| Edit / Write | swim | 泡（bubble_*）を吐き、砂に巣（nest）が1つ増える |
| Bash | dash | 一時的に速度3倍 |
| WebFetch / MCP | swim | 水面付近へ浮上 |
| 結果がエラー | error | 4コマ再生→2秒沈む→swimで復帰 |
- 魚の上に吹き出し（テキスト）でツール名＋短い引数を1.5秒（例: `Edit auth.ts`）

## 水槽
- 背景: 上 #2878B4 → 下 #081E46 のグラデーション（実行時生成、リサイズ時のみ再生成）、下端に砂
- 水草: seaweed.png 4コマを 250ms ごとに切替、2〜3本
- 水位 = `$.session.usage` のコンテキスト使用率に連動（使うほど減る。compact で戻る）
- turn.start で少し明るく、turn.complete で元に戻す

## 描画（Kitty graphics protocol）
- 起動時に全シートを1回だけ転送（a=t, f=100, i=<固定ID>）
- 毎フレームは配置更新のみ: a=p, 同一 placement id, ソース矩形 x/y/w/h でコマ切替、X/Y でピクセルオフセット
- z順: 背景 -2 / 水草 -1 / 魚 1 / 泡・餌 2
- 左右の向きは別シート（反転表示は不可）。フェードはコマに焼き込み済み
- 15fps（66ms）。位置は小数で保持しピクセル単位で補間。向き転換はその場反転でよい
- 起動時に a=q で対応確認。非対応ならハーフブロック描画にフォールバック（最低限ASCIIでも可）
- `/aquarium off` とセッション終了時に a=d,d=A で全削除（残像を残さない）
- tmux 非対応でよい（デモは Ghostty 直起動）

## コマンド
- `/aquarium` 表示ON/OFF、`/aquarium full` 大きいpane

## 要確認API（/plugin-types で実物を確認してから使う）
- tool.call の e の形（ツール名・引数・agentId・結果/エラーの取り方）
- `$.agent.list()` の戻り値（id / parentId / type / status）
- `$.session.usage` のフィールド
- 親(register) → Client への状態の渡し方、`$.ui.invalidate('ui.render')`、`surface.every`
- pane の位置・サイズの取得方法と、Kitty エスケープをどこから書き込むか（terminal-browser 参照）

## 受け入れ条件
- [ ] Modあり/なしでツール実行結果が一切変わらない
- [ ] 描画中もプロンプト入力がもたつかない（ハンドラで重い処理をしない）
- [ ] サブエージェント5体並列で5匹生まれ、完了順に退場する
- [ ] エラーで赤く沈み、復帰する
- [ ] 80桁幅でも崩れない
- [ ] OFF・終了で画像が残らない
- [ ] `claude plugin validate .` が通る

## やらないこと
- 音、魚同士の衝突判定、スプライトの実行時生成
