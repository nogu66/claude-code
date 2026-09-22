# Agent Aquarium — Claude Mod

Claude Code の作業状態を、Kitty graphics で描いた水槽としてリアルタイム表示する Claude Mod。
仕様は SPEC.md、素材は assets/（生成済み・manifest.json 参照）。

## 最重要ルール
- Claude Mods は暫定仕様。**API名・シグネチャは記憶で書かない。** 必ず最初に `/plugin-types` の型定義を読み、SPEC.md の「要確認API」を実物で確定させてから書く。
- 参考記事: https://zenn.dev/nogu66/articles/claude-code-function-hooks-claude-mods
- pane座標の取得と Kitty エスケープの書き込みは、既存の terminal-browser Mod の実装を先に読んで方式を合わせる。
- このModは**観測専用**。tool.call では必ず `await next(e)` を先に呼び、結果を改変しない。ハンドラは軽く、`.catch` を付ける。

## 作業手順
1. 検討（コードを書く前に）: 要確認APIを確定 → 状態モデル・座標系・フレーム予算を数値で決める
2. register.tsx（イベント収集・状態）と Client モジュール（アニメーション描画）を分けて実装
3. `claude --plugin-dir .` で起動し、ホットリロードで確認
4. `claude plugin validate .` を通す
5. SPEC.md の受け入れ条件を1つずつ確認して報告

## 素材の扱い
- スプライトは作り直さない。変更が必要なら tools/gen_sprites.py を編集して再生成（Pillow）。
- コマの矩形は manifest.json から引く。ハードコードしない。
