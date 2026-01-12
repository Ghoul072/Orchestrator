# Snowtree - Review-Driven Safe AI Coding

**Repository**: [bohutang/snowtree](https://github.com/bohutang/snowtree)
**Path**: `reference/snowtree/`

## Overview

Snowtree is a desktop application that enables safe, incremental AI code generation through a review-driven workflow. It solves a critical problem: "AI generates code. You must review. You can't review all or rollback safely."

**Core Innovation**: Isolated worktrees + incremental review + staged snapshots

## Workflow

1. AI codes in isolated Git worktree
2. User reviews changes after each round
3. Approved code is staged as a checkpoint
4. Next AI round sees only new changes (smaller diff to review)
5. Final commits/PRs when fully reviewed

## Tech Stack

| Category | Technology |
|----------|-----------|
| Runtime | Bun |
| Desktop Framework | Electron 37 |
| UI Framework | React 19 + Vite 6 |
| Database | SQLite (better-sqlite3) |
| Process Management | node-pty (PTY emulation) |
| State Management | Zustand |
| Testing | Vitest + Playwright (116 E2E tests) |

### AI Tool Support
- Claude Code (`@anthropic-ai/claude-code`)
- OpenAI Codex

## Architecture

### Monorepo Structure
- **@snowtree/core** - TypeScript types & models
- **@snowtree/desktop** - Electron main process
- **@snowtree/ui** - React frontend

### Key Patterns

#### 1. Executor Pattern (Strategy Pattern)
```typescript
AbstractExecutor (base class)
├── ClaudeExecutor (Claude Code CLI)
├── CodexExecutor (OpenAI Codex CLI)
└── GitExecutor (Git operations)
```

Each executor:
- Spawns CLI tools in isolated PTY
- Parses streaming JSON output
- Emits typed events (output, exit, error)
- Records timeline events for audit trail

#### 2. Manager Pattern (Composition)
```
├── SessionManager          // Session lifecycle + timeline
├── WorktreeManager         // Git worktree creation/cleanup
├── GitStatusManager        // Real-time git status polling
├── GitDiffManager          // Diff computation (647 lines)
├── GitStagingManager       // Stage/unstage operations
├── TerminalManager         // PTY process management
├── PanelManager            // Multi-panel lifecycle
└── UpdateManager           // Auto-update Electron app
```

#### 3. Panel System (Multi-Tool Support)
```typescript
type ToolPanelType =
  | 'terminal' | 'claude' | 'codex' | 'diff'
  | 'editor' | 'logs' | 'dashboard' | 'setup-tasks'
```

Each panel has persistent state, event emission/consumption, and resumable sessions.

#### 4. Incremental Review Workflow
```
Round 1:
  AI codes → git diff computed → user reviews → stages approved code

Round 2:
  AI continues → git diff (only NEW changes) → smaller diff to review

→ Each round has smaller context to review
→ Rollback is just "git reset --hard"
```

## Database Schema

```sql
sessions          -- AI coding sessions with status
projects          -- Git repositories
tool_panels       -- Multi-panel state (JSON blobs)
session_outputs   -- Session logs/streams
execution_diffs   -- Before/after diffs for auditing
timeline_events   -- Full audit trail
```

## Notable Features

### Git Worktree Isolation
- Each session gets its own worktree
- Changes don't affect main branch
- Parallel sessions on different worktrees

### Diff Management (647 lines)
- Computes git diffs between commits
- Supports unified and side-by-side views
- Handles binary files gracefully
- Live diff refresh

### Staging UI
- Visual file changes panel
- Click-to-stage individual lines or hunks
- Color-coded additions/deletions

### Timeline/Audit Trail
- Linear history of all user prompts and AI responses
- Tool calls expanded (collapsible)
- Inline diffs for file changes
- Full audit trail for debugging

## Patterns Relevant to Orchestrator

### 1. Executor Pattern for Agent Tools
```typescript
// Wrap AI tools as external CLI processes
AbstractExecutor
├── spawn CLI in PTY
├── parse streaming output
├── emit typed events
└── record timeline
```

Directly applicable to Orchestrator's agent execution.

### 2. Incremental Review Workflow
Translates to Orchestrator's "plan → approve → execute" flow:
- Approval checkpoints for destructive operations
- Diff-driven review (don't review entire codebase)
- Staged commits as progress markers

### 3. Manager-Based Architecture
Better than monolithic service:
```
TaskManager (task lifecycle)
AgentSessionManager (agent execution state)
ApprovalManager (approval workflow)
RepositoryManager (repo cloning, cleanup)
```

### 4. Timeline/Audit Trail Design
Record every operation for:
- Task execution history
- Git operations (commits, pushes)
- Agent decisions and approvals
- Full debugging context

### 5. Panel System for Multi-Tool Support
Reusable for:
- Task execution panels (logs, diffs, terminals)
- MCP tool panels
- Custom agent dashboards

### 6. IPC Bridge Pattern
Two-way IPC with Zustand syncing:
```typescript
// Async invoke for requests (agent execution)
// Event streaming for progress
// Store state in Zustand
```

## Code Statistics

- **41 React components**
- **102 TypeScript backend files**
- **116 E2E tests**
- **~1,000+ LOC** across core managers
- **~400 LOC** in specialized parsers

## Key Takeaways for Orchestrator

1. **Executor pattern** - Wrap Claude Agent SDK similarly
2. **Incremental review** - Apply to approval workflow
3. **Manager composition** - Split monolithic services
4. **Audit trail** - Timeline events for all operations
5. **Panel system** - Multi-tool support architecture
6. **Worktree isolation** - Safe parallel agent execution
7. **Testing strategy** - Graceful skip when prerequisites missing
