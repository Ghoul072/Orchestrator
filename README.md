# Orchestrator

A full-fledged Project Manager for developers using Claude Code. Create projects, add repositories, define tasks with subtasks, and let AI agents handle the implementation.

## The Problem

Modern development with AI coding assistants is fragmented:
- Tasks exist in your head or scattered across tools
- Context is lost between AI sessions
- No way to track what the agent accomplished
- Can't leverage previous codebase analyses
- Parallel work requires manual coordination

## The Solution

Orchestrator provides a unified interface for AI-assisted development:

- **Project Management** - Create projects with repositories, tasks, and context
- **Hierarchical Tasks** - Break down work into tasks and subtasks with dependencies
- **Agent Assignment** - Assign tasks to Claude Code agents with full context
- **Progress Tracking** - Real-time updates as agents work on tasks
- **Knowledge Integration** - Optional MCP bridge to source-diving-agent knowledge base
- **GitHub Sync** - Push tasks as issues, pull updates back

## Features

### Core Features
- [ ] Project CRUD with metadata and agent context
- [ ] Repository management (add, clone, detect stack)
- [ ] Hierarchical task management (tasks/subtasks)
- [ ] Task dependencies and parallel execution flags
- [ ] Priority and effort estimation
- [ ] Claude Code agent integration via SDK
- [ ] Real-time WebSocket updates
- [ ] Prompt templates with variables

### Meeting Notes
- [ ] Meeting notes with Tiptap editor
- [ ] Attendees tracking
- [ ] **Generate Tasks** - Agent analyzes meeting notes and creates tasks
- [ ] **Update Tasks** - Agent updates existing tasks when requirements change
- [ ] Meeting-task linking (traceability)

### Documents & Diagrams
- [ ] Notes with Mermaid diagram support (flowcharts, sequence, ERD)
- [ ] Live Mermaid preview in editor
- [ ] File uploads (images, PDFs, diagrams)
- [ ] Link documents to tasks/meetings

### Git Diff & Approvals
- [ ] Diff viewer (side-by-side and unified)
- [ ] Syntax-highlighted file changes
- [ ] Approval workflow for destructive agent actions
- [ ] Approve/reject with comments

### Edge Cases & Reliability
- [ ] Task dependencies (blocks/blocked_by/relates_to)
- [ ] Concurrent agent limits (max 3 per user)
- [ ] Agent queue with priority
- [ ] Auto-start dependent tasks after completion
- [ ] WebSocket reconnection with exponential backoff
- [ ] Session timeout and heartbeat monitoring
- [ ] Graceful error recovery (retry, degrade, fail)
- [ ] Context preservation (sliding window, summarization)

### Views & Navigation (from Plane)
- [ ] Multiple view layouts (list, kanban, calendar, gantt)
- [ ] Saved views with filters and grouping
- [ ] Command palette (Ctrl+K) for quick navigation
- [ ] Advanced filters (status, priority, assignee, date ranges)

### Collections & Annotations (from Source Dive)
- [ ] Collections (themed groupings of documents/tasks)
- [ ] 5-color highlight system with notes
- [ ] Pinned collections in sidebar

### Workflow & Progress (from Weft)
- [ ] Workflow progress tracker with steps
- [ ] Tool-specific approval UIs
- [ ] Artifact tracking (files created, PRs opened)
- [ ] Slash commands for quick actions

### Analytics
- [ ] Tasks by status chart
- [ ] Completion rate over time
- [ ] Agent utilization metrics
- [ ] Burndown chart

### GitHub Integration
- [ ] Sync tasks as GitHub Issues
- [ ] Bidirectional status sync
- [ ] Parent-child issue relationships
- [ ] PR linking to tasks

### MCP Integration (Optional)
- [ ] MCP client to query source-diving-agent
- [ ] MCP server to expose Orchestrator data
- [ ] Knowledge-enhanced task prompts

## Tech Stack

- **Framework**: TanStack Start (React meta-framework)
- **UI**: shadcn/ui + Tailwind CSS
- **Database**: PostgreSQL + Drizzle ORM
- **Agent**: Claude Agent SDK
- **Auth**: Anthropic OAuth 2.0 + PKCE
- **Real-time**: WebSocket
- **Protocol**: MCP (Model Context Protocol)

## Architecture

