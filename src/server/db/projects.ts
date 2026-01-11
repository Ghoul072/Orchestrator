import { eq, desc, and, sql } from 'drizzle-orm'
import { db } from './index'
import { projects, projectTags, tags, type NewProject, type Project } from './schema'

/**
 * Get all projects with optional filtering
 */
export async function getProjects(options?: {
  includeArchived?: boolean
  limit?: number
  offset?: number
}): Promise<Project[]> {
  const conditions = options?.includeArchived
    ? undefined
    : eq(projects.isArchived, false)

  const result = await db
    .select()
    .from(projects)
    .where(conditions)
    .orderBy(desc(projects.createdAt))
    .limit(options?.limit ?? 100)
    .offset(options?.offset ?? 0)

  return result
}

/**
 * Get a single project by ID
 */
export async function getProjectById(id: string): Promise<Project | null> {
  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1)
  return result[0] ?? null
}

/**
 * Get a project with its tags
 */
export async function getProjectWithTags(id: string) {
  const project = await getProjectById(id)
  if (!project) return null

  const projectTagsResult = await db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
    })
    .from(projectTags)
    .innerJoin(tags, eq(projectTags.tagId, tags.id))
    .where(eq(projectTags.projectId, id))

  return {
    ...project,
    tags: projectTagsResult,
  }
}

/**
 * Create a new project
 */
export async function createProject(data: NewProject): Promise<Project> {
  const result = await db.insert(projects).values(data).returning()
  return result[0]!
}

/**
 * Update a project
 */
export async function updateProject(
  id: string,
  data: Partial<Omit<NewProject, 'id'>>
): Promise<Project | null> {
  const result = await db
    .update(projects)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning()
  return result[0] ?? null
}

/**
 * Archive a project (soft delete)
 */
export async function archiveProject(id: string): Promise<Project | null> {
  return updateProject(id, { isArchived: true })
}

/**
 * Restore an archived project
 */
export async function restoreProject(id: string): Promise<Project | null> {
  return updateProject(id, { isArchived: false })
}

/**
 * Delete a project (hard delete)
 */
export async function deleteProject(id: string): Promise<boolean> {
  const result = await db.delete(projects).where(eq(projects.id, id)).returning()
  return result.length > 0
}

/**
 * Add a tag to a project
 */
export async function addTagToProject(projectId: string, tagId: string): Promise<void> {
  await db
    .insert(projectTags)
    .values({ projectId, tagId })
    .onConflictDoNothing()
}

/**
 * Remove a tag from a project
 */
export async function removeTagFromProject(
  projectId: string,
  tagId: string
): Promise<void> {
  await db
    .delete(projectTags)
    .where(and(eq(projectTags.projectId, projectId), eq(projectTags.tagId, tagId)))
}

/**
 * Get project statistics
 */
export async function getProjectStats(projectId: string) {
  const result = await db.execute(sql`
    SELECT
      COUNT(*)::int as total_tasks,
      COUNT(*) FILTER (WHERE status = 'completed')::int as completed_tasks,
      COUNT(*) FILTER (WHERE status = 'in_progress')::int as in_progress_tasks,
      COUNT(*) FILTER (WHERE status = 'pending')::int as pending_tasks,
      COUNT(*) FILTER (WHERE status = 'blocked')::int as blocked_tasks
    FROM tasks
    WHERE project_id = ${projectId} AND is_archived = false
  `)

  const row = result[0] as {
    total_tasks: number
    completed_tasks: number
    in_progress_tasks: number
    pending_tasks: number
    blocked_tasks: number
  } | undefined

  return row
}
