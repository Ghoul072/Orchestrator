# Orchestrator - Development Context

## Project Vision

Orchestrator is a **full-fledged Project Manager** for developers using Claude Code. Create projects, add repositories, define tasks with subtasks, and let AI agents handle implementation with full context and traceability.

### The Workflow
1. **Create a Project** - Define scope, description, and agent context
2. **Add Repositories** - Link GitHub repos for codebase context
3. **Create Tasks** - Define tasks with subtasks, priorities, dependencies
4. **Assign to Agents** - Let Claude Code work autonomously on tasks
5. **Track Progress** - Real-time updates and progress logs
6. **Knowledge Integration** - Query source-diving-agent for patterns (optional MCP)

### Key Use Cases
- Managing multiple development projects with AI assistance
- Breaking down features into actionable tasks and subtasks
- Running parallel agent workflows for faster development
- Spec-driven development with full traceability
- Integrating knowledge from analyzed codebases via MCP

## UI Design
See **UI.md** for detailed UI design notes, component specs, and layout structure.

## Tech Stack
- **Runtime**: Bun
- **Framework**: TanStack Start (React meta-framework)
- **UI**: shadcn/ui (Lyra style) + Tiptap editor (task descriptions, notes)
- **Fonts**: Inter (UI), JetBrains Mono (code/monospace)
- **Database**: PostgreSQL with Drizzle ORM
- **Search**: pg_textsearch (BM25) for full-text search
- **Agent**: Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
- **Auth**: Anthropic OAuth 2.0 + PKCE (Claude Max subscription)
- **Real-time**: WebSocket bridge for agent communication
- **MCP**: Model Context Protocol for tool integration

## Database Schema (Drizzle ORM)
- **projects** - Top-level containers for work
- **repositories** - GitHub repos linked to projects (URL stored, cloned on-demand)
- **tasks** - Hierarchical tasks with subtasks (parent_id self-reference)
- **task_relations** - Dependency relationships (blocks/blocked_by/relates_to)
- **task_updates** - Progress logs and status changes
- **meetings** - Meeting notes with date, attendees, content
- **meeting_task_links** - Track which tasks were created/updated from meetings
- **documents** - Notes, diagrams, graphs (Mermaid), file uploads
- **annotations** - Highlights with colors and notes on documents
- **collections** - Themed groupings of documents/tasks (like playlists)
- **collection_items** - Many-to-many for collections
- **approvals** - Pending approval requests for destructive actions
- **saved_views** - User-saved filter/layout configurations
- **tags** - Reusable tags for categorization
- **projectTags** - Many-to-many for project tags
- **agent_sessions** - Track agent work history
- **prompts** - Reusable prompt templates with variables

Connection: `postgres://postgres:secret@127.0.0.1:5433/orchestrator`

## Key Configuration Values

### Anthropic OAuth
- **Client ID**: `9d1c250a-e61b-44d9-88ed-5944d1962f5e`
- **Auth URL (Max)**: `https://claude.ai/oauth/authorize`
- **Token Endpoint**: `https://console.anthropic.com/v1/oauth/token`
- **Redirect URI**: `https://console.anthropic.com/oauth/code/callback`
- **Scopes**: `org:create_api_key user:profile user:inference`

### Ports
- **Web App**: http://localhost:3000
- **WebSocket**: ws://localhost:3001

