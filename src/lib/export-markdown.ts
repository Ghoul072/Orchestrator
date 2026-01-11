// Simple interfaces for export (not extending schema types to avoid strict typing issues)
interface ExportableTask {
  title: string
  status?: string
  priority?: string
  description?: string | null
  acceptanceCriteria?: string[] | null
  effort?: string | null
  assignee?: string | null
  dueDate?: Date | string | null
  subtasks?: ExportableTask[]
}

interface ExportableProject {
  name: string
  description?: string | null
  agentContext?: string | null
}

interface ExportableSession {
  id: string
  status: string
  currentTurn: number
  maxTurns: number
  startedAt?: Date | string | null
  completedAt?: Date | string | null
  plan?: {
    summary: string
    steps: Array<{ title: string; details: string }>
    files?: Array<{ path: string; action: string }>
  } | null
}

/**
 * Export a single task to markdown
 */
export function taskToMarkdown(task: ExportableTask, includeSubtasks = true): string {
  const lines: string[] = []

  // Title
  lines.push(`# ${task.title}`)
  lines.push('')

  // Status and priority
  const statusEmoji = getStatusEmoji(task.status)
  const priorityLabel = task.priority ? ` | Priority: ${task.priority}` : ''
  lines.push(`**Status:** ${statusEmoji} ${task.status || 'pending'}${priorityLabel}`)

  // Effort and assignee
  if (task.effort || task.assignee) {
    const parts: string[] = []
    if (task.effort) parts.push(`Effort: ${task.effort.toUpperCase()}`)
    if (task.assignee) parts.push(`Assignee: ${task.assignee}`)
    lines.push(`**${parts.join(' | ')}**`)
  }

  // Due date
  if (task.dueDate) {
    const date = typeof task.dueDate === 'string' ? new Date(task.dueDate) : task.dueDate
    lines.push(`**Due:** ${date.toLocaleDateString()}`)
  }

  lines.push('')

  // Description
  if (task.description) {
    lines.push('## Description')
    lines.push('')
    // Strip HTML if present
    const cleanDescription = task.description.replace(/<[^>]*>/g, '')
    lines.push(cleanDescription)
    lines.push('')
  }

  // Acceptance criteria
  if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
    lines.push('## Acceptance Criteria')
    lines.push('')
    task.acceptanceCriteria.forEach((criterion) => {
      lines.push(`- [ ] ${criterion}`)
    })
    lines.push('')
  }

  // Subtasks
  if (includeSubtasks && task.subtasks && task.subtasks.length > 0) {
    lines.push('## Subtasks')
    lines.push('')
    task.subtasks.forEach((subtask) => {
      const checkbox = subtask.status === 'completed' ? '[x]' : '[ ]'
      lines.push(`- ${checkbox} ${subtask.title}`)
    })
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Export multiple tasks as a markdown list
 */
export function tasksToMarkdown(
  tasks: ExportableTask[],
  options: { groupByStatus?: boolean; includeDescriptions?: boolean } = {}
): string {
  const lines: string[] = []
  const { groupByStatus = false, includeDescriptions = false } = options

  if (groupByStatus) {
    const grouped = groupTasksByStatus(tasks)
    const statusOrder = ['in_progress', 'pending', 'blocked', 'completed', 'cancelled']

    for (const status of statusOrder) {
      const statusTasks = grouped[status]
      if (!statusTasks || statusTasks.length === 0) continue

      lines.push(`## ${getStatusLabel(status)} (${statusTasks.length})`)
      lines.push('')

      for (const task of statusTasks) {
        lines.push(formatTaskListItem(task, includeDescriptions))
      }
      lines.push('')
    }
  } else {
    for (const task of tasks) {
      lines.push(formatTaskListItem(task, includeDescriptions))
    }
  }

  return lines.join('\n')
}

/**
 * Export a project overview to markdown
 */
export function projectToMarkdown(
  project: ExportableProject,
  tasks?: ExportableTask[]
): string {
  const lines: string[] = []

  // Header
  lines.push(`# ${project.name}`)
  lines.push('')

  // Description
  if (project.description) {
    lines.push(project.description)
    lines.push('')
  }

  // Agent context
  if (project.agentContext) {
    lines.push('## Agent Context')
    lines.push('')
    lines.push(project.agentContext)
    lines.push('')
  }

  // Tasks
  if (tasks && tasks.length > 0) {
    lines.push('## Tasks')
    lines.push('')

    // Group by status
    const grouped = groupTasksByStatus(tasks)
    const statusOrder = ['in_progress', 'pending', 'blocked', 'completed', 'cancelled']

    for (const status of statusOrder) {
      const statusTasks = grouped[status]
      if (!statusTasks || statusTasks.length === 0) continue

      lines.push(`### ${getStatusLabel(status)}`)
      lines.push('')

      for (const task of statusTasks) {
        const checkbox = task.status === 'completed' ? '[x]' : '[ ]'
        const priority = task.priority !== 'medium' ? ` [${task.priority}]` : ''
        lines.push(`- ${checkbox} ${task.title}${priority}`)

        // Add subtasks
        if (task.subtasks && task.subtasks.length > 0) {
          for (const subtask of task.subtasks) {
            const subCheckbox = subtask.status === 'completed' ? '[x]' : '[ ]'
            lines.push(`  - ${subCheckbox} ${subtask.title}`)
          }
        }
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

/**
 * Export an agent session to markdown
 */
export function sessionToMarkdown(session: ExportableSession): string {
  const lines: string[] = []

  lines.push('# Agent Session')
  lines.push('')

  // Status info
  lines.push(`**Status:** ${session.status}`)
  lines.push(`**Turns:** ${session.currentTurn} / ${session.maxTurns}`)

  if (session.startedAt) {
    const date = typeof session.startedAt === 'string' ? new Date(session.startedAt) : session.startedAt
    lines.push(`**Started:** ${date.toLocaleString()}`)
  }

  if (session.completedAt) {
    const date = typeof session.completedAt === 'string' ? new Date(session.completedAt) : session.completedAt
    lines.push(`**Completed:** ${date.toLocaleString()}`)
  }

  lines.push('')

  // Execution plan
  if (session.plan) {
    lines.push('## Execution Plan')
    lines.push('')
    lines.push(`> ${session.plan.summary}`)
    lines.push('')

    if (session.plan.steps && session.plan.steps.length > 0) {
      lines.push('### Steps')
      lines.push('')
      session.plan.steps.forEach((step, i) => {
        lines.push(`${i + 1}. **${step.title}**`)
        lines.push(`   ${step.details}`)
        lines.push('')
      })
    }

    if (session.plan.files && session.plan.files.length > 0) {
      lines.push('### Files')
      lines.push('')
      session.plan.files.forEach((file) => {
        const action = file.action === 'create' ? '➕' : file.action === 'delete' ? '➖' : '📝'
        lines.push(`- ${action} \`${file.path}\` (${file.action})`)
      })
      lines.push('')
    }
  }

  return lines.join('\n')
}

/**
 * Download markdown content as a file
 */
export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.md') ? filename : `${filename}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Helper functions

function getStatusEmoji(status?: string): string {
  switch (status) {
    case 'completed': return '✅'
    case 'in_progress': return '🔄'
    case 'blocked': return '🚫'
    case 'cancelled': return '❌'
    default: return '⏳'
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'in_progress': return 'In Progress'
    case 'pending': return 'Pending'
    case 'blocked': return 'Blocked'
    case 'completed': return 'Completed'
    case 'cancelled': return 'Cancelled'
    default: return status
  }
}

function formatTaskListItem(task: ExportableTask, includeDescription: boolean): string {
  const checkbox = task.status === 'completed' ? '[x]' : '[ ]'
  const priority = task.priority !== 'medium' ? ` [${task.priority}]` : ''
  let line = `- ${checkbox} **${task.title}**${priority}`

  if (includeDescription && task.description) {
    const cleanDesc = task.description.replace(/<[^>]*>/g, '').slice(0, 100)
    line += `\n  > ${cleanDesc}${task.description.length > 100 ? '...' : ''}`
  }

  return line
}

function groupTasksByStatus(tasks: ExportableTask[]): Record<string, ExportableTask[]> {
  const grouped: Record<string, ExportableTask[]> = {}

  for (const task of tasks) {
    const status = task.status || 'pending'
    if (!grouped[status]) {
      grouped[status] = []
    }
    grouped[status].push(task)
  }

  return grouped
}
