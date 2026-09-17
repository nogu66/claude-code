# create-mods

[English](./README.md) | 日本語

Claude Code のearly-access機能である **function hooks** 上に構築されたプラグイン、
**Claude Mods** のリファレンスとワークフローを提供します。

## 概要

このプラグインは `create-mods` スキルをパッケージ化したものです。会話中に「Claude Mods」
「`CLAUDE_CODE_ENABLE_FUNCTION_HOOKS`」への言及や、Claude Codeのプラグイン機構と
「function hooks」の関係についての質問があったとき、あるいは実際にModを組むために
`$` API / イベントの全体リファレンスが必要なときに、Claudeが自動で起動します。

スキルがカバーする内容：

1. **メンタルモデル** — プロセス内で動くミドルウェア方式のfunction hooksが、従来のシェル
   ベースのhooksとどう違うか。
2. **基本プリミティブ** — `$` / `e` / `next` のフック署名、および `next()` の全セマンティクス
   （`next.trace`, `next.origin`, `next.is`, `next.to`, `.catch`による復旧）。
3. **5層権限チェーン** — `prepend → user → append → builtin → core`、および「Rules of the
   Road」（spelling / identity / failure / recursion / trust / orgs / globs / agents / loading）。
4. **`$` API とイベントの全体リファレンス**（`references/api-reference.md`）— `$` の全名詞/動詞、
   coreへの副作用マーカー付きの確定イベント一覧。
5. **公式リファレンスMod** — 実際にバイナリに同梱されている3つのMod（`sec-default` /
   `diff` / `telemetry`）を [`anthropics/claude-code/tree/main/mods`](https://github.com/anthropics/claude-code/tree/main/mods)
   本体から直接参照。加えて、`engine.create` 経由で `$` にnounを追加するMod向けの
   **noun契約**パターン。
6. **UI描画**（`references/ui-rendering.md`）— `ui.render` のcomponent/element、pane / redraw /
   hover / `Client` の仕組み、cc-arcadeにおける「インタラクティブUIを独立した描画スレッドの
   モジュールとして動かす」パターン。
7. **Mod構築のアーキテクチャパターン** — 実在する高品質なMod（`sezaakgun/cc-arcade`）から学んだ、
   hooksモジュール／surface（`Client`）モジュール／純粋ロジックモジュールへの分割。
8. **テスト**（`references/testing.md`）— 公式のテストkit（`claude-code/testing`）、
   `claude plugin test`、`$.env`/`$.store`/`$.clock` のモック化、noun契約に依存するMod向けの
   provider plugin の立て方。
9. **実装アイデア集**（`references/implementation-ideas.md`）— セキュリティ、開発生産性、
   可観測性、UI/UX、メモリ、外部連携、オンボーディングにまたがるカテゴリ別ブレインストーム。

元ネタ（信頼度が高い順）：実際にバイナリへ同梱されているMod本体とそのテストが読める公式
[`anthropics/claude-code/tree/main/mods`](https://github.com/anthropics/claude-code/tree/main/mods)、
GitHub issue [anthropics/claude-code#91870](https://github.com/anthropics/claude-code/issues/91870)、
およびAnthropic公式の「$ cheat sheet」（2026-09-09）。function hooksはまだearly access段階で
仕様が変わり得るため、最新の正確な型定義が必要な場合はセッション内で `/plugin-types` を実行
すること。

## インストール

```
/plugin marketplace add nogu66/claude-code
/plugin install create-mods@nogu66/claude-code
```

またはローカルで：

```bash
git clone https://github.com/nogu66/claude-code.git
```

```
/plugin marketplace add ./claude-code
/plugin install create-mods@nogu-marketplace
```

## ライセンス

MIT