## Project Structure
```
src/
├── components/
│   ├── auth/           # OAuth login UI
│   ├── chat/           # Agent chat panel
│   ├── layout/         # App layout with sidebar
│   ├── projects/       # Project management
│   ├── tasks/          # Task management
│   │   ├── task-board.tsx      # Kanban/list view
│   │   ├── task-card.tsx       # Individual task card
│   │   ├── task-editor.tsx     # Create/edit dialog
│   │   └── subtask-list.tsx    # Nested subtasks
│   ├── meetings/       # Meeting notes
│   │   ├── meeting-list.tsx    # List of meetings
│   │   ├── meeting-editor.tsx  # Tiptap editor for notes
│   │   └── meeting-to-tasks.tsx # Generate/update tasks from meeting
│   ├── documents/      # Notes, graphs, uploads
│   │   ├── document-list.tsx   # List of documents
│   │   ├── document-editor.tsx # Tiptap with Mermaid support
│   │   ├── mermaid-block.tsx   # Mermaid diagram renderer
│   │   └── file-upload.tsx     # File upload component
│   ├── diff/           # Git diff views
│   │   ├── diff-viewer.tsx     # Side-by-side or unified diff
│   │   └── file-changes.tsx    # List of changed files
│   ├── approvals/      # Approval workflow
│   │   ├── approval-card.tsx   # Pending approval card
│   │   ├── approval-dialog.tsx # Approve/reject dialog
│   │   └── approval-list.tsx   # List of pending approvals
│   ├── repositories/   # Repository management
│   ├── prompts/        # Prompt builder UI
│   │   ├── prompt-editor.tsx   # Create/edit prompt dialog
│   │   └── prompt-picker.tsx   # Grid picker for chat panel
│   └── ui/             # shadcn components
├── lib/
│   ├── auth.ts         # Client-side auth utilities
│   ├── use-agent.ts    # React hook for agent WebSocket
│   ├── task-utils.ts   # Task hierarchy utilities
│   └── utils.ts        # Utility functions
├── queries/
│   ├── projects.ts     # Project query options
│   ├── tasks.ts        # Task query options
│   └── index.ts        # Query exports
├── routes/
│   ├── __root.tsx      # Root layout
│   ├── index.tsx       # Dashboard (projects list)
│   ├── prompts.tsx     # Prompt library page
│   └── projects/
│       ├── new.tsx     # New project
│       └── $projectId/
│           ├── index.tsx       # Project detail
│           ├── tasks.tsx       # Task board
│           ├── meetings.tsx    # Meeting notes list
│           ├── meetings.$meetingId.tsx  # Meeting detail/editor
│           ├── documents.tsx   # Documents/notes list
│           ├── documents.$docId.tsx  # Document editor
│           ├── repositories.tsx
│           └── settings.tsx
└── server/
    ├── acp/
    │   └── agent-manager.ts    # Claude Agent SDK wrapper
    ├── auth/
    │   ├── anthropic-oauth.ts  # OAuth implementation
    │   ├── auth-functions.ts   # Server functions
    │   └── session-store.ts    # File-based session storage
    ├── db/
    │   ├── schema.ts           # Drizzle schema
    │   ├── projects.ts         # Project operations
    │   ├── tasks.ts            # Task operations
    │   ├── meetings.ts         # Meeting operations
    │   ├── documents.ts        # Document operations
    │   ├── approvals.ts        # Approval operations
    │   └── index.ts            # Database connection
    ├── functions/
    │   ├── projects.ts         # Project server functions
    │   ├── tasks.ts            # Task server functions
    │   ├── meetings.ts         # Meeting server functions
    │   ├── documents.ts        # Document server functions
    │   ├── approvals.ts        # Approval server functions
    │   └── repos.ts            # Repository operations
    ├── mcp/
    │   ├── server.ts           # MCP server (expose Orchestrator)
    │   └── client.ts           # MCP client (query source-dive)
    └── ws-server.ts            # WebSocket bridge

scripts/
├── mcp-server.ts       # MCP server entry point
└── seed-data.ts        # Seed initial data
```

## Reference Repos (in ./reference/)
- `source-diving-agent` - **Primary reference** (TanStack Start, shadcn/ui, Claude Agent SDK, MCP)
- `weft` - Task board UI patterns, approval workflows, MCP client bridge
- `ccpm` - GitHub Issues integration, parallel agents, PRD workflow

## Implementation Status

### Phase 1: Foundation
- [x] TanStack Start project with shadcn/ui
- [x] Anthropic OAuth 2.0 + PKCE authentication
- [x] File-based session storage (shared between processes)
- [x] Database schema with Drizzle ORM
- [x] Basic CRUD for projects

### Phase 2: Task Management
- [x] Task schema with hierarchical structure (parent_id)
- [x] Task CRUD server functions
- [x] Task board UI (list view)
- [x] Subtask management
- [x] Task status workflow (pending → in_progress → completed)
- [x] Priority and effort estimation
- [x] Task dependencies
- [ ] Task filtering and search

### Phase 3: Repository Integration
- [x] Repository linking per project
- [x] Clone status tracking
- [x] Stack/dependency detection after clone
- [ ] Auto-cleanup after analysis
- [ ] Re-clone on follow-up questions

