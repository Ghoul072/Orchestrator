# Ledger - Desktop Git Interface for AI-Assisted Development

**Repository**: [peterjthomson/ledger](https://github.com/peterjthomson/ledger)
**Path**: `reference/ledger/`

## Overview

Ledger is a modern, desktop-first Git interface for macOS designed for the era of AI-assisted development. It provides command-and-control visibility into multiple parallel coding agents (Cursor, Claude, Conductor, Gemini, Junie) working in Git worktrees, alongside traditional branch and pull request management.

**Core Problem Solved**: Traditional Git UIs don't surface multi-worktree activity from AI agents. Ledger detects agent workspaces, shows live diff stats, and provides unified branch/PR/worktree management from a single "mission control" interface.

## Tech Stack

| Category | Technology |
|----------|-----------|
| Desktop Framework | Electron 37 |
| UI Framework | React 19 |
| Language | TypeScript (strict mode) |
| Build Tool | Vite + electron-vite |
| Git Operations | simple-git |
| State Management | Zustand |
| Database | better-sqlite3 |
| CLI Integration | GitHub CLI (gh) |
| Code Syntax | Shiki (for diffs) |
| Testing | Playwright (E2E) |

## Architecture Highlights

### 1. Conveyor System (Type-safe IPC)
Custom layer on top of Electron IPC with Zod validation:
```typescript
// Schema → API class → Handler → Registration
// Full TypeScript intellisense with automatic type inference
```

### 2. Dual Event System
- **LedgerEvents**: Main ↔ Renderer communication (general app events)
- **AgentEvents**: Main process only (AI agent tracking)
  - Tracks Cursor, Claude, Conductor, Gemini, Junie worktrees
  - Auto-detects agent type from path patterns
  - Emits: `agent:detected`, `agent:active`, `agent:idle`, `agent:commit`, `agent:pr-created`

### 3. Plugin System
Three plugin types: `app` (full-screen), `panel` (sidebar widget), `service` (background)
- Plugin manifest with permissions model
- Component registry for rendering in designated slots

### 4. Canvas Architecture
Multi-column, draggable, resizable layout for Branches, PRs, Worktrees, Commits, Stashes.

## Key Features

### AI Agent Detection
Auto-detects agent type from worktree paths using regex patterns:
- `cursor[-_]?(\d+)?` → Cursor IDE
- `claude[-_]?(\d+)?` → Claude Code
- `conductor[-_]?(\d+)?` → Conductor

### Worktree Interface
```typescript
interface Worktree {
  path: string
  head: string
  branch: string | null
  agent: 'cursor' | 'claude' | 'conductor' | 'gemini' | 'junie' | 'unknown'
  changedFileCount: number
  additions: number
  deletions: number
  activityStatus: 'active' | 'recent' | 'stale' | 'unknown'
}
```

### Pull Request Management (via gh CLI)
- Create, merge, approve PRs
- View file diffs in PR
- Review decision tracking

## Patterns Relevant to Orchestrator

### 1. IPC Architecture (Conveyor Pattern)
Reusable pattern for type-safe main/renderer communication:
```typescript
// Centralize schemas + APIs + handlers
// Zod validation at boundaries
// Auto-generated TypeScript types
```

### 2. Agent Detection via Path Analysis
Path-pattern matching for detecting which tool created a workspace.

### 3. Event-Driven Agent Tracking
Specialized events for agent activity:
- `agent:detected` - New agent workspace found
- `agent:active` - Agent is currently working
- `agent:commit` - Agent made a commit
- `agent:push` - Agent pushed changes

### 4. Multi-Panel Canvas
Draggable, resizable columns - valuable for task board + agent panels + diff viewer.

### 5. Plugin System with Permissions
Production-ready extensible architecture:
- Permissions: `git:read`, `git:write`, `notifications`, `storage`, `network`
- Context API for plugins
- Component slots for rendering

## Code Statistics

- **Total TypeScript**: ~46K LOC
- **Largest files**:
  - `git-service.ts`: 5.5K LOC (Git operations)
  - `app.tsx`: 1.8K LOC (main React component)
- **Component files**: 63 tsx/ts files

## Key Takeaways for Orchestrator

1. **Event-driven agent tracking** - Apply to task/agent progress monitoring
2. **Type-safe IPC** - Consider for WebSocket message validation
3. **Multi-panel canvas** - Could enhance task board with agent panels
4. **Plugin architecture** - Future extensibility for custom workflows
5. **Worktree-aware UI** - Useful when implementing parallel agent execution
