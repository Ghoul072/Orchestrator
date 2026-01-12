# Reference Documentation Index

This folder contains reference documentation gathered from analyzed codebases and best practices.

## Reference Projects (in `/reference/`)

### 1. Source Diving Agent
**Path**: `reference/source-diving-agent/`
**GitHub**: [boring-labs/source-diving-agent](https://github.com/boring-labs/source-diving-agent)

A personal knowledge base companion for exploring, analyzing, and documenting open source codebases using Claude Code.

**Key Files**:
- `CLAUDE.md` - Development context and project vision
- `README.md` - Project overview and features
- `UI.md` - UI design notes and component specs
- `docs/mcp-server.md` - MCP server implementation

**Key Learnings**:
- TanStack Start + shadcn/ui architecture
- Claude Agent SDK integration (`query()` pattern)
- MCP server with search tools
- WebSocket bridge for agent communication
- Drizzle ORM patterns
- OAuth 2.0 + PKCE flow

---

### 2. Weft
**Path**: `reference/weft/`
**GitHub**: [jonesphillip/weft](https://github.com/jonesphillip/weft)

Task management where AI agents do your tasks. Built on Cloudflare Workers.

**Key Files**:
- `README.md` - Setup and architecture
- `worker/` - Cloudflare Workers backend
- `src/` - React frontend

**Key Learnings**:
- Task board with agent assignment
- Approval workflows for mutations
- Tool registry pattern
- Google/GitHub OAuth integrations
- MCP server registry
- Durable Objects for state

---

### 3. Claude Code PM (CCPM)
**Path**: `reference/ccpm/`
**GitHub**: [automazeio/ccpm](https://github.com/automazeio/ccpm)

Project management workflow using spec-driven development, GitHub Issues, and parallel agents.

**Key Files**:
- `README.md` - Complete workflow documentation
- `.claude/commands/pm/` - PM command definitions
- `.claude/agents/` - Task-oriented agents
- `.claude/CLAUDE.md` - System instructions

**Key Learnings**:
- PRD -> Epic -> Task breakdown workflow
- GitHub Issues as task database
- Parallel agent execution
- Git worktree isolation
- Sub-issue extension
- Context preservation across sessions

---

### 4. Claude Code MCP (Limited Relevance)
**Path**: `reference/claude-code-mcp/`
**GitHub**: [steipete/claude-code-mcp](https://github.com/steipete/claude-code-mcp)

MCP server that wraps Claude Code CLI for OTHER AI tools (Cursor, Windsurf) to call.

**Key Files**:
- `README.md` - Usage and configuration
- `src/server.ts` - MCP server implementation

**Why It's Here**:
- Shows how to wrap a CLI as an MCP tool
- Only useful if we wanted to expose Orchestrator's Claude Code to other AI tools
- **NOT the pattern we need** - we're building WITH Claude Code, not FOR other tools

**Relevant Pattern Instead**: Use `source-diving-agent/scripts/mcp-server.ts` for MCP server design

---

### 5. Plane (Task Management UI)
**Path**: `reference/plane/`
**GitHub**: [makeplane/plane](https://github.com/makeplane/plane)

Open source alternative to Linear/Jira/Monday. Modern project management with issues, cycles, and modules.

**Key Files**:
- `apps/web/` - Next.js frontend (monorepo)
- `apps/web/core/components/issues/` - Issue/task components
- `apps/web/core/components/cycles/` - Sprint/cycle management
- `apps/api/` - Python backend
- `packages/` - Shared packages (types, UI, editor)

**Key Learnings**:
- Task board UI patterns (list, kanban, calendar views)
- Issue hierarchy (parent/sub-issues)
- Cycle/sprint management
- Keyboard navigation patterns
- Clean, minimal design

---

### 6. Ledger (AI Agent-Aware Git Interface)
**Path**: `reference/ledger/`
**GitHub**: [peterjthomson/ledger](https://github.com/peterjthomson/ledger)
**Detailed Doc**: `docs/references/reference-ledger.md`

Desktop Git interface designed for AI-assisted development. Provides visibility into multiple parallel coding agents working in Git worktrees.

**Key Files**:
- `src/lib/main/git-service.ts` - Monolithic Git operations (5.5K LOC)
- `src/lib/main/conveyor/` - Type-safe IPC system with Zod
- `src/lib/main/plugins/` - Plugin API and agent event system
- `src/app/` - React frontend with canvas architecture

**Key Learnings**:
- **Conveyor IPC Pattern** - Type-safe Electron IPC with Zod validation
- **Dual Event System** - App events (LedgerEvents) + Agent events (AgentEvents)
- **Agent Detection** - Auto-detect Cursor/Claude/Gemini from worktree paths
- **Plugin Architecture** - Extensible with permissions model
- **Multi-Panel Canvas** - Draggable, resizable columns for different views

---

### 7. Snowtree (Review-Driven Safe AI Coding)
**Path**: `reference/snowtree/`
**GitHub**: [bohutang/snowtree](https://github.com/bohutang/snowtree)
**Detailed Doc**: `docs/references/reference-snowtree.md`

Desktop app for safe, incremental AI code generation through review-driven workflow.

**Key Files**:
- `packages/desktop/src/executors/` - Executor pattern for AI tools
- `packages/desktop/src/features/` - Manager pattern composition
- `packages/ui/src/` - React frontend with panel system
- `packages/core/` - Shared TypeScript types

**Key Learnings**:
- **Executor Pattern** - Wrap AI tools as external CLI processes with PTY
- **Incremental Review** - Smaller diffs per round, staged checkpoints
- **Manager Composition** - SessionManager, WorktreeManager, DiffManager, etc.
- **Panel System** - Multi-tool support (terminal, claude, codex, diff panels)
- **Audit Trail** - Timeline events for all operations
- **Worktree Isolation** - Safe parallel agent execution

---

## Pattern Documents (in `/docs/`)

### MCP Server Patterns
**File**: `mcp-server.md`

Documentation for implementing MCP servers with tools like `search_knowledge_base`, `get_document`, `list_projects`, etc.

### TanStack Patterns
**File**: `reference-tanstack-patterns.md`

Best practices from TanStack.com including:
- Server function patterns with `createServerFn`
- Valibot validation schemas
- Drizzle ORM query patterns
- TanStack Query integration
- File organization

### Hyprnote Patterns
**File**: `reference-hyprnote-patterns.md`

Patterns from Hyprnote app for:
- Real-time collaboration
- Editor implementations
- State management

### Typebot Patterns
**File**: `reference-typebot-patterns.md`

Patterns from Typebot including:
- Flow-based UIs
- State machines
- Complex form handling

---

## Quick Links

| Topic | Reference |
|-------|-----------|
| TanStack Start setup | `reference/source-diving-agent/` |
| shadcn/ui components | `reference/source-diving-agent/src/components/ui/` |
| Task management UI | `reference/weft/src/components/` |
| GitHub Issues sync | `reference/ccpm/.claude/commands/pm/` |
| MCP server | `reference/source-diving-agent/scripts/mcp-server.ts` |
| Agent integration | `reference/source-diving-agent/src/server/acp/` |
| OAuth flow | `reference/source-diving-agent/src/server/auth/` |
| Drizzle schema | `reference/source-diving-agent/src/server/db/schema.ts` |
| Type-safe IPC | `reference/ledger/src/lib/main/conveyor/` |
| Agent detection | `reference/ledger/src/lib/main/events/agent-events.ts` |
| Plugin architecture | `reference/ledger/src/lib/main/plugins/` |
| Executor pattern | `reference/snowtree/packages/desktop/src/executors/` |
| Manager composition | `reference/snowtree/packages/desktop/src/features/` |
| Diff management | `reference/snowtree/packages/desktop/src/features/git/` |
| Incremental review | `reference/snowtree/` (workflow pattern) |

---

## How to Use These References

1. **Starting a new feature**: Check if any reference project has similar functionality
2. **Architecture decisions**: Review CLAUDE.md files for design principles
3. **UI patterns**: Look at component implementations in source-diving-agent and weft
4. **MCP integration**: Follow the pattern in mcp-server.md
5. **Agent workflows**: Study CCPM's command system and agent definitions

## Keeping References Updated

```bash
# Update all reference repos
cd reference/source-diving-agent && git pull
cd ../weft && git pull
cd ../ccpm && git pull
cd ../claude-code-mcp && git pull
cd ../plane && git pull
cd ../ledger && git pull
cd ../snowtree && git pull
```