### Phase 4: Agent Integration
- [x] Claude Agent SDK integration (query() pattern)
- [x] WebSocket bridge for real-time communication
- [x] Agent session management
- [x] Tool use display in chat (collapsible steps)
- [ ] Task assignment to agents
- [ ] Progress streaming from agents
- [ ] Save agent responses as task updates

### Phase 5: MCP Integration
- [x] MCP server exposing Orchestrator tools
- [ ] MCP client for source-diving-agent
- [ ] Query knowledge base from task context
- [ ] 2-way communication protocol

### Phase 6: GitHub Sync
- [ ] Push tasks as GitHub Issues
- [ ] Sync issue status bidirectionally
- [ ] Parent-child issue relationships (gh-sub-issue)
- [ ] Labels and milestones

### Phase 7: Meeting Notes & Documents
- [x] Meeting schema (date, title, attendees, content)
- [x] Meeting CRUD server functions
- [x] Meeting editor with Tiptap
- [ ] "Generate Tasks" button - agent analyzes notes and creates tasks
- [ ] "Update Tasks" button - agent compares notes to existing tasks, updates if requirements changed
- [x] Meeting-task linking (track which tasks came from which meeting)
- [ ] Documents/notes with Mermaid graph support
- [ ] File uploads for images, diagrams, attachments
- [ ] Document linking to tasks

### Phase 8: Git Diff & Approvals
- [x] Git diff viewer component (side-by-side and unified)
- [x] File changes list with expandable diffs
- [ ] Syntax highlighting in diffs
- [ ] Approval workflow for destructive agent actions
- [ ] Approve/reject dialog with comments
- [ ] Approval history log

### Phase 9: Advanced Features
- [x] Kanban board view
- [ ] Parallel agent execution
- [ ] Git worktree management
- [ ] Prompt library with variables
- [ ] Export to markdown

## Task Schema

```sql
tasks (
  id: uuid PRIMARY KEY,
  project_id: uuid REFERENCES projects ON DELETE CASCADE,
  parent_id: uuid REFERENCES tasks,  -- For subtasks
  title: text NOT NULL,
  description: text,
  status: enum('pending', 'in_progress', 'blocked', 'completed', 'cancelled'),
  priority: enum('low', 'medium', 'high', 'urgent'),
  effort: enum('xs', 'sm', 'md', 'lg', 'xl'),
  is_archived: boolean DEFAULT false,  -- Hide from default views
  is_parallel: boolean DEFAULT false,
  assignee: text,
  github_issue_id: integer,
  acceptance_criteria: text[],
  dependencies: uuid[],
  sort_order: integer,
  due_date: timestamp,
  started_at: timestamp,
  completed_at: timestamp,
  created_at: timestamp,
  updated_at: timestamp
)

task_updates (
  id: uuid PRIMARY KEY,
  task_id: uuid REFERENCES tasks ON DELETE CASCADE,
  content: text NOT NULL,
  update_type: enum('progress', 'blocker', 'question', 'completion'),
  author: text,
  metadata: jsonb,
  created_at: timestamp
)
```

## Meeting Schema

```sql
meetings (
  id: uuid PRIMARY KEY,
  project_id: uuid REFERENCES projects ON DELETE CASCADE,
  title: text NOT NULL,
  date: timestamp NOT NULL,
  attendees: text[],              -- List of attendee names
  content: text NOT NULL,         -- Tiptap HTML content
  summary: text,                  -- Agent-generated summary
  status: enum('draft', 'finalized'),
  created_at: timestamp,
  updated_at: timestamp
)

meeting_task_links (
  id: uuid PRIMARY KEY,
  meeting_id: uuid REFERENCES meetings ON DELETE CASCADE,
  task_id: uuid REFERENCES tasks ON DELETE CASCADE,
  link_type: enum('created', 'updated'),  -- Was task created or updated from this meeting?
  changes_summary: text,          -- What changed (for updates)
  created_at: timestamp
)
```

### Meeting-to-Tasks Flow

1. **Create Meeting** - User writes notes during/after meeting in Tiptap editor
2. **Finalize Meeting** - User marks meeting as finalized
3. **Generate Tasks** - Click button, agent:
   - Reads meeting content
   - Analyzes action items, decisions, requirements
   - Creates new tasks with appropriate titles, descriptions, acceptance criteria
   - Links tasks to meeting via `meeting_task_links`
