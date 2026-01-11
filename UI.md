# Orchestrator - UI Design Notes

## Inspiration

### Primary: Source Diving Agent
Clean, minimal UI with:
- Collapsible icon rail sidebar
- Slide-out chat panel
- Tool use displays with collapsible steps
- shadcn/ui (Lyra style) components

### Secondary: Weft
Task board patterns:
- Task cards with status badges
- Approval workflows
- Real-time agent status indicators

### Tertiary: Plane (Open Source)
**Reference**: `reference/plane/` ([github.com/makeplane/plane](https://github.com/makeplane/plane))
- Open source Linear/Jira alternative
- Clean task management UI with cycles/sprints
- Hierarchical issue views
- Keyboard-first navigation
- Modern React frontend patterns

### Design Inspiration (Proprietary)
- **Linear** - Minimal, fast task management; keyboard-first UX; smooth animations
- **Notion** - Hierarchical pages; flexible blocks; clean typography

## Layout Structure

### 1. Sidebar (Left - Collapsible Icon Rail)
- **Collapsed state**: Icon-only rail (~48px wide)
- **Expanded state**: Full sidebar with labels (~240px wide)

**Navigation Items:**
- Dashboard (home icon) - Overview/stats
- Projects (folder icon) - Project list
- Tasks (check-square icon) - All tasks view
- Meetings (calendar icon) - All meetings view
- Documents (file-text icon) - Notes, diagrams, uploads
- Approvals (shield-check icon) - Pending approvals (with badge count)
- Prompts (sparkles icon) - Prompt library
- Settings (settings icon) - App settings

**Bottom:**
- User avatar + connection status
- Theme toggle

### 2. Main Content Area

#### Dashboard View
- Active projects summary
- Recent tasks
- Agent activity feed
- Quick actions (new project, new task)

#### Projects List View
- Header with title + "New Project" button
- Status filter tabs: All | Active | Archived
- Project cards showing:
  - Project name + description
  - Task progress (X/Y completed)
  - Connected repos count
  - Last activity
  - Tags

#### Project Detail View
- Project header with name, description, edit button
- Tabs: Tasks | Repositories | Settings
- Task board (list or kanban)
- "Add Task" button
- Repository list with clone status

#### Task Board View (List Mode)
```
┌─────────────────────────────────────────────────────────────┐
│ [Filter] [Sort] [Group by]                    [+ New Task]  │
├─────────────────────────────────────────────────────────────┤
│ ▼ Pending (3)                                               │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ [!] Setup authentication flow          [High] [md]  │   │
│   │     └─ Implement OAuth PKCE            [pending]    │   │
│   │     └─ Create session storage          [pending]    │   │
│   └─────────────────────────────────────────────────────┘   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ [ ] Create database schema             [Medium][sm] │   │
│   └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│ ▼ In Progress (1)                                           │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ [→] Setup TanStack Start project       [High] [sm]  │   │
│   │     Assigned to: claude-agent                       │   │
│   │     [████████░░] 80% • Last update 2m ago           │   │
│   └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│ ▼ Completed (5)                                             │
│   ...                                                       │
└─────────────────────────────────────────────────────────────┘
```

#### Task Detail View
- Task header (title, status badge, priority, effort)
- Description (Tiptap editor)
- Acceptance criteria checklist
- Subtasks list
- Dependencies
- Activity/updates timeline
- Linked meetings (which meetings created/updated this task)
- Agent chat panel (slide-out)

#### Meetings List View
- Header with title + "New Meeting" button
- Meeting cards showing:
  - Title + date
  - Attendees (avatars or names)
  - Status badge (Draft / Finalized)
  - Tasks created/updated count
  - Preview snippet

#### Meeting Detail View
- Meeting header (title, date, status)
- Attendees list (editable)
- Content editor (Tiptap - rich text, markdown)
- Action buttons:
  - [Finalize Meeting] - Lock content
  - [Generate Tasks] - Agent creates new tasks from notes
  - [Update Tasks] - Agent updates existing tasks based on notes
- Linked tasks section (tasks created/updated from this meeting)
- Agent activity log (what the agent did)

#### Documents List View
- Header with title + "New Document" button
- Filter tabs: All | Notes | Diagrams | Uploads
- Document cards showing:
  - Title + type icon
  - Preview (text snippet or diagram thumbnail)
  - Linked task/meeting if any
  - Last updated

#### Document Editor View
- Document header (title, type badge)
- Tiptap editor with:
  - Rich text formatting
  - Mermaid diagram blocks (live preview)
  - Image embedding
  - Code blocks with syntax highlighting
- Toolbar: Insert Mermaid | Upload File | Link to Task
- Linked items sidebar

#### Approvals View
- Pending approvals list (sorted by urgency)
- Each approval card shows:
  - Action type badge (Delete, Push, etc.)
  - Description of what agent wants to do
  - Files affected
  - Diff preview (expandable)
  - [Approve] [Reject] buttons

#### Diff Viewer
- File tree (left sidebar) - list of changed files
- Diff panel (main area):
  - Toggle: Side-by-side | Unified
  - Syntax highlighted code
  - Line numbers
  - Added lines (green background)
  - Removed lines (red background)
- Stats: +X additions, -Y deletions

### 3. AI Chat Panel (Right Side - Slide-out)
- Task context badge at top
- Message list with:
  - User messages (dark bubble, right-aligned)
  - Assistant messages (light, left-aligned)
  - Tool use displays (collapsible):
    - Read [icon] filename.ts
    - Edit [icon] filename.ts
    - Bash [icon] npm install
- Input at bottom with send button
- "Assign to Agent" button

## Key UI Components

### Task Card
```
┌─────────────────────────────────────────────────────────────┐
│ [Status] Task Title                          [Priority][Eff]│
│ Brief description or acceptance criteria...                 │
│                                                             │
│ ▸ 2 subtasks • Depends on #123           Updated 2 days ago │
└─────────────────────────────────────────────────────────────┘
```

### Task Status Badges
- **Pending** - Gray/neutral (○)
- **In Progress** - Blue + spinner when agent active (→)
- **Blocked** - Amber/orange (⊘) - requires attention
- **Completed** - Green + checkmark (✓)
- **Cancelled** - Gray + strikethrough (✗)
- **Archived** - Hidden from default views, shown in "Archived" filter

### Priority Badges
- **Urgent** - Red
- **High** - Orange
- **Medium** - Yellow
- **Low** - Gray

### Effort Badges (T-shirt sizing)
- **XS** - 1-2 hours
- **SM** - Half day
- **MD** - 1-2 days
- **LG** - 3-5 days
- **XL** - 1+ week

### Tool Use Display
```
Read    [TS] src/auth/oauth.ts
Edit    [TS] src/lib/utils.ts
Bash    [>_] npm run build
Search  [🔍] "authentication pattern"
```

### Agent Status Indicator
```
┌─────────────────────────────────────────┐
│ 🟢 Agent Connected                      │
│ Working on: Setup TanStack Start...     │
│ [████████░░░░░░░░] Turn 4/50            │
│ Last heartbeat: 5s ago                  │
└─────────────────────────────────────────┘
```

### Agent Queue Status
```
┌─────────────────────────────────────────┐
│ Agent Queue                     2/3 🟢  │
├─────────────────────────────────────────┤
│ → Running: Setup authentication    T#12 │
│ → Running: Create database schema  T#14 │
│ ○ Queued:  Add user endpoints (1st) T#15│
│ ○ Queued:  Write tests (2nd)        T#16│
└─────────────────────────────────────────┘
```

### Connection Status (Toast)
```
┌─────────────────────────────────────────┐
│ ⚠️ Connection lost. Reconnecting...     │
│ Attempt 2/10                            │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 🔴 Connection failed after 10 attempts  │
│ [Refresh Page]                          │
└─────────────────────────────────────────┘
```

### Task Dependency Indicator
```
┌─────────────────────────────────────────────────────────────┐
│ [Blocked] Implement user endpoints           [High] [md]    │
│                                                             │
│ ⊘ Blocked by:                                               │
│   • Setup database schema (in_progress)                     │
│   • Create auth middleware (pending)                        │
│                                                             │
│ ☑ Auto-start when unblocked                                │
└─────────────────────────────────────────────────────────────┘
```

### Repository Card
```
┌─────────────────────────────────────────┐
│ [GitHub] owner/repo-name                │
│ Branch: main • Cloned 6 days ago        │
│ Stack: TypeScript, React, TanStack      │
│ [Re-clone] [Remove]                     │
└─────────────────────────────────────────┘
```

### Meeting Card
```
┌─────────────────────────────────────────────────────────────┐
│ [Finalized] Sprint Planning - Week 12        Jan 10, 2026   │
│ Attendees: Alice, Bob, Claude                               │
│                                                             │
│ Discussed authentication flow changes and new dashboard...  │
│                                                             │
│ 3 tasks created • 2 tasks updated                           │
└─────────────────────────────────────────────────────────────┘
```

### Meeting Editor Actions
```
┌─────────────────────────────────────────────────────────────┐
│ Meeting: Sprint Planning - Week 12              [Draft ▾]   │
│ Date: Jan 10, 2026    Attendees: [Alice] [Bob] [+ Add]      │
├─────────────────────────────────────────────────────────────┤
│ [Tiptap Editor]                                             │
│                                                             │
│ ## Action Items                                             │
│ - Implement OAuth PKCE flow                                 │
│ - Update dashboard layout per new mockups                   │
│ - Remove deprecated API endpoints                           │
│                                                             │
│ ## Decisions                                                │
│ - Use TanStack Start instead of Next.js                     │
│ - PostgreSQL for primary database                           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ [Finalize Meeting]  [Generate Tasks ✨]  [Update Tasks 🔄]  │
└─────────────────────────────────────────────────────────────┘
```

### Document Card
```
┌─────────────────────────────────────────────────────────────┐
│ [Note] Architecture Overview                    Updated 2h  │
│                                                             │
│ System architecture diagram and component breakdown...      │
│                                                             │
│ 📎 Linked to: Setup authentication flow                     │
└─────────────────────────────────────────────────────────────┘
```

### Mermaid Editor Block
```
┌─────────────────────────────────────────────────────────────┐
│ ```mermaid                                      [Preview]   │
│ graph TD                                                    │
│   A[Client] --> B[API Gateway]                              │
│   B --> C[Auth Service]                                     │
│   B --> D[Task Service]                                     │
│   C --> E[(Database)]                                       │
│   D --> E                                                   │
│ ```                                                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │           [Rendered Mermaid Diagram]                │    │
│  │      Client → API Gateway → Auth/Task → DB          │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Approval Card
```
┌─────────────────────────────────────────────────────────────┐
│ [🗑️ Delete] Agent wants to delete files         2 min ago   │
├─────────────────────────────────────────────────────────────┤
│ Task: Refactor authentication module                        │
│                                                             │
│ Files to delete:                                            │
│   • src/auth/old-handler.ts                                 │
│   • src/auth/deprecated-utils.ts                            │
│                                                             │
│ [▼ Show Diff]                                               │
├─────────────────────────────────────────────────────────────┤
│                              [Reject]  [Approve ✓]          │
└─────────────────────────────────────────────────────────────┘
```

### Diff Viewer
```
┌───────────────────────┬─────────────────────────────────────┐
│ Changed Files         │ src/auth/handler.ts                 │
│                       │ [Side-by-side ▾]  +12 -5            │
├───────────────────────┼─────────────────────────────────────┤
│ ▼ src/                │  10│ import { db } from '../db'     │
│   ▼ auth/             │  11│                                │
│     ● handler.ts  +12 │ -12│ async function login(req) {    │
│     ● utils.ts    +3  │ +12│ async function login(req: Req) │
│   ▼ lib/              │  13│   const user = await db.find() │
│     ○ constants.ts    │ -14│   return user                  │
│                       │ +14│   if (!user) throw new Error() │
│                       │ +15│   return { user, token }       │
│                       │  16│ }                              │
└───────────────────────┴─────────────────────────────────────┘
```

### Command Palette (Ctrl+K)
```
┌─────────────────────────────────────────────────────────────┐
│ 🔍 Search tasks, projects, documents...                     │
├─────────────────────────────────────────────────────────────┤
│ Recent                                                      │
│   ○ Setup authentication flow              Task • Project A │
│   ○ Sprint Planning Meeting                Meeting • Jan 10 │
├─────────────────────────────────────────────────────────────┤
│ Actions                                                     │
│   + New task in Project A                                   │
│   + New meeting note                                        │
│   ⚙ Switch to Kanban view                                  │
├─────────────────────────────────────────────────────────────┤
│ Results for "auth"                                          │
│   ○ Auth patterns document              Document • Project B│
│   ○ Implement OAuth PKCE                    Task • Project A│
└─────────────────────────────────────────────────────────────┘
```

### View Switcher
```
┌─────────────────────────────────────────────────────────────┐
│ Tasks                    [List ▾] [Group: Status ▾] [+ Save]│
├─────────────────────────────────────────────────────────────┤
│ Saved Views:  [All Tasks] [My Tasks] [High Priority] [+]    │
└─────────────────────────────────────────────────────────────┘

Layout Options: [≡ List] [▦ Kanban] [📅 Calendar] [📊 Gantt]
```

### Workflow Progress Panel
```
┌─────────────────────────────────────────────────────────────┐
│ Agent Progress                              Turn 4/50  ⏱ 2m │
├─────────────────────────────────────────────────────────────┤
│ ✓ Read src/auth/config.ts                           0.3s   │
│ ✓ Analyzed existing patterns                        1.2s   │
│ ✓ Created src/lib/pkce.ts                           0.8s   │
│ → Writing src/server/auth/oauth.ts...                      │
│ ○ Create login UI component                                │
│ ○ Update routes                                            │
├─────────────────────────────────────────────────────────────┤
│ [▼ Show Logs]                          Artifacts: 2 files  │
└─────────────────────────────────────────────────────────────┘
```

### Annotation Toolbar (in Document Editor)
```
┌─────────────────────────────────────────────────────────────┐
│ [B] [I] [U] [Link] │ Highlight: [🟡][🟢][🔵][🩷][🟣] │ [+Note]│
└─────────────────────────────────────────────────────────────┘

Selected text with annotation:
┌─────────────────────────────────────────────────────────────┐
│ This is ████highlighted text████ with a note attached.      │
│         └─ Note: "Important auth pattern" [Edit] [Delete]   │
└─────────────────────────────────────────────────────────────┘
```

### Collection Manager
```
┌─────────────────────────────────────────────────────────────┐
│ Collections                                    [+ New]      │
├─────────────────────────────────────────────────────────────┤
│ 📌 Pinned                                                   │
│   🔐 Auth Patterns                              12 items    │
│   📋 Sprint 12 Tasks                             8 items    │
├─────────────────────────────────────────────────────────────┤
│ All Collections                                             │
│   📚 TanStack Examples                           5 items    │
│   💡 Ideas & Research                           14 items    │
└─────────────────────────────────────────────────────────────┘
```

### Analytics Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│ Project Analytics                    [Last 7 days ▾]        │
├───────────────────────────┬─────────────────────────────────┤
│ Tasks by Status           │ Completion Rate                 │
│  ┌────────────────┐       │  100%┤     ╭──────              │
│  │ ████ Completed │ 12    │   75%┤   ╭─╯                    │
│  │ ██ In Progress │  4    │   50%┤ ╭─╯                      │
│  │ █ Pending      │  2    │   25%┤╭╯                        │
│  │ ░ Blocked      │  1    │    0%┼─────────────────         │
│  └────────────────┘       │      Mon Tue Wed Thu Fri        │
├───────────────────────────┴─────────────────────────────────┤
│ Agent Activity: 8 tasks completed • 2.3 tasks/day avg       │
│ Blocked Tasks: 1 requiring attention                        │
└─────────────────────────────────────────────────────────────┘
```

## Modals

### Plan Review Modal (Before Agent Execution)
```
┌─────────────────────────────────────────────────────────────┐
│ Agent Execution Plan                              [✕ Close] │
├─────────────────────────────────────────────────────────────┤
│ Task: Implement OAuth PKCE authentication flow              │
│                                                             │
│ I'll complete this task by:                                 │
│                                                             │
│ 1. Create auth configuration file                           │
│    → src/server/auth/config.ts (new file)                   │
│                                                             │
│ 2. Implement PKCE utilities                                 │
│    → src/lib/pkce.ts (new file)                             │
│                                                             │
│ 3. Create OAuth server functions                            │
│    → src/server/auth/oauth.ts (new file)                    │
│                                                             │
│ 4. Add login UI component                                   │
│    → src/components/auth/login-button.tsx (new file)        │
│                                                             │
│ 5. Update routes for callback                               │
│    → src/routes/auth/callback.tsx (new file)                │
│                                                             │
│ Estimated: 5 files, ~400 lines                              │
├─────────────────────────────────────────────────────────────┤
│ [Cancel]                              [Modify] [Approve ✓]  │
└─────────────────────────────────────────────────────────────┘
```

### New Task Dialog
- Title input
- Description (Tiptap editor)
- Parent task selector (for subtasks)
- Priority dropdown
- Effort dropdown
- Acceptance criteria (add/remove items)
- Dependencies selector
- Create button

### New Project Dialog
- Project name input
- Description textarea
- Initial repo URL (optional)
- Tags input
- Create button

### Task Assignment Dialog
- Select agent type
- Custom system prompt (optional)
- Working directory
- Confirm button

## Color Palette (Dark Theme)
- Background: neutral-950 (#0a0a0a)
- Card: neutral-900 (#171717)
- Border: neutral-800 (#262626)
- Text primary: neutral-50 (#fafafa)
- Text secondary: neutral-400 (#a3a3a3)
- Accent: Blue (#3b82f6)
- Success: Green (#22c55e)
- Warning: Amber (#f59e0b)
- Error: Red (#ef4444)

## Interactions

### Keyboard Shortcuts (Plane-inspired)
- `Ctrl+K` - Command palette / global search
- `Ctrl+N` - New task
- `Ctrl+Shift+N` - New project
- `Ctrl+Enter` - Send chat message / approve action
- `Ctrl+/` - Toggle chat panel
- `Ctrl+.` - Toggle sidebar
- `Esc` - Close modals / cancel
- `j/k` - Navigate tasks (vim-style)
- `Enter` - Open selected task
- `Space` - Cycle task status (pending → in_progress → completed)
- `b` - Mark as blocked
- `x` - Cancel task
- `e` - Edit selected task (inline)
- `d` - Delete selected task (with confirmation)
- `a` - Assign to agent
- `?` - Show keyboard shortcuts

### Drag & Drop
- Reorder tasks within list
- Move tasks between status groups
- Reorder subtasks

### Auto-save (Source Dive pattern)
- All content auto-saves after 1 second of no typing
- Show subtle "Saving..." / "Saved" indicator in corner
- No explicit save button needed

### Inline Editing (Plane pattern)
- Click task title to edit inline (no modal)
- Press Enter to save, Esc to cancel
- Click status badge to cycle through states
- Click priority badge to change priority
- Minimal modal usage - only for complex operations

## Responsive Behavior
- Mobile: Sidebar as sheet/drawer, single column
- Tablet: Collapsed sidebar by default
- Desktop: Full sidebar, side-by-side panels

## Animation
- Sidebar collapse/expand: 200ms ease
- Modal open/close: 150ms
- Status changes: Subtle pulse
- Task card hover: Slight lift
- Chat messages: Slide in from bottom

## Typography
- **Body font**: Inter Variable (via `@fontsource-variable/inter`)
- **Code/Mono font**: JetBrains Mono (via `@fontsource/jetbrains-mono`)
- Headings: Semi-bold Inter
- Body: Regular Inter (400)
- Code blocks, terminal output, file paths: JetBrains Mono at 90% body size
- All code samples, inline code, and monospace content should use JetBrains Mono

## Empty States
- No projects: "Create your first project" + button
- No tasks: "Add tasks to get started" + button
- No repos: "Link a repository for context" + button
- No activity: "Assign a task to an agent to see activity"

## Loading States
- Skeleton loaders for cards
- Spinner for agent operations
- Progress bar for long operations
- Optimistic updates where possible