```
+-------------------------------------------------------------------+
|                     Orchestrator Web App                           |
+-------------------+-------------------+---------------------------+
|   Project View    |   Task Board      |   Agent Chat Panel        |
|   (Repos, Tags)   |   (Kanban/List)   |   (Real-time streaming)   |
+--------+----------+--------+----------+-------------+-------------+
         |                   |                        |
         v                   v                        v
+-------------------------------------------------------------------+
|                   TanStack Start Server Functions                  |
+-------------------+-------------------+---------------------------+
         |                   |                        |
    +----+----+         +----+----+              +----+----+
    |PostgreSQL|         |WebSocket|              |MCP Client|
    | (Drizzle)|         | Bridge  |              |(optional)|
    +----+----+         +----+----+              +----+----+
         |                   |                        |
         |              +----+----+              +----+----+
         |              | Claude  |              |Source   |
         |              | Agent   |              |Diving   |
         |              | SDK     |              |Agent    |
         |              +---------+              +---------+
         |
    +----+----+
    | GitHub  |
    | Issues  |
    | (sync)  |
    +---------+
```

## Getting Started

### Prerequisites

- Bun (package manager and runtime)
- PostgreSQL database
- Claude Pro/Max subscription (for OAuth)
- Claude CLI installed (`npm install -g @anthropic-ai/claude-code`)

### Installation

```bash
# Install dependencies
bun install

# Setup database
bunx drizzle-kit push

# Seed initial data (optional)
bun scripts/seed-data.ts

# Run development servers
bun run dev
```

This starts:
- TanStack Start app on http://localhost:3000
- WebSocket server on ws://localhost:3001

### MCP Setup (Optional)

To enable knowledge base integration with source-diving-agent, add to your Claude Code settings:

```json
{
  "mcpServers": {
    "orchestrator": {
      "command": "bun",
      "args": ["run", "/path/to/orchestrator/scripts/mcp-server.ts"]
    },
    "source-dive": {
      "command": "bun",
      "args": ["run", "/path/to/source-dive/scripts/mcp-server.ts"]
    }
  }
}
```

## Project Structure

```
src/
├── components/       # React components
│   ├── projects/     # Project management
│   ├── tasks/        # Task management
│   ├── chat/         # Agent chat panel
│   └── ui/           # shadcn components
├── lib/              # Client utilities
├── queries/          # TanStack Query options
├── routes/           # TanStack Router pages
└── server/           # Server-side code
    ├── agent/        # Claude Agent SDK
    ├── db/           # Drizzle ORM
    ├── functions/    # Server functions
    └── mcp/          # MCP client/server

reference/            # Reference implementations
├── source-diving-agent/
├── weft/
├── ccpm/
└── claude-code-mcp/

docs/                 # Documentation
├── mcp-server.md
└── reference-*.md
```

## Implementation Roadmap

### Phase 1: Foundation
- [ ] Project setup with TanStack Start + shadcn/ui
- [ ] PostgreSQL + Drizzle ORM setup
- [ ] Project CRUD operations
- [ ] Basic routing and layout

### Phase 2: Task Management
- [ ] Task schema with hierarchical structure
- [ ] Task CRUD server functions
- [ ] Task list component with nesting
- [ ] Task card with status, priority, effort
- [ ] Task editor dialog
- [ ] Drag-and-drop reordering
- [ ] Task dependencies
- [ ] Task filtering and search

### Phase 3: Repository Integration
- [ ] Repository schema and operations
- [ ] GitHub URL validation
- [ ] Clone functionality with status tracking
- [ ] Stack/dependency detection
- [ ] Repository file browser
- [ ] Auto-cleanup after sessions

### Phase 4: Authentication
- [ ] Anthropic OAuth 2.0 setup
- [ ] PKCE flow implementation
- [ ] Session storage (file-based)
- [ ] Protected routes

### Phase 5: Agent Integration
- [ ] Claude Agent SDK setup
- [ ] WebSocket server for streaming
- [ ] Agent session management
- [ ] useAgent React hook
- [ ] Chat panel component
- [ ] Tool use display
- [ ] Task context injection

### Phase 6: MCP Integration
- [ ] MCP server exposing Orchestrator tools
- [ ] MCP client for source-diving-agent
- [ ] Knowledge base search integration
- [ ] Document fetching for context
- [ ] 2-way sync protocol

### Phase 7: GitHub Sync
- [ ] GitHub CLI integration
- [ ] Push tasks as issues
- [ ] Pull issue updates
- [ ] Parent-child relationships
- [ ] Label management
- [ ] PR linking