4. **Update Tasks** - Click button, agent:
   - Reads meeting content + existing project tasks
   - Identifies requirement changes, scope updates, new priorities
   - Updates affected tasks (description, acceptance criteria, priority)
   - Records changes in `meeting_task_links` with `link_type: 'updated'`

## Document Schema

```sql
documents (
  id: uuid PRIMARY KEY,
  project_id: uuid REFERENCES projects ON DELETE CASCADE,
  title: text NOT NULL,
  content: text,                  -- Tiptap HTML (supports Mermaid blocks)
  type: enum('note', 'diagram', 'upload'),
  file_path: text,                -- For uploads: path to stored file
  file_type: text,                -- MIME type for uploads
  file_size: integer,             -- File size in bytes
  linked_task_id: uuid REFERENCES tasks,  -- Optional task link
  linked_meeting_id: uuid REFERENCES meetings,  -- Optional meeting link
  created_at: timestamp,
  updated_at: timestamp
)
```

### Mermaid Support
Documents support Mermaid diagrams via Tiptap extension:
- Flowcharts, sequence diagrams, ERDs, Gantt charts
- Live preview while editing
- Export to SVG/PNG

### File Uploads
- Images (PNG, JPG, SVG)
- PDFs
- Diagrams from external tools
- Stored locally or S3-compatible storage

## Agent Execution Flow

### Plan Review (Before Execution)
When user assigns a task to an agent:
1. Agent analyzes task + context (repo, existing code, acceptance criteria)
2. Agent generates **execution plan** (what it will do, which files, approach)
3. **Plan Review Modal** shows user the plan
4. User approves plan → Agent executes
5. User rejects/modifies → Agent revises plan

This prevents wasted effort and gives user control without blocking every action.

### Approvals (Destructive Actions Only)
Approvals are **only** for destructive mutations - not for reading or writing new files.

```sql
approvals (
  id: uuid PRIMARY KEY,
  task_id: uuid REFERENCES tasks,
  agent_session_id: uuid REFERENCES agent_sessions,
  action_type: enum('file_delete', 'git_push', 'git_force_push'),
  action_description: text NOT NULL,
  diff_content: text,             -- Show what will be deleted/pushed
  files_affected: text[],
  status: enum('pending', 'approved', 'rejected'),
  created_at: timestamp,
  resolved_at: timestamp
)
```

### What Requires Approval
- **File deletion** - Show file content before delete
- **Git push** - Show diff of what's being pushed
- **Git force push** - Always requires explicit approval

### What Does NOT Require Approval
- Creating new files
- Editing files (agent can freely edit)
- Reading files
- Running non-destructive commands
- Git commit (local only)

## Git Diff Viewer

Display file changes with syntax highlighting:
- **Side-by-side view** - Old and new content in parallel
- **Unified view** - Single column with +/- indicators
- **File tree** - Collapsible list of changed files
- **Syntax highlighting** - Language-aware coloring

## MCP Server

An MCP server that allows AI agents to query and manage Orchestrator tasks.

### Tools

| Tool | Description |
|------|-------------|
| `list_projects` | List all projects |
| `get_project` | Get project with tasks and repos |
| `list_tasks` | List tasks with filters (status, priority, project) |
| `get_task` | Get task details with subtasks |
| `create_task` | Create new task |
| `update_task_status` | Update task status |
| `add_task_update` | Add progress update to task |

### Configuration

Add to Claude Code settings (`~/.claude.json` or project `.claude/settings.json`):

```json
{
  "mcpServers": {
    "orchestrator": {
      "command": "bun",
      "args": ["run", "/path/to/orchestrator/scripts/mcp-server.ts"]
    }
  }
}
```

### Implementation

```
scripts/
└── mcp-server.ts     # MCP server using @modelcontextprotocol/sdk
```

Uses same database connection as main app.

### Dependencies

```bash
bun add @modelcontextprotocol/sdk
```

## Commands
```bash
# Development (starts both servers)
bun run dev

# Individual servers
bun run dev:app    # Web app on port 3000
bun run dev:ws     # WebSocket on port 3001

# Database
bunx drizzle-kit push    # Push schema changes
bunx drizzle-kit studio  # Open Drizzle Studio

# Seed data
bun scripts/seed-data.ts

# Type check
bun run typecheck

# Linting
bun run lint         # Run oxlint
bun run lint:fix     # Run oxlint with auto-fix

# Tests
bun run test         # Run all tests
bun run test:watch   # Run tests in watch mode

# Build
bun run build
```

