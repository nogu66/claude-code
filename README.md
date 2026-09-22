# claude-code

A personal Claude Code plugin marketplace.

## Overview

This repository is a Claude Code plugin marketplace. It distributes skills and commands that enhance your Claude Code workflow, installable directly through Claude Code's plugin management system.

## Installation

### From Claude Code (Recommended)

1. Add this repository as a marketplace:

   ```
   /plugin marketplace add nogu66/claude-code
   ```

2. Install a plugin:

   ```
   /plugin install fable-implementation-flow@nogu66/claude-code
   ```

3. Restart Claude Code to activate the plugin.

### Manual Installation

Alternatively, clone this repository and use it as a local marketplace:

```bash
git clone https://github.com/nogu66/claude-code.git
```

Then in Claude Code:

```
/plugin marketplace add ./claude-code
```

## Available Plugins

| Plugin | Description |
|--------|-------------|
| [fable-implementation-flow](fable-implementation-flow/) | Build features, apps, games, prototypes, or bug fixes with a Fable-style implementation workflow — from brief to verified, working code. |
| [create-mods](create-mods/) | Reference and workflow for Claude Mods — plugins built on Claude Code's function hooks ($/e/next, the authority chain, the full $ API/event list, UI rendering, and a proven architecture pattern). |
| [git-ops](git-ops/) | A Claude Mod (function hooks): `/git` draws a clickable git panel above the prompt — branch buttons with a filter box and a confirmation before checkout, plus pull/push/fetch, stage-all and commit. Needs `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`. |
| [agent-aquarium](agent-aquarium/) | A Claude Mod (function hooks): `/aquarium` draws the session as a fish tank in a pane with kitty graphics — the main loop is the parent fish, subagents are babies that are born and swim off, tool calls are animations, and the water level follows the context window. Falls back to half blocks without image support. Needs `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`. |

## Projects

| Project | Description |
|---------|-------------|
| [ptcg-ai-battle](ptcg-ai-battle/) | Kaggle [Pokemon TCG AI Battle Challenge](https://www.kaggle.com/competitions/pokemon-tcg-ai-battle) 用デッキ & AI エージェント。Mega Lucario ex 格闘デッキ。詳細は [ptcg-ai-battle/README.md](ptcg-ai-battle/README.md) を参照。 |

### ptcg-ai-battle クイックリファレンス

```bash
cd ptcg-ai-battle

# デッキ編集
vim deck.csv                    # カードID を1行1枚、計60行

# カードID 検索
grep "カード名" data/JP_Card_Data.csv
grep "Card Name" data/EN_Card_Data.csv

# 提出ファイル作成
tar -czvf submission.tar.gz main.py deck.csv cg/

# Kaggle に提出
source .venv/bin/activate
export KAGGLE_TOKEN="KGAT_xxxxx"
kaggle competitions submit pokemon-tcg-ai-battle -f submission.tar.gz -m "説明"

# 提出結果確認
kaggle competitions submissions pokemon-tcg-ai-battle
```

## License

MIT
