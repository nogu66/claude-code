# git-ops

[English](README.md)

**Claude Mod**（Claude Code の function hooks 上で動くプラグイン）です。`/git` で、プロンプト入力欄の
上にクリック操作できる git パネルを表示します。ブランチをボタンで選び、確認して OK すると
チェックアウト。pull / push / fetch、stage all、commit も git コマンドを打たずに実行できます。

```
Git · main (origin/main, ahead 4)              ↓ pull  ↑ push  fetch  refresh
▸ branches (12)     changes (13)
checkout: type to filter…            ← previous branch
[ feat/sandbox-rewrite ]       [ feature/seo-optimization ]
[ fix/sandbox-trailing-slash ] ● main (current)
[ feat/github-link-card ]      [ pensive-lamport ]
```

内部では `$.process.run` で素の `git` を呼びます（argv 配列で渡し、シェル文字列にはしません）。
このプラグイン独自の認証や設定はなく、カレントディレクトリで `git` が解決するもの
（リモート、認証情報、upstream）がそのまま使われます。

**安全な日常操作だけに意図的に絞っています。** status、ブランチ一覧、checkout（既存／新規）、
pull、push、fetch、stage all、commit。force-push、reset、rebase、clean はありません。
破壊的な操作をボタン一つで実行できる状態にはしない、という方針です。

## 必要なもの

- function hooks に対応した Claude Code（`CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` で有効化）。
  function hooks は early-access で、API は変わる可能性があります。非対応のビルドでは、
  このプラグインの hooks モジュールは単に無視されます。
- `PATH` 上の `git` と、git リポジトリであるカレントディレクトリ。
- ターミナル（デスクトップ／モバイルではパネルは何も描画しません）。

## インストール

```
/plugin marketplace add nogu66/claude-code
/plugin install git-ops@nogu-marketplace
```

インストールせずに試す場合:

```sh
git clone https://github.com/nogu66/claude-code.git
cd claude-code/mods/git-ops
claude --plugin-dir .        # ここの .claude/settings.json が function hooks を有効にします
```

あとは git リポジトリの中で `/git` を実行してください。

## パネル

`/git`（または `/git show`）で表示、`/git stop` で非表示。

- **タイトル行** — 左に現在のブランチ・upstream・ahead/behind、右に `↓ pull`、`↑ push`、
  `fetch`、`refresh`。現在のブランチの既存の upstream に対して実行します。
- **タブ** — `branches (n)` と `changes (n)`。片方だけを描画するので、パネルが縦に伸びません。
- **`branches` タブ** — 別のブランチへ素早く移るための画面です。
  - ローカルブランチを、最近コミットした順に、枠付きボタンとして左右の列に並べます。
    現在のブランチはボタンではなく緑の `● name (current)` 表示です。
  - ボタンを**クリック**（または Tab で選んで Enter）、あるいは**数字キー**（`1`〜`9`、
    切り替え可能な先頭9ブランチ）。
  - **絞り込み入力**: 入力すると一覧が絞られます（完全一致 → 名前の前方一致 → `/` 区切りの
    前方一致 → 部分一致の順）。入力欄の下に Enter で何が起きるかが出ます —
    `Enter → checkout <最有力候補>`、一致がなければ `Enter → create new branch <name>`。
  - **`← previous branch`** — `git checkout -`。
  - **OK なしでは切り替わりません**: 上のどの操作も、まず確認（`Check out <branch>?` ·
    `[ OK ]` / `[ cancel ]`、ホットキー `y` / `n`）を表示します。未コミットの変更があれば警告します。
- **`changes` タブ** — 左に staged（緑）、右に unstaged（黄）と untracked。その下に
  `+ stage all`（`git add -A`）と **commit** 入力欄（Enter で `git commit -m`）。

確認が入るのは checkout だけです。**pull、push、fetch、stage all、commit は、クリックまたは
Enter の瞬間に実行されます**（git コマンドを直接打つのと同じ）。`push` は手元の外に届きます。

## テキストサブコマンド

パネルなしで、同じ argv ビルダーを使います。

| コマンド | 実行内容 |
|---|---|
| `/git status` | `git status` |
| `/git branch` | `git branch` |
| `/git checkout <branch>` | `git checkout <branch>` |
| `/git checkout -b <branch>` | `git checkout -b <branch>` |
| `/git back` | `git checkout -` |
| `/git pull` · `/git push` · `/git fetch` | 同名の git コマンド（フラグなし） |
| `/git stage` | `git add -A` |
| `/git commit <message>` | `git commit -m <message>` |
| `/git help` | この一覧を表示 |

テキストサブコマンドは確認なしで即実行されます。

## 制限

- パネルは自分の操作の後か `refresh` クリックでのみ更新されます。別の場所（Bash ツール呼び出し
  など）で `git` が走っても自動では反映されません。
- パネルの状態（絞り込み文字、commit の下書き、開いているタブ）はセッション中のメモリにのみ
  保持されます。
- 絞り込み欄に入力したブランチ名のチェックは、先頭の `-` と空白の拒否だけです（git のフラグ
  として解釈されないため）。それ以外の不正な名前は git 自身が拒否します。
- ローカルブランチのみ、最大60件。リモートブランチの選択、merge、rebase、stash、log、diff 表示は
  ありません。
- プロンプト上の帯は、そこに描画する他の mod と共有です。`next(e)` をつないでいるので重なって
  表示されるはずですが、その組み合わせは未検証です。

## 開発

```sh
bun test                  # hooks/lib/gitops.ts の純粋ロジック — $ や UI のモック不要
claude plugin validate .  # フックしたイベントと $ 呼び出しを一覧表示
```

- `hooks/register.tsx` — `$` に触る唯一のファイル。`/git` の登録、`git` の実行、`AbovePrompt`
  パネルの描画、UI 状態の保持。
- `hooks/lib/gitops.ts` — 純粋関数: コマンド解析、git argv ビルダー、ブランチ／status 出力の
  解析、ブランチ絞り込みと Enter の対象決定、列レイアウト。
- `tests/gitops.test.ts` — 上記のテスト。

正確な型は、function hooks を有効にしたセッションで `/plugin-types` を実行すると
`.claude/types/claude-code.d.ts` に書き出されます。

## ライセンス

MIT