## Development Workflow (CRITICAL)

**NEVER push code without completing these steps:**

1. **Write Tests** - Every new feature must have accompanying tests
2. **Run Tests** - Execute `bun run test` and ensure ALL tests pass
3. **Type Check** - Run `bun run typecheck` and fix all type errors
4. **Lint** - Run `bun run lint` and fix critical issues (deprecations are errors)
5. **Commit** - Create small, meaningful commits with co-authoring
6. **Push** - Push to remote repository

### Commit Guidelines

**Small, meaningful commits:**
- Each commit should represent ONE logical change
- Separate tooling/config changes from feature changes
- Separate refactoring from new features
- Bug fixes should be their own commits

**Examples of good commit separation:**
- `chore: add oxlint with deprecation rules` (tooling)
- `feat: add meeting notes database schema` (schema)
- `feat: add meeting CRUD server functions` (backend)
- `feat: add meeting editor UI components` (frontend)
- `fix: correct icon imports for Phosphor v2` (bugfix)

**Commit message format:**
```
type: short description

Optional longer description if needed.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`

### Linting Rules (oxlint)

The project uses oxlint with strict deprecation checking:
- **Deprecated code is an ERROR** - No deprecated APIs, imports, or patterns allowed
- **Phosphor icons** - Must use Icon suffix (e.g., `PlusIcon` not `Plus`)
- **Console statements** - Warnings only (allowed in server code)

### Pre-Push Checklist
```bash
bun run test        # All tests must pass
bun run typecheck   # No type errors
bun run lint        # No errors (warnings OK)
```

### Telegram Notifications
Send progress updates via Telegram after significant milestones:
- Bot Token: `8377551670:AAEC7GbOfLggV_zu6mjf5ZUW6Q5Gk6FCjqE`
- User ID: `1098392910`

## Key Dependencies
- `@anthropic-ai/claude-agent-sdk` - Official Claude Agent SDK
- `@modelcontextprotocol/sdk` - MCP server/client
- `drizzle-orm` + `postgres` - Database ORM
- `@tiptap/react` - Rich text editor
- `@tanstack/react-query` - Server state management
- `zod` - Schema validation

## Agent Integration Notes

Using official pattern from `claude-agent-sdk-demos/simple-chatapp`:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

// MessageQueue for multi-turn conversations
const outputIterator = query({
  prompt: messageQueue, // AsyncIterable
  options: {
    maxTurns: 100,
    cwd: workingDirectory,
    allowedTools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch"],
    systemPrompt: projectContext + taskContext,
  },
})[Symbol.asyncIterator]();

// Stream responses
for await (const message of outputIterator) {
  // message.type: "system" | "assistant" | "result"
}
```

## Session Storage
Sessions stored in `.orchestrator/sessions.json` (file-based, shared between TanStack Start and WS server processes).

## Troubleshooting

### WebSocket Connection Issues
1. Logout from the app
2. Login again (creates fresh session)
3. Connect should work

### Agent Not Responding
- Check that Claude CLI is authenticated (`claude /login`)
- Agent uses `~/.claude.json` for auth

### Database Errors
1. Ensure PostgreSQL is running on port 5433
2. Run migrations: `bunx drizzle-kit push`
3. Check connection string

## Reference Projects

| Project | Purpose | Key Learnings |
|---------|---------|---------------|
| `source-diving-agent` | Knowledge base app | **MCP server** (`@modelcontextprotocol/sdk`), TanStack patterns, auth flow |
| `weft` | AI task management | **MCP client bridge**, approval workflows, tool registry |
| `ccpm` | Claude Code PM | GitHub Issues integration, parallel agents, PRD workflow (no MCP) |

## Design Principles

1. **Task-centric** - Everything revolves around tasks
2. **Spec-driven** - Tasks must have clear acceptance criteria (from CCPM)
3. **Plan before execute** - Agent shows plan, user approves before execution (from Weft)
4. **Approve only destructive** - Don't block reads/writes, only deletes/pushes
5. **Auto-save everything** - No save buttons, content persists automatically (from Source Dive)
6. **Keyboard-first** - All actions accessible via shortcuts (from Plane)
7. **Inline editing** - Click to edit, minimal modals (from Plane)
8. **Real-time feedback** - WebSocket for live progress updates (from Weft)
9. **Minimal by default** - Don't add features that clutter the core workflow
10. **Test-driven development** - Tests written and run after every feature implementation

## Testing Requirements

**IMPORTANT**: All features must be tested. Tests should be written and run after every feature implementation.

### Testing Strategy
- **Unit Tests**: Test individual functions, utilities, and database operations
- **Integration Tests**: Test API endpoints and server functions
- **Component Tests**: Test React components with React Testing Library
- **E2E Tests** (optional): Test full user flows with Playwright

### Test Commands
```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --coverage

