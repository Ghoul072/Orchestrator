import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import * as projectsDb from '~/server/db/projects'
import * as tasksDb from '~/server/db/tasks'

// =============================================================================
// SCHEMAS
// =============================================================================

const GitHubSettingsSchema = z.object({
  projectId: z.string().uuid(),
  githubRepo: z.string().regex(/^[^/]+\/[^/]+$/, 'Must be in format owner/repo'),
  githubToken: z.string().min(1, 'GitHub token is required'),
  githubSyncEnabled: z.boolean(),
})

const PushTaskSchema = z.object({
  taskId: z.string().uuid(),
})

const SyncProjectSchema = z.object({
  projectId: z.string().uuid(),
})

// =============================================================================
// GITHUB API HELPERS
// =============================================================================

interface GitHubIssue {
  id: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  html_url: string
  labels: Array<{ name: string }>
  created_at: string
  updated_at: string
}

interface GitHubCreateIssueResponse {
  id: number
  number: number
  html_url: string
}

async function githubFetch<T>(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`GitHub API error: ${response.status} - ${error}`)
  }

  return response.json() as Promise<T>
}

// Map task status to GitHub issue state
function taskStatusToIssueState(status: string): 'open' | 'closed' {
  return status === 'completed' || status === 'cancelled' ? 'closed' : 'open'
}

// Map GitHub issue state to task status
function issueStateToTaskStatus(state: 'open' | 'closed'): 'pending' | 'completed' {
  return state === 'closed' ? 'completed' : 'pending'
}

// Map task priority to GitHub labels
function priorityToLabel(priority: string | null): string | null {
  const map: Record<string, string> = {
    urgent: 'priority: critical',
    high: 'priority: high',
    medium: 'priority: medium',
    low: 'priority: low',
  }
  return priority ? map[priority] || null : null
}

// =============================================================================
// SERVER FUNCTIONS
// =============================================================================

/**
 * Update GitHub settings for a project
 */
export const updateGitHubSettings = createServerFn({ method: 'POST' })
  .inputValidator(GitHubSettingsSchema)
  .handler(async ({ data }) => {
    // Validate the token by making a test API call
    const [owner, repo] = data.githubRepo.split('/')
    try {
      await githubFetch(`/repos/${owner}/${repo}`, data.githubToken)
    } catch {
      throw new Error('Invalid GitHub token or repository. Please check your credentials.')
    }

    // Update project settings
    const project = await projectsDb.updateProject(data.projectId, {
      githubRepo: data.githubRepo,
      githubToken: data.githubToken,
      githubSyncEnabled: data.githubSyncEnabled,
    })

    return { success: true, project }
  })

/**
 * Push a task to GitHub as an issue
 */
export const pushTaskToGitHub = createServerFn({ method: 'POST' })
  .inputValidator(PushTaskSchema)
  .handler(async ({ data }) => {
    const task = await tasksDb.getTaskById(data.taskId)
    if (!task) {
      throw new Error('Task not found')
    }

    const project = await projectsDb.getProjectById(task.projectId)
    if (!project) {
      throw new Error('Project not found')
    }

    if (!project.githubRepo || !project.githubToken) {
      throw new Error('GitHub is not configured for this project')
    }

    const [owner, repo] = project.githubRepo.split('/')

    // Build issue body
    let body = task.description || ''
    if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
      body += '\n\n## Acceptance Criteria\n'
      body += task.acceptanceCriteria.map((c: string) => `- [ ] ${c}`).join('\n')
    }

    // Build labels
    const labels: string[] = []
    const priorityLabel = priorityToLabel(task.priority)
    if (priorityLabel) labels.push(priorityLabel)

    // Check if issue already exists
    if (task.githubIssueId) {
      // Update existing issue
      const issue = await githubFetch<GitHubIssue>(
        `/repos/${owner}/${repo}/issues/${task.githubIssueId}`,
        project.githubToken,
        {
          method: 'PATCH',
          body: JSON.stringify({
            title: task.title,
            body,
            state: taskStatusToIssueState(task.status),
            labels,
          }),
        }
      )

      return { issue, action: 'updated' }
    }

    // Create new issue
    const issue = await githubFetch<GitHubCreateIssueResponse>(
      `/repos/${owner}/${repo}/issues`,
      project.githubToken,
      {
        method: 'POST',
        body: JSON.stringify({
          title: task.title,
          body,
          labels,
        }),
      }
    )

    // Update task with GitHub issue info
    await tasksDb.updateTask(data.taskId, {
      githubIssueId: issue.number,
      githubIssueUrl: issue.html_url,
    })

    return { issue, action: 'created' }
  })

