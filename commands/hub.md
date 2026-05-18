---
name: hub
description: List recent projects and switch to one. Use /hub to launch the project picker.
argument-hint: [project-name]
---

# Claude Hub - Project Switcher

List recently used Claude Code projects and switch between them.

## Usage

Run `/hub` to see a list of recent projects with their paths.
Run `/hub <name>` to filter projects by name.

## Behavior

1. Scan `~/.claude/projects/` and `~/.claude/sessions/` for known project paths
2. Display them sorted by last-used time
3. The `cc` shell command (installed automatically) provides an interactive TUI picker outside of Claude
