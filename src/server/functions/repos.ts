import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { existsSync, readFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import * as reposDb from '~/server/db/repositories'

// Directory for cloned repositories
const CLONE_BASE_DIR = join(process.cwd(), '.orchestrator', 'repos')

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
  status: z.enum(['pending', 'cloning', 'cloned', 'analyzing', 'ready', 'failed', 'cleaned']),
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

// =============================================================================
// CLONE & STACK DETECTION
// =============================================================================

/**
 * Detect stack/technologies from cloned repository
 */
function detectStack(repoPath: string): { stack: string[]; dependencies: string[] } {
  const stack: string[] = []
  const dependencies: string[] = []

  // Check package.json for Node.js/JavaScript
  const packageJsonPath = join(repoPath, 'package.json')
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      }

      // Detect frameworks
      if (deps.next) stack.push('Next.js')
      if (deps.react) stack.push('React')
      if (deps.vue) stack.push('Vue')
      if (deps.angular || deps['@angular/core']) stack.push('Angular')
      if (deps.svelte) stack.push('Svelte')
      if (deps['@tanstack/react-start']) stack.push('TanStack Start')
      if (deps.express) stack.push('Express')
      if (deps.fastify) stack.push('Fastify')
      if (deps.hono) stack.push('Hono')
      if (deps.typescript) stack.push('TypeScript')
      if (deps.tailwindcss) stack.push('Tailwind CSS')
      if (deps.prisma || deps['@prisma/client']) stack.push('Prisma')
      if (deps.drizzle || deps['drizzle-orm']) stack.push('Drizzle')

      // Get top dependencies
      dependencies.push(...Object.keys(deps).slice(0, 20))
    } catch {
      // Ignore parse errors
    }
  }

  // Check for Python
  if (existsSync(join(repoPath, 'requirements.txt')) || existsSync(join(repoPath, 'setup.py'))) {
    stack.push('Python')
  }
  if (existsSync(join(repoPath, 'pyproject.toml'))) {
    stack.push('Python')
    try {
      const content = readFileSync(join(repoPath, 'pyproject.toml'), 'utf-8')
      if (content.includes('django')) stack.push('Django')
      if (content.includes('fastapi')) stack.push('FastAPI')
      if (content.includes('flask')) stack.push('Flask')
    } catch {
      // Ignore
    }
  }

  // Check for Rust
  if (existsSync(join(repoPath, 'Cargo.toml'))) {
    stack.push('Rust')
  }

  // Check for Go
  if (existsSync(join(repoPath, 'go.mod'))) {
    stack.push('Go')
  }

  // Check for Docker
  if (existsSync(join(repoPath, 'Dockerfile')) || existsSync(join(repoPath, 'docker-compose.yml'))) {
    stack.push('Docker')
  }

  return { stack: [...new Set(stack)], dependencies: [...new Set(dependencies)] }
}

/**
 * Clone a repository and detect its stack
 */
export const cloneRepository = createServerFn({ method: 'POST' })
  .inputValidator(RepoIdSchema)
  .handler(async ({ data }) => {
    const repo = await reposDb.getRepositoryById(data.id)
    if (!repo) {
      throw new Error('Repository not found')
    }

    // Create base directory if it doesn't exist
    if (!existsSync(CLONE_BASE_DIR)) {
      mkdirSync(CLONE_BASE_DIR, { recursive: true })
    }

    // Generate unique local path
    const localPath = join(CLONE_BASE_DIR, `${repo.id}`)

    try {
      // Update status to cloning
      await reposDb.updateCloneStatus(data.id, 'cloning')

      // Remove existing clone if present
      if (existsSync(localPath)) {
        rmSync(localPath, { recursive: true, force: true })
      }

      // Clone repository (shallow clone for speed)
      const branch = repo.branch || 'main'
      execSync(
        `git clone --depth 1 --branch ${branch} ${repo.url} ${localPath}`,
        { timeout: 120000 } // 2 minute timeout
      )

      // Update status to analyzing
      await reposDb.updateCloneStatus(data.id, 'analyzing', localPath)

      // Detect stack and dependencies
      const { stack, dependencies } = detectStack(localPath)
      await reposDb.updateStackInfo(data.id, stack, dependencies)

      // Update status to ready
      await reposDb.updateCloneStatus(data.id, 'ready', localPath)

      return await reposDb.getRepositoryById(data.id)
    } catch (error) {
      // Update status to failed
      await reposDb.updateCloneStatus(data.id, 'failed')
      throw new Error(
        `Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  })

/**
 * Clean up a cloned repository
 */
export const cleanupRepository = createServerFn({ method: 'POST' })
  .inputValidator(RepoIdSchema)
  .handler(async ({ data }) => {
    const repo = await reposDb.getRepositoryById(data.id)
    if (!repo) {
      throw new Error('Repository not found')
    }

    if (repo.localPath && existsSync(repo.localPath)) {
      rmSync(repo.localPath, { recursive: true, force: true })
    }

    await reposDb.updateCloneStatus(data.id, 'cleaned')
    return await reposDb.getRepositoryById(data.id)
  })