### Phase 8: Meeting Notes & Documents
- [ ] Meeting CRUD operations
- [ ] Tiptap editor for meeting content
- [ ] Attendees management
- [ ] Generate Tasks from meeting notes
- [ ] Update Tasks based on requirement changes
- [ ] Meeting-task linking
- [ ] Documents with Mermaid support
- [ ] File uploads

### Phase 9: Git Diff & Approvals
- [ ] Diff viewer component
- [ ] File changes tree
- [ ] Approval workflow
- [ ] Approve/reject actions

### Phase 10: Reliability & Edge Cases
- [ ] Task dependency system (blocks/blocked_by)
- [ ] Concurrent agent limits and queue
- [ ] Auto-start dependent tasks
- [ ] WebSocket reconnection handling
- [ ] Session timeout with heartbeats
- [ ] Graceful error recovery
- [ ] Context preservation (summarization)

### Phase 11: Views & Navigation
- [ ] Kanban board view
- [ ] Calendar view
- [ ] Gantt chart view
- [ ] Saved views with filters
- [ ] Command palette (Ctrl+K)
- [ ] Advanced filters

### Phase 12: Collections & Annotations
- [ ] Collections system
- [ ] Annotation highlights (5 colors)
- [ ] Pinned collections

### Phase 13: Analytics & Polish
- [ ] Analytics dashboard
- [ ] Workflow progress tracker
- [ ] Slash commands
- [ ] Export functionality

### Phase 14: Advanced Features
- [ ] Parallel agent execution (git worktrees)
- [ ] Team collaboration
- [ ] Prompt library marketplace

## Reference Projects

This project draws inspiration from:

