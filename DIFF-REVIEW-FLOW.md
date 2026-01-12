# Diff Review Flow Design

Reference design for the agent change review workflow in Orchestrator.

## Overview

When an agent makes changes to code, users need a way to:
1. See what changed (diff view)
2. Comment on specific lines
3. Request changes or approve

This document describes the UI and interaction patterns.

---

## UI Layout

### Three-Panel Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Header Bar                                    │
│  [Repository/Task Info]                        [Fetch] [Push/Apply]     │
├──────────────────────┬──────────────────────────────────────────────────┤
│                      │                                                   │
│   File Changes       │              Diff Viewer                         │
│   Panel              │                                                   │
│                      │                                                   │
│   ┌──────────────┐   │   ┌─────────────────────────────────────────┐   │
│   │ MODIFIED (5) │   │   │ M src/auth/jwt.ts           +24 -8     │   │
│   ├──────────────┤   │   ├─────────────────────────────────────────┤   │
│   │ ● jwt.ts   M │   │   │ 38  38   async function validate...    │   │
│   │ ○ crypto  A │   │   │ 39  39     try {                        │   │
│   │ ○ config  M │   │   │ +   40     const decoded = jwt...       │   │
│   │ ○ README  M │   │   │                                         │   │
│   │ ○ test    A │   │   │     ┌─────────────────────────────┐     │   │
│   └──────────────┘   │   │     │ You         [Pending...]   │     │   │
│                      │   │     │ "fix this slop"             │     │   │
│   ┌──────────────┐   │   │     └─────────────────────────────┘     │   │
│   │   ACTIONS    │   │   │                                         │   │
│   ├──────────────┤   │   │ +   47     if (err instanceof...       │   │
│   │ [+ New     ] │   │   │ +   48       throw err; // Re-throw    │   │
│   │ [  Squash  ] │   │   │ +   49     }                           │   │
│   │ [  Split   ] │   │   │                                         │   │
│   │ [  Undo    ] │   │   │ ┌─────────────────────────────────────┐ │   │
│   ├──────────────┤   │   │ │ Comment on lines 47-49          [X] │ │   │
│   │[Describe    ]│   │   │ │ ┌─────────────────────────────────┐ │ │   │
│   │[ Change     ]│   │   │ │ │ refactor this                  │ │ │   │
│   └──────────────┘   │   │ │ └─────────────────────────────────┘ │ │   │
│                      │   │ │ Cmd/Ctrl+Enter    [Send] [+Review] │ │   │
│                      │   │ └─────────────────────────────────────┘ │   │
│                      │                                                   │
└──────────────────────┴──────────────────────────────────────────────────┘
```

---

## File Changes Panel

### File List
- Shows all modified, added, and deleted files
- File status badges:
  - **M** (Modified) - Blue/default
  - **A** (Added) - Green
  - **D** (Deleted) - Red
- Clicking a file shows its diff in the main panel
- Selected file is highlighted

### Stats Display
- "MODIFIED (5)" header showing count
- Each file shows its status badge
- Could also show per-file +/- line counts

### Actions Section
Located at bottom of file panel:

| Action | Description |
|--------|-------------|
| **+ New** | Create a new commit/change set |
| **Squash** | Combine multiple changes into one |
| **Split** | Split a change into multiple parts |
| **Undo** | Revert the selected change |
| **Describe Change** | Add/edit commit message |

---

## Diff Viewer

### Header
- File path with status badge
- Line change stats: `+24 -8` (additions/deletions)
- Optional: Toggle unified/split view

### Line Display
Two-column layout:

```
[old line#] [new line#] [+/-/space] [code content]
```

Color coding:
- **Green background** + `+` prefix = Added lines
- **Red background** + `-` prefix = Removed lines
- **No background** = Context lines (unchanged)

### Comment Indicators
- **Blue dots** appear in the gutter on hover
- Clicking a dot opens the comment input for that line
- Can click-drag to select a range of lines
- Lines with existing comments show a badge/indicator

---

## Inline Comments

### Comment Display
When a comment exists on a line:

```
┌─────────────────────────────────────────┐
│ [Avatar] Author Name    [Status Badge]  │
│                                    [▼]  │
│ Comment content goes here...            │
│                                         │
│ [Reply] [Resolve]              [Delete] │
└─────────────────────────────────────────┘
```

### Comment States

| State | Badge Color | Description |
|-------|-------------|-------------|
| **Pending** | Yellow/Orange | Draft, not yet submitted |
| **Submitted** | Blue | Sent but awaiting response |
| **Resolved** | Green | Marked as addressed |
| **Change Requested** | Red/Orange | Blocking, must be fixed |

### Comment Types

1. **Regular Comment** - Informational feedback
2. **Change Request** - Blocking issue that must be addressed
3. **Suggestion** - Optional improvement with code snippet

---

## Comment Input

### Single Line Comment
```
┌─────────────────────────────────────────┐
│ Comment on line 42                  [X] │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ Your comment here...                │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [ ] Request change                      │
│                                         │
│ Cmd/Ctrl+Enter      [Send] [+ Review]   │
└─────────────────────────────────────────┘
```

### Multi-Line Comment (Range)
```
┌─────────────────────────────────────────┐
│ Comment on lines 47-49              [X] │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ refactor this                       │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [x] Request change                      │
│                                         │
│ Cmd/Ctrl+Enter      [Send] [+ Review]   │
└─────────────────────────────────────────┘
```

### Input Actions

| Button | Behavior |
|--------|----------|
| **Send now** | Immediately post the comment |
| **+ Add to review** | Batch comment for later submission |
| **Request change** | Mark as blocking change request |

---

## Review Flow

### Step 1: View Changes
1. Agent completes task and shows changes
2. User sees file list in left panel
3. User clicks files to view diffs

### Step 2: Add Comments
1. Hover over line numbers to see blue dots
2. Click dot to open comment input
3. Type feedback
4. Choose: Send now OR Add to review (batch)

### Step 3: Submit Review

```
┌─────────────────────────────────────────┐
│           Submit Review                 │
├─────────────────────────────────────────┤
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Overall feedback (optional)...      │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ○ Comment                               │
│   Submit feedback without approval      │
│                                         │
│ ○ Approve                               │
│   Accept changes and apply              │
│                                         │
│ ● Request Changes                       │
│   Block until issues are addressed      │
│                                         │
│ Pending comments: 3                     │
│ Change requests: 1                      │
│                                         │
│              [Cancel]  [Submit Review]  │
└─────────────────────────────────────────┘
```

### Review Outcomes

| Outcome | Effect |
|---------|--------|
| **Comment** | Feedback recorded, no action taken |
| **Approve** | Changes accepted, can be applied/merged |
| **Request Changes** | Agent must address comments before re-review |

---

## Implementation in Orchestrator

### Existing Components to Enhance

1. **`diff-viewer.tsx`** - Add:
   - Clickable line indicators (blue dots)
   - Inline comment rendering
   - Line range selection

2. **`diff-line-comments.tsx`** - Already created, enhance:
   - Multi-line range support
   - "Add to review" batching
   - Keyboard shortcuts

3. **`file-changes.tsx`** - Add:
   - Per-file comment counts
   - Actions section (Squash, Split, etc.)

4. **`approval-card.tsx`** - Add:
   - Review submission dialog
   - Pending comment summary
   - Three-way choice (Comment/Approve/Request Changes)

### New Components Needed

1. **`review-summary.tsx`** - Shows pending comments before submit
2. **`comment-thread.tsx`** - Threaded replies on comments
3. **`suggestion-block.tsx`** - Code suggestions with apply button

### Data Model Extensions

```typescript
interface DiffComment {
  id: string
  fileePath: string
  startLine: number
  endLine: number
  lineType: 'add' | 'remove' | 'context'
  content: string
  isChangeRequest: boolean
  status: 'pending' | 'submitted' | 'resolved'
  author: string
  createdAt: Date
  replies?: DiffComment[]
}

interface Review {
  id: string
  approvalId: string
  outcome: 'comment' | 'approve' | 'request_changes'
  summary?: string
  comments: DiffComment[]
  submittedAt: Date
}
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `j` / `k` | Navigate between files |
| `n` / `p` | Jump to next/prev comment |
| `c` | Open comment on current line |
| `Cmd+Enter` | Submit comment |
| `Escape` | Close comment input |
| `a` | Open approve dialog |
| `r` | Request changes |

---

## Visual States

### Line Hover States
```css
/* Default - no indicator */
.line-gutter { }

/* Hover - show blue dot */
.line-gutter:hover::after {
  content: '';
  background: var(--color-info);
  border-radius: 50%;
}

/* Has comment - persistent indicator */
.line-gutter.has-comment::after {
  content: '';
  background: var(--color-info);
}

/* Change request - orange indicator */
.line-gutter.has-change-request::after {
  background: var(--color-warning);
}
```

### Comment Card States
```css
/* Pending (draft) */
.comment-card.pending {
  border-left: 3px solid var(--color-warning);
  opacity: 0.8;
}

/* Submitted */
.comment-card.submitted {
  border-left: 3px solid var(--color-info);
}

/* Change request */
.comment-card.change-request {
  border-left: 3px solid var(--color-destructive);
  background: var(--color-destructive)/10;
}

/* Resolved */
.comment-card.resolved {
  opacity: 0.6;
  border-left: 3px solid var(--color-success);
}
```

---

## Agent Integration

When agent receives "Request Changes":

1. Agent reads all change request comments
2. Agent attempts to address each issue
3. Agent re-submits for review
4. Cycle continues until approved

```typescript
// Agent system prompt addition
const changeRequestContext = `
The user has requested the following changes to your implementation:

${changeRequests.map(cr => `
File: ${cr.filePath}
Lines ${cr.startLine}-${cr.endLine}:
"${cr.content}"
`).join('\n')}

Please address each of these issues and submit updated changes.
`;
```

---

## Summary

This design provides:
- Clear visualization of what changed
- Easy line-level commenting
- Flexible review workflow (comment/approve/request changes)
- Batched review submission
- Agent-friendly feedback loop

Reference implementation: The screenshot shows a similar UI from a code review tool, which we're adapting for Orchestrator's agent approval workflow.
