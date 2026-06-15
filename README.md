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

## License

MIT