/**
 * Sync tasks from GitHub issues
 */
export const syncFromGitHub = createServerFn({ method: 'POST' })
  .inputValidator(SyncProjectSchema)
  .handler(async ({ data }) => {
    const project = await projectsDb.getProjectById(data.projectId)
    if (!project) {
      throw new Error('Project not found')
    }

    if (!project.githubRepo || !project.githubToken) {
      throw new Error('GitHub is not configured for this project')
    }

    const [owner, repo] = project.githubRepo.split('/')

    // Fetch all open issues
    const issues = await githubFetch<GitHubIssue[]>(
      `/repos/${owner}/${repo}/issues?state=all&per_page=100`,
      project.githubToken
    )

    // Get existing tasks for this project
    const existingTasks = await tasksDb.getTasksByProject(data.projectId)
    const tasksByIssueId = new Map(
      existingTasks
        .filter((t) => t.githubIssueId)
        .map((t) => [t.githubIssueId, t])
    )

    const results = {
      created: 0,
      updated: 0,
      unchanged: 0,
    }

    for (const issue of issues) {
      // Skip pull requests (they also appear in issues endpoint)
      if ('pull_request' in issue) continue

      const existingTask = tasksByIssueId.get(issue.number)

      if (existingTask) {
        // Check if update needed
        const newStatus = issueStateToTaskStatus(issue.state)
        if (
          existingTask.title !== issue.title ||
          existingTask.description !== (issue.body || '') ||
          existingTask.status !== newStatus
        ) {
          await tasksDb.updateTask(existingTask.id, {
            title: issue.title,
            description: issue.body || '',
            status: newStatus,
          })
          results.updated++
        } else {
          results.unchanged++
        }
      } else {
        // Create new task from issue
        await tasksDb.createTask({
          projectId: data.projectId,
          title: issue.title,
          description: issue.body || '',
          status: issueStateToTaskStatus(issue.state),
          githubIssueId: issue.number,
          githubIssueUrl: issue.html_url,
        })
        results.created++
      }
    }

    // Update last sync timestamp
    await projectsDb.updateProject(data.projectId, {
      githubLastSyncAt: new Date(),
    })

    return results
  })

/**
 * Get GitHub connection status for a project
 */
export const getGitHubStatus = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ projectId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const project = await projectsDb.getProjectById(data.projectId)
    if (!project) {
      throw new Error('Project not found')
    }

    if (!project.githubRepo || !project.githubToken) {
      return {
        connected: false,
        repo: null,
        syncEnabled: false,
        lastSyncAt: null,
      }
    }

    // Test connection
    const [owner, repo] = project.githubRepo.split('/')
    let repoInfo = null
    try {
      repoInfo = await githubFetch<{ full_name: string; html_url: string }>(
        `/repos/${owner}/${repo}`,
        project.githubToken
      )
    } catch {
      return {
        connected: false,
        repo: project.githubRepo,
        syncEnabled: project.githubSyncEnabled,
        lastSyncAt: project.githubLastSyncAt,
        error: 'Connection failed',
      }
    }

    return {
      connected: true,
      repo: repoInfo.full_name,
      repoUrl: repoInfo.html_url,
      syncEnabled: project.githubSyncEnabled,
      lastSyncAt: project.githubLastSyncAt,
    }
  })

/**
 * Disconnect GitHub from a project
 */
export const disconnectGitHub = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ projectId: z.string().uuid() }))
  .handler(async ({ data }) => {
    await projectsDb.updateProject(data.projectId, {
      githubRepo: null,
      githubToken: null,
      githubSyncEnabled: false,
      githubLastSyncAt: null,
    })

    return { success: true }
  })
