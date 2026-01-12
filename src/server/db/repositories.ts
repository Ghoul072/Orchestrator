import { eq, and, desc } from 'drizzle-orm'
import { db } from '~/server/db'
import { repositories, type NewRepository, type Repository } from '~/server/db/schema'

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

/**
 * Get all repositories for a project
 */
export async function getRepositoriesByProject(projectId: string): Promise<Repository[]> {
  return db
    .select()
    .from(repositories)
    .where(eq(repositories.projectId, projectId))
    .orderBy(desc(repositories.createdAt))
}

/**
 * Get a repository by ID
 */
export async function getRepositoryById(id: string): Promise<Repository | undefined> {
  const [result] = await db
    .select()
    .from(repositories)
    .where(eq(repositories.id, id))
    .limit(1)
  return result
}

/**
 * Get a repository by URL within a project
 */
export async function getRepositoryByUrl(
  projectId: string,
  url: string
): Promise<Repository | undefined> {
  const [result] = await db
    .select()
    .from(repositories)
    .where(and(eq(repositories.projectId, projectId), eq(repositories.url, url)))
    .limit(1)
  return result
}

// =============================================================================
// MUTATION FUNCTIONS
// =============================================================================

/**
 * Create a new repository
 */
export async function createRepository(data: NewRepository): Promise<Repository> {
  const [result] = await db.insert(repositories).values(data).returning()
  return result!
}

/**
 * Update a repository
 */
export async function updateRepository(
  id: string,
  data: Partial<Omit<Repository, 'id' | 'projectId' | 'createdAt'>>
): Promise<Repository | undefined> {
  const [result] = await db
    .update(repositories)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(repositories.id, id))
    .returning()
  return result
}

/**
 * Update clone status
 */
export async function updateCloneStatus(
  id: string,
  status: 'pending' | 'cloning' | 'cloned' | 'analyzing' | 'ready' | 'failed' | 'cleaned',
  localPath?: string
): Promise<Repository | undefined> {
  const updateData: Partial<Repository> = {
    cloneStatus: status,
    updatedAt: new Date(),
  }

  if (status === 'cloned' || status === 'ready') {
    updateData.lastClonedAt = new Date()
    if (localPath) {
      updateData.localPath = localPath
    }
  }

  if (status === 'cleaned') {
    updateData.localPath = null
  }

  const [result] = await db
    .update(repositories)
    .set(updateData)
    .where(eq(repositories.id, id))
    .returning()
  return result
}

/**
 * Update detected stack and dependencies
 */
export async function updateStackInfo(
  id: string,
  stack: string[],
  dependencies: string[]
): Promise<Repository | undefined> {
  const [result] = await db
    .update(repositories)
    .set({
      stack,
      dependencies,
      updatedAt: new Date(),
    })
    .where(eq(repositories.id, id))
    .returning()
  return result
}

/**
 * Update GitHub sync settings for a repository
 */
export async function updateGitHubSync(
  id: string,
  enabled: boolean
): Promise<Repository | undefined> {
  const [result] = await db
    .update(repositories)
    .set({
      githubSyncEnabled: enabled,
      updatedAt: new Date(),
    })
    .where(eq(repositories.id, id))
    .returning()
  return result
}

/**
 * Update GitHub last sync timestamp for a repository
 */
export async function updateGitHubLastSyncAt(
  id: string,
  lastSyncAt: Date | null
): Promise<Repository | undefined> {
  const [result] = await db
    .update(repositories)
    .set({
      githubLastSyncAt: lastSyncAt,
      updatedAt: new Date(),
    })
    .where(eq(repositories.id, id))
    .returning()
  return result
}

/**
 * Delete a repository
 */
export async function deleteRepository(id: string): Promise<boolean> {
  const result = await db.delete(repositories).where(eq(repositories.id, id)).returning()
  return result.length > 0
}

/**
 * Clear local path (after cleanup)
 */
export async function clearLocalPath(id: string): Promise<Repository | undefined> {
  const [result] = await db
    .update(repositories)
    .set({
      localPath: null,
      updatedAt: new Date(),
    })
    .where(eq(repositories.id, id))
    .returning()
  return result
}