# Run specific test file
bun test src/server/db/__tests__/projects.test.ts
```

### Test File Organization
- Tests live alongside source files in `__tests__` directories
- Test files named `*.test.ts` or `*.test.tsx`
- Fixtures and mocks in `__tests__/__fixtures__/`

## Telegram Notifications (Development Updates)

**Purpose**: Telegram notifications are for **Claude (the developer agent)** to send progress updates to the user during development sessions. This is NOT an in-app feature for end users.

When Claude is working on building or modifying this project, it should send Telegram messages to keep the user informed of:
- Development session start/end
- Major milestones completed (e.g., "Database schema created", "Authentication working")
- Errors or blockers encountered
- Commits pushed

### Configuration
Telegram credentials are stored in `.env` (gitignored):
```env
TELEGRAM_BOT_TOKEN=8377551670:AAEC7GbOfLggV_zu6mjf5ZUW6Q5Gk6FCjqE
TELEGRAM_USER_ID=1098392910
```

### Usage (by Claude during development)
```bash
# Send via curl in Bash tool
curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_USER_ID}" \
  -d "text=✅ Milestone: Database schema implemented"
```

### When to Send Updates
- Session start: "🚀 Starting work on [feature]"
- Milestone complete: "✅ [Component] implemented and tested"
- Commit pushed: "📝 Pushed: [commit message]"
- Error/blocker: "⚠️ Issue: [description]"
- Session end: "🏁 Session complete: [summary]"

## Human-Friendly Flow

```
User creates task → Adds acceptance criteria → Assigns to agent
                                                      ↓
                              Agent generates execution plan
                                                      ↓
                              User reviews plan in modal
                                    ↓              ↓
                               [Modify]      [Approve]
                                    ↓              ↓
                              Agent revises   Agent executes
                                                      ↓
                              Real-time progress (tool use visible)
                                                      ↓
                              Destructive action? → Approval modal
                                                      ↓
                              Task completed → Auto-saved
