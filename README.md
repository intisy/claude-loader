# Claude Hub

Session launcher, project switcher, and plugin manager for Claude Code.

## Features

- **`cc` shell command** - Interactive TUI project picker (installed automatically on session start)
- **`/hub` slash command** - List and filter recent projects from within Claude Code
- **Auto-install** - The `cc` launcher is installed to `~/.local/bin/` on first session

## Installation

Install via the Claude Code plugin system or clone this repo:

```bash
# Clone into your plugins directory
gh repo clone intisy/claude-hub
```

## Usage

### From the terminal

```bash
# Launch the interactive project picker
cc

# Opens Claude Code in the selected project directory
```

### From within Claude Code

```
/hub              # List all recent projects
/hub myproject    # Filter by name
```

## How It Works

1. On `SessionStart`, the plugin installs the `cc` shell command to `~/.local/bin/`
2. `cc` scans `~/.claude/projects/` and `~/.claude/sessions/` for known project paths
3. Presents an interactive numbered list sorted by last-used time
4. Launches `claude` in the selected directory

## Platform Support

- **Windows**: Installs `cc.cmd` batch wrapper
- **macOS/Linux**: Installs `cc` shell script with execute permissions

## License

MIT