| Project | Link | Key Ideas |
|---------|------|-----------|
| Source Diving Agent | [boring-labs/source-diving-agent](https://github.com/boring-labs/source-diving-agent) | **MCP server** (`@modelcontextprotocol/sdk`), TanStack patterns, knowledge base |
| Weft | [jonesphillip/weft](https://github.com/jonesphillip/weft) | Task board, **MCP client bridge**, approval workflows |
| CCPM | [automazeio/ccpm](https://github.com/automazeio/ccpm) | PRD workflow, GitHub Issues, parallel agents (no MCP) |

> **Note**: `claude-code-mcp` is in the reference folder but serves a different purpose - it wraps Claude Code for other AI tools (Cursor/Windsurf) to call. Not directly useful for Orchestrator since we're building *with* Claude Code, not exposing it to other tools.

## Development

```bash
# Start development
bun run dev

# Type check
bun run typecheck

# Database studio
bunx drizzle-kit studio

# Build for production
bun run build
```

## License

MIT

---

## Detailed Task Breakdown

### 1. Project Setup Tasks

#### 1.1 Initialize TanStack Start Project
- [ ] Create new TanStack Start project with Bun
- [ ] Configure TypeScript strict mode
- [ ] Setup ESLint + Prettier
- [ ] Add path aliases (`~`, `@`)

#### 1.2 Setup shadcn/ui
- [ ] Initialize shadcn/ui with Tailwind
- [ ] Install core components (button, card, dialog, input, etc.)
- [ ] Configure dark mode
- [ ] Setup JetBrains Mono font

#### 1.3 Database Setup
- [ ] Install Drizzle ORM + PostgreSQL driver
- [ ] Create `drizzle.config.ts`
- [ ] Create initial schema file
- [ ] Setup database connection with lazy init
- [ ] Create migration scripts

### 2. Project Management Tasks

#### 2.1 Project Schema
- [ ] Define `projects` table
- [ ] Define `project_tags` junction table
- [ ] Define `tags` table
- [ ] Create TypeScript types from schema

#### 2.2 Project Server Functions
- [ ] `getProjects()` - List all projects
- [ ] `getProject(id)` - Get single project
- [ ] `createProject(data)` - Create new project
- [ ] `updateProject(id, data)` - Update project
- [ ] `deleteProject(id)` - Delete project
- [ ] `archiveProject(id)` - Archive project

#### 2.3 Project UI Components
- [ ] `ProjectList` - Grid of project cards
- [ ] `ProjectCard` - Individual project preview
- [ ] `ProjectDialog` - Create/edit dialog
- [ ] `ProjectDetail` - Full project view
- [ ] `ProjectSettings` - Project configuration

### 3. Task Management Tasks

#### 3.1 Task Schema
- [ ] Define `tasks` table with parent_id for hierarchy
- [ ] Define `task_updates` table for progress
- [ ] Add indexes for common queries
- [ ] Create TypeScript types

#### 3.2 Task Server Functions
- [ ] `getTasks(projectId, filters)` - List tasks
- [ ] `getTask(id)` - Get task with subtasks
- [ ] `createTask(data)` - Create task
- [ ] `updateTask(id, data)` - Update task
- [ ] `deleteTask(id)` - Delete task
- [ ] `moveTask(id, parentId, sortOrder)` - Reorder
- [ ] `updateTaskStatus(id, status)` - Status change
- [ ] `addTaskUpdate(taskId, update)` - Add progress

#### 3.3 Task UI Components
- [ ] `TaskBoard` - Main task view (list/kanban)
- [ ] `TaskList` - Hierarchical task list
- [ ] `TaskCard` - Individual task card
- [ ] `TaskEditor` - Create/edit dialog
- [ ] `SubtaskList` - Nested subtasks
- [ ] `TaskStatusBadge` - Status indicator
- [ ] `TaskPriorityBadge` - Priority indicator
- [ ] `TaskProgress` - Progress timeline

### 4. Repository Tasks

#### 4.1 Repository Schema
- [ ] Define `repositories` table
- [ ] Add clone status enum
- [ ] Create TypeScript types

#### 4.2 Repository Server Functions
- [ ] `getRepositories(projectId)` - List repos
- [ ] `addRepository(projectId, url)` - Add repo
- [ ] `removeRepository(id)` - Remove repo
- [ ] `cloneRepository(id)` - Clone to local
- [ ] `detectStack(id)` - Analyze repo
- [ ] `cleanupRepository(id)` - Delete local clone

#### 4.3 Repository UI Components
- [ ] `RepositoryList` - List of repos
- [ ] `RepositoryCard` - Repo preview
- [ ] `AddRepositoryDialog` - Add new repo
- [ ] `RepositoryBrowser` - File tree (future)

### 5. Authentication Tasks

#### 5.1 OAuth Implementation
- [ ] Setup Anthropic OAuth client
- [ ] Implement PKCE flow
- [ ] Create auth server functions
- [ ] Setup session storage

#### 5.2 Auth UI Components
- [ ] `LoginButton` - Initiate OAuth
- [ ] `AuthCallback` - Handle callback
- [ ] `UserMenu` - User dropdown
- [ ] Protected route wrapper

### 6. Agent Integration Tasks

#### 6.1 Agent Backend
- [ ] Setup Claude Agent SDK
- [ ] Create `AgentManager` class
- [ ] Implement WebSocket server
- [ ] Agent session database ops
- [ ] Tool call logging

#### 6.2 Agent UI Components
- [ ] `ChatPanel` - Main chat interface
- [ ] `ChatMessage` - Message display
- [ ] `ToolUseDisplay` - Tool call visualization
- [ ] `AgentStatusIndicator` - Connection status
- [ ] `useAgent` React hook

### 7. MCP Integration Tasks

#### 7.1 MCP Server (Expose Orchestrator)
- [ ] Setup MCP server with stdio transport
- [ ] Implement `list_projects` tool
- [ ] Implement `get_project` tool
- [ ] Implement `list_tasks` tool
- [ ] Implement `get_task` tool
- [ ] Implement `create_task` tool
- [ ] Implement `update_task_status` tool

#### 7.2 MCP Client (Connect to Source Dive)
- [ ] Setup MCP client connection
- [ ] Query `search_knowledge_base`
- [ ] Fetch documents with `get_document`
- [ ] Cache responses locally
- [ ] Integrate into task prompts

### 8. GitHub Sync Tasks

#### 8.1 GitHub Integration
- [ ] Setup GitHub CLI detection
- [ ] Implement issue creation
- [ ] Implement issue update
- [ ] Implement issue status sync
- [ ] Setup sub-issue extension

#### 8.2 Sync Server Functions
- [ ] `syncTaskToGitHub(taskId)` - Push task
- [ ] `syncFromGitHub(projectId)` - Pull updates
- [ ] `linkPR(taskId, prNumber)` - Link PR

---

## Quick Reference Commands

```bash
# Clone reference repos
gh repo clone boring-labs/source-diving-agent reference/source-diving-agent
gh repo clone jonesphillip/weft reference/weft
gh repo clone automazeio/ccpm reference/ccpm
gh repo clone steipete/claude-code-mcp reference/claude-code-mcp
```