```

## Edge Cases & Hardened Requirements

### Task Dependencies

```sql
task_relations (
  id: uuid PRIMARY KEY,
  source_task_id: uuid REFERENCES tasks ON DELETE CASCADE,
  target_task_id: uuid REFERENCES tasks ON DELETE CASCADE,
  relation_type: enum('blocks', 'blocked_by', 'relates_to', 'duplicates'),
  created_at: timestamp,
  UNIQUE(source_task_id, target_task_id, relation_type)
)
```

**Dependency Rules:**
- Task cannot start if any `blocked_by` task is not completed
- When task completes, check if it unblocks dependent tasks
- Agent can auto-start next task in chain after approval (configurable)
- Circular dependency detection on task creation

### Background Agent Execution

**Agent Session Management:**
```typescript
agent_sessions (
  id: uuid PRIMARY KEY,
  task_id: uuid REFERENCES tasks,
  status: enum('queued', 'planning', 'awaiting_approval', 'executing', 'paused', 'completed', 'failed', 'timeout'),
  started_at: timestamp,
  last_heartbeat: timestamp,      -- Agent pings every 30s
  timeout_at: timestamp,          -- Auto-fail if no heartbeat
  max_turns: integer DEFAULT 50,  -- Prevent runaway agents
  current_turn: integer DEFAULT 0,
  error_message: text,
  created_at: timestamp
)
```

**Timeout Handling:**
- Connection timeout: 10 seconds
- Response timeout: 60 seconds
- Session timeout: 30 minutes of inactivity
- Heartbeat interval: 30 seconds
- Max turns per session: 50 (configurable)

**On Timeout:**
1. Mark session as `timeout`
2. Mark task as `blocked` with reason
3. Notify user via toast
4. Cleanup any held resources

### Concurrent Agent Limits

**Configuration:**
```typescript
agent_config (
  max_concurrent_agents: integer DEFAULT 3,    -- Per user
  max_concurrent_per_project: integer DEFAULT 2,
  agent_queue_size: integer DEFAULT 10,        -- Pending queue
  token_refresh_buffer_ms: integer DEFAULT 300000  -- 5 min before expiry
)
```

**Queue Behavior:**
- If at max capacity, new task assignments go to queue
- Queue processed FIFO with priority override for urgent tasks
- User notified: "Agent queued (position 3)"
- Auto-start when slot available

### Error Recovery

**Error Classification:**
| Error Type | Action | User Impact |
|------------|--------|-------------|
| `network_timeout` | Retry 3x with backoff | Toast: "Retrying..." |
| `agent_crash` | Mark task blocked, cleanup | Toast: "Agent failed, task paused" |
| `approval_timeout` | Keep waiting, notify | Toast: "Approval still pending" |
| `tool_failure` | Log, continue if possible | Show in tool use display |
| `context_overflow` | Summarize, continue | Automatic, transparent |
| `rate_limit` | Backoff, retry | Toast: "Rate limited, waiting..." |

**Graceful Degradation:**
- Tool failures don't block task completion
- Collect errors in `failed_steps` array
- Task succeeds if primary objective achieved (even with intermediate failures)

### WebSocket Reconnection

**Reconnection Strategy:**
```typescript
reconnect_config = {
  initial_delay_ms: 1000,
  max_delay_ms: 30000,
  backoff_multiplier: 2,
  max_attempts: 10,
  jitter: true  // Prevent thundering herd
}
```

**On Disconnect:**
1. Show "Reconnecting..." indicator
2. Attempt reconnect with exponential backoff
3. Restore session state on reconnect
4. Replay missed messages from server queue
5. After max attempts: "Connection lost. Refresh to reconnect."

### Task State Machine

```
                    ┌─────────────┐
                    │   pending   │
                    └──────┬──────┘
                           │ assign to agent
                           ▼
                    ┌─────────────┐
            ┌───────│ in_progress │◄──────┐
            │       └──────┬──────┘       │
            │              │              │
     blocked│       ┌──────┴──────┐       │ unblock
            │       │             │       │
            ▼       ▼             ▼       │
     ┌─────────────┐       ┌─────────────┐
     │   blocked   │───────│  completed  │
     └─────────────┘       └─────────────┘
            │                     ▲
            │                     │
            ▼                     │
     ┌─────────────┐              │
     │  cancelled  │──────────────┘
     └─────────────┘     (reopen)
```

**State Transition Rules:**
- `pending` → `in_progress`: Only when no blockers AND agent available
- `in_progress` → `blocked`: Agent fails OR dependency not met OR manual
- `blocked` → `in_progress`: Blocker resolved AND agent available
- `in_progress` → `completed`: All acceptance criteria met
- Any → `cancelled`: Manual cancellation only
- `cancelled` → `pending`: Reopen (clears completion data)

### Context Preservation (from CCPM)

**Problem:** Agent reading 50 files explodes context
**Solution:** Agent firewall pattern

```typescript
// Heavy operation isolated in sub-agent
const summary = await spawnSubAgent({
  task: "Analyze all auth files",
  returnOnly: "summary",  // Don't return full content
  maxContextTokens: 4000
});

