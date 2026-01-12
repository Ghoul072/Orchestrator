import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import * as tasksDb from '~/server/db/tasks'
import * as reposDb from '~/server/db/repositories'

// =============================================================================
// SCHEMAS
// =============================================================================

const PushTaskSchema = z.object({
  taskId: z.string().uuid(),
})

const SyncProjectSchema = z.object({
  projectId: z.string().uuid(),
})

const SyncRepositorySchema = z.object({
  repositoryId: z.string().uuid(),
})

const UpdateRepositorySyncSchema = z.object({
  repositoryId: z.string().uuid(),
  enabled: z.boolean(),
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

function getGitHubToken(): string | null {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null
}

function parseGitHubRepo(url: string): { owner: string; repo: string } | null {
  const patterns = [
    /github\.com[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/,
    /^([^/]+)\/([^/]+)$/, // owner/repo format
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return { owner: match[1], repo: match[2] }
    }
  }

  return null
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

function taskStatusToIssueState(status: string): 'open' | 'closed' {
  return status === 'completed' || status === 'cancelled' ? 'closed' : 'open'
}

function issueStateToTaskStatus(state: 'open' | 'closed'): 'pending' | 'completed' {
  return state === 'closed' ? 'completed' : 'pending'
}

function priorityToLabel(priority: string | null): string | null {
  const map: Record<string, string> = {
    urgent: 'priority: critical',
    high: 'priority: high',
    medium: 'priority: medium',
    low: 'priority: low',
  }
  return priority ? map[priority] || null : null
}

async function resolveRepositoryForTask(task: { projectId: string; repositoryId?: string | null }) {
  if (task.repositoryId) {
    const repository = await reposDb.getRepositoryById(task.repositoryId)
    if (!repository) {
      throw new Error('Repository not found for task')
    }
    return { repository, assigned: false }
  }

  const repositories = await reposDb.getRepositoriesByProject(task.projectId)
  const syncableRepositories = repositories.filter((repo) => repo.githubSyncEnabled)

  if (repositories.length === 1) {
    return { repository: repositories[0]!, assigned: true }
  }

  if (syncableRepositories.length === 1) {
    return { repository: syncableRepositories[0]!, assigned: true }
  }

  throw new Error('Task is not linked to a repository. Please assign one.')
}

async function syncRepositoryIssuesById(repositoryId: string) {
  const repository = await reposDb.getRepositoryById(repositoryId)
  if (!repository) {
    throw new Error('Repository not found')
  }

  if (!repository.githubSyncEnabled) {
    throw new Error('GitHub sync is disabled for this repository')
  }

  const token = getGitHubToken()
  if (!token) {
    throw new Error('GitHub token not configured')
  }

  const parsed = parseGitHubRepo(repository.url)
  if (!parsed) {
    throw new Error('Repository URL is not a valid GitHub URL')
  }

  const { owner, repo } = parsed

  const issues = await githubFetch<GitHubIssue[]>(
    `/repos/${owner}/${repo}/issues?state=all&per_page=100`,
    token
  )

  const existingTasks = await tasksDb.getTasksByProject(repository.projectId, {
    repositoryId: repository.id,
  })

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
    if ('pull_request' in issue) continue

    const existingTask = tasksByIssueId.get(issue.number)
    if (existingTask) {
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
      await tasksDb.createTask({
        projectId: repository.projectId,
        repositoryId: repository.id,
        title: issue.title,
        description: issue.body || '',
        status: issueStateToTaskStatus(issue.state),
        githubIssueId: issue.number,
        githubIssueUrl: issue.html_url,
      })
      results.created++
    }
  }

  await reposDb.updateGitHubLastSyncAt(repository.id, new Date())

  return {
    repositoryId: repository.id,
    repositoryName: repository.name,
    ...results,
  }
}

// =============================================================================
// SERVER FUNCTIONS
// =============================================================================

export const getGitHubTokenStatus = createServerFn({ method: 'POST' }).handler(async () => {
  const token = getGitHubToken()
  return {
    available: Boolean(token),
  }
})

export const updateRepositoryGitHubSync = createServerFn({ method: 'POST' })
  .inputValidator(UpdateRepositorySyncSchema)
  .handler(async ({ data }) => {
    const repository = await reposDb.getRepositoryById(data.repositoryId)
    if (!repository) {
      throw new Error('Repository not found')
    }

    if (data.enabled) {
      const token = getGitHubToken()
      if (!token) {
        throw new Error('GitHub token not configured')
      }

      const parsed = parseGitHubRepo(repository.url)
      if (!parsed) {
        throw new Error('Repository URL is not a valid GitHub URL')
      }
    }

    const updated = await reposDb.updateGitHubSync(data.repositoryId, data.enabled)
    if (!updated) {
      throw new Error('Repository not found')
    }

    return updated
  })

export const syncRepositoryIssues = createServerFn({ method: 'POST' })
  .inputValidator(SyncRepositorySchema)
  .handler(async ({ data }) => {
    return syncRepositoryIssuesById(data.repositoryId)
  })

export const syncProjectIssues = createServerFn({ method: 'POST' })
  .inputValidator(SyncProjectSchema)
  .handler(async ({ data }) => {
    const repositories = await reposDb.getRepositoriesByProject(data.projectId)
    const syncable = repositories.filter((repo) => repo.githubSyncEnabled)

    const results = [] as Array<
      | { repositoryId: string; repositoryName: string; created: number; updated: number; unchanged: number }
      | { repositoryId: string; repositoryName: string; error: string }
    >

    for (const repository of syncable) {
      try {
        const repoResult = await syncRepositoryIssuesById(repository.id)
        results.push(repoResult)
      } catch (error) {
        results.push({
          repositoryId: repository.id,
          repositoryName: repository.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const totals = results.reduce(
      (acc, result) => {
        if ('error' in result) return acc
        acc.created += result.created
        acc.updated += result.updated
        acc.unchanged += result.unchanged
        return acc
      },
      { created: 0, updated: 0, unchanged: 0 }
    )

    return {
      repositories: results,
      totals,
    }
  })

export const pushTaskToGitHub = createServerFn({ method: 'POST' })
  .inputValidator(PushTaskSchema)
  .handler(async ({ data }) => {
    const task = await tasksDb.getTaskById(data.taskId)
    if (!task) {
      throw new Error('Task not found')
    }

    const token = getGitHubToken()
    if (!token) {
      throw new Error('GitHub token not configured')
    }

    const { repository, assigned } = await resolveRepositoryForTask({
      projectId: task.projectId,
      repositoryId: task.repositoryId,
    })

    if (!repository.githubSyncEnabled) {
      throw new Error('GitHub sync is disabled for this repository')
    }

    const parsed = parseGitHubRepo(repository.url)
    if (!parsed) {
      throw new Error('Repository URL is not a valid GitHub URL')
    }

    const { owner, repo } = parsed

    let body = task.description || ''
    if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
      body += '\n\n## Acceptance Criteria\n'
      body += task.acceptanceCriteria.map((c: string) => `- [ ] ${c}`).join('\n')
    }

    const labels: string[] = []
    const priorityLabel = priorityToLabel(task.priority)
    if (priorityLabel) labels.push(priorityLabel)

    if (task.githubIssueId) {
      const issue = await githubFetch<GitHubIssue>(
        `/repos/${owner}/${repo}/issues/${task.githubIssueId}`,
        token,
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

    const issue = await githubFetch<GitHubCreateIssueResponse>(
      `/repos/${owner}/${repo}/issues`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          title: task.title,
          body,
          labels,
        }),
      }
    )

    await tasksDb.updateTask(data.taskId, {
      githubIssueId: issue.number,
      githubIssueUrl: issue.html_url,
      ...(assigned ? { repositoryId: repository.id } : {}),
    })

    return { issue, action: 'created' }
  })
