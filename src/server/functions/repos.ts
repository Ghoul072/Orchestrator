import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import * as reposDb from '~/server/db/repositories'

// =============================================================================
// SCHEMAS
// =============================================================================

const RepoIdSchema = z.object({
  id: z.string().uuid(),
})

const ProjectIdSchema = z.object({
  projectId: z.string().uuid(),
})

const CreateRepoSchema = z.object({
  projectId: z.string().uuid(),
  url: z.string().url(),
  name: z.string().min(1).max(255),
  branch: z.string().max(255).optional(),
})

const UpdateRepoSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  branch: z.string().max(255).optional(),
})

const UpdateCloneStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'cloning', 'cloned', 'failed']),
  localPath: z.string().optional(),
})

const UpdateStackSchema = z.object({
  id: z.string().uuid(),
  stack: z.array(z.string()),
  dependencies: z.array(z.string()),
})

// =============================================================================
// SERVER FUNCTIONS
// =============================================================================

/**
 * Get repositories for a project
 */
export const getRepositories = createServerFn({ method: 'POST' })
  .inputValidator(ProjectIdSchema)
  .handler(async ({ data }) => {
    return reposDb.getRepositoriesByProject(data.projectId)
  })

/**
 * Get a single repository
 */
export const getRepository = createServerFn({ method: 'POST' })
  .inputValidator(RepoIdSchema)
  .handler(async ({ data }) => {
    const repo = await reposDb.getRepositoryById(data.id)
    if (!repo) {
      throw new Error('Repository not found')
    }
    return repo
  })

/**
 * Create a new repository
 */
export const createRepository = createServerFn({ method: 'POST' })
  .inputValidator(CreateRepoSchema)
  .handler(async ({ data }) => {
    // Check if repository with same URL already exists in project
    const existing = await reposDb.getRepositoryByUrl(data.projectId, data.url)
    if (existing) {
      throw new Error('Repository with this URL already exists in the project')
    }

    return reposDb.createRepository({
      projectId: data.projectId,
      url: data.url,
      name: data.name,
      branch: data.branch ?? 'main',
    })
  })

/**
 * Update a repository
 */
export const updateRepository = createServerFn({ method: 'POST' })
  .inputValidator(UpdateRepoSchema)
  .handler(async ({ data }) => {
    const repo = await reposDb.updateRepository(data.id, {
      name: data.name,
      branch: data.branch,
    })

    if (!repo) {
      throw new Error('Repository not found')
    }

    return repo
  })

/**
 * Delete a repository
 */
export const deleteRepository = createServerFn({ method: 'POST' })
  .inputValidator(RepoIdSchema)
  .handler(async ({ data }) => {
    const deleted = await reposDb.deleteRepository(data.id)
    if (!deleted) {
      throw new Error('Repository not found')
    }
    return { success: true }
  })

/**
 * Update clone status
 */
export const updateCloneStatus = createServerFn({ method: 'POST' })
  .inputValidator(UpdateCloneStatusSchema)
  .handler(async ({ data }) => {
    const repo = await reposDb.updateCloneStatus(data.id, data.status, data.localPath)
    if (!repo) {
      throw new Error('Repository not found')
    }
    return repo
  })

/**
 * Update detected stack information
 */
export const updateStackInfo = createServerFn({ method: 'POST' })
  .inputValidator(UpdateStackSchema)
  .handler(async ({ data }) => {
    const repo = await reposDb.updateStackInfo(data.id, data.stack, data.dependencies)
    if (!repo) {
      throw new Error('Repository not found')
    }
    return repo
  })

/**
 * Clear local path (after cleanup)
 */
export const clearLocalPath = createServerFn({ method: 'POST' })
  .inputValidator(RepoIdSchema)
  .handler(async ({ data }) => {
    const repo = await reposDb.clearLocalPath(data.id)
    if (!repo) {
      throw new Error('Repository not found')
    }
    return repo
  })

/**
 * Parse GitHub URL to extract owner and repo name
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  // Match GitHub URLs in various formats
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