// Main agent receives only summary
mainAgent.receive(summary);  // ~200 tokens instead of 50,000
```

**Context Limits:**
- Conversation history: Last 20 messages (sliding window)
- File content: Summarize if > 500 lines
- Tool output: Truncate with "... (truncated, X more lines)"

### Auto-Start Chain (After Approval)

When a task completes, check for auto-startable dependents:

```typescript
async function onTaskComplete(taskId: string) {
  const dependents = await getTasksDependingOn(taskId);

  for (const task of dependents) {
    if (task.auto_start_after_dependency &&
        allBlockersResolved(task) &&
        agentSlotAvailable()) {
      await assignToAgent(task);
      notify(`Started dependent task: ${task.title}`);
    }
  }
}
```

**User Control:**
- Per-task toggle: "Auto-start when unblocked"
- Project-level default setting
- Always respects concurrent agent limits

## Additional Features (from Reference Projects)

### Annotations & Highlights (from Source Dive)
5-color highlight system for documents with notes:

```sql
annotations (
  id: uuid PRIMARY KEY,
  document_id: uuid REFERENCES documents ON DELETE CASCADE,
  color: enum('yellow', 'green', 'blue', 'pink', 'purple'),
  start_offset: integer NOT NULL,
  end_offset: integer NOT NULL,
  note: text,
  created_at: timestamp
)
```

### Collections (Document Playlists)
Group documents/tasks into themed collections:

```sql
collections (
  id: uuid PRIMARY KEY,
  name: text NOT NULL,
  slug: text UNIQUE NOT NULL,
  description: text,
  icon: text,           -- Emoji
  color: text,          -- Hex color
  is_pinned: boolean DEFAULT false,
  created_at: timestamp
)

collection_items (
  collection_id: uuid REFERENCES collections ON DELETE CASCADE,
  item_type: enum('document', 'task', 'meeting'),
  item_id: uuid NOT NULL,
  sort_order: integer,
  added_at: timestamp,
  PRIMARY KEY (collection_id, item_type, item_id)
)
```

**Use Cases:**
- "Auth Patterns" - Documents about authentication across projects
- "Sprint 12 Tasks" - Tasks for current sprint
- "Meeting Follow-ups" - Action items from meetings

### Multiple View Layouts (from Plane)
Support different views for task boards:

| Layout | Description |
|--------|-------------|
| `list` | Default hierarchical list |
| `kanban` | Columns by status/priority/assignee |
| `calendar` | Tasks on calendar by due date |
| `gantt` | Timeline with dependencies |

### Saved Views with Filters (from Plane)

```sql
saved_views (
  id: uuid PRIMARY KEY,
  project_id: uuid REFERENCES projects,
  name: text NOT NULL,
  layout: enum('list', 'kanban', 'calendar', 'gantt'),
  filters: jsonb,        -- { status: ['pending'], priority: ['high'] }
  group_by: text,        -- 'status' | 'priority' | 'assignee'
  sort_by: text,         -- 'created_at' | 'priority' | 'due_date'
  sort_order: enum('asc', 'desc'),
  is_default: boolean DEFAULT false,
  created_at: timestamp
)
```

**Filter Options:**
- Status, Priority, Assignee, Tags
- Due date ranges
- Created by, Updated after
- Has blockers, Has subtasks

### Command Palette (from Weft)
Global `Ctrl+K` search for quick navigation:

- Search tasks, projects, documents, meetings
- Quick actions: "New task in Project X"
- Keyboard navigation (j/k/Enter)
- Recent items at top

### Tool-Specific Approval UIs (from Weft)
Different approval views per tool type:

| Tool | Approval View |
|------|---------------|
| `file_delete` | File content preview |
| `git_push` | Diff viewer with commits |
| `github_pr` | PR preview with description |
| `email_send` | Email preview (future) |

### Workflow Progress Tracker (from Weft)
Real-time execution visualization:

```typescript
workflow_steps (
  id: uuid PRIMARY KEY,
  session_id: uuid REFERENCES agent_sessions,
  step_number: integer,
  tool_name: text,
  status: enum('pending', 'running', 'completed', 'failed'),
  input_summary: text,
  output_summary: text,
  duration_ms: integer,
  started_at: timestamp,
  completed_at: timestamp
)
```

**UI Shows:**
- Current step with spinner
- Completed steps with duration
- Expandable logs per step
- Artifact links (files created, PRs opened)

### Slash Commands (from CCPM)
Quick workflow shortcuts:

| Command | Action |
|---------|--------|
| `/task:new` | Create new task in current project |
| `/task:assign` | Assign selected task to agent |
| `/meeting:new` | Create new meeting note |
| `/meeting:generate-tasks` | Generate tasks from current meeting |
| `/view:kanban` | Switch to kanban view |
| `/view:save` | Save current filters as view |

### Analytics Dashboard (from Plane)
Project insights and metrics:

- Tasks by status (pie chart)
- Completion rate over time (line chart)
- Agent utilization (tasks/day)
- Blocked tasks requiring attention
- Burndown chart for sprints
