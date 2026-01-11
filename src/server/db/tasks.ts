import { eq, desc, and, sql, isNull } from 'drizzle-orm'
import { db } from './index'
import {
  tasks,
  taskUpdates,
  taskRelations,
  type NewTask,
  type Task,
  type NewTaskUpdate,
  type TaskUpdate,
} from './schema'

// =============================================================================
// TASK CRUD
// =============================================================================

/**
 * Get all tasks for a project
 */
export async function getTasksByProject(
  projectId: string,
  options?: {
    includeArchived?: boolean
    status?: Task['status']
    parentId?: string | null // null = only root tasks
    limit?: number
    offset?: number
  }
): Promise<Task[]> {
  const conditions = [eq(tasks.projectId, projectId)]

  if (!options?.includeArchived) {
    conditions.push(eq(tasks.isArchived, false))
  }

  if (options?.status) {
    conditions.push(eq(tasks.status, options.status))
  }

  if (options?.parentId === null) {
    conditions.push(isNull(tasks.parentId))
  } else if (options?.parentId) {
    conditions.push(eq(tasks.parentId, options.parentId))
  }

  const result = await db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(tasks.sortOrder, desc(tasks.createdAt))
    .limit(options?.limit ?? 1000)
    .offset(options?.offset ?? 0)

  return result
}

/**
 * List tasks with optional filters (across all projects or specific project)
 */
export async function listTasks(options?: {
  projectId?: string
  status?: Task['status']
  priority?: Task['priority']
  includeArchived?: boolean
  limit?: number
  offset?: number
}): Promise<Task[]> {
  const conditions: ReturnType<typeof eq>[] = []

  if (options?.projectId) {
    conditions.push(eq(tasks.projectId, options.projectId))
  }

  if (!options?.includeArchived) {
    conditions.push(eq(tasks.isArchived, false))
  }

  if (options?.status) {
    conditions.push(eq(tasks.status, options.status))
  }

  if (options?.priority) {
    conditions.push(eq(tasks.priority, options.priority))
  }

  const result = await db
    .select()
    .from(tasks)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(tasks.createdAt))
    .limit(options?.limit ?? 1000)
    .offset(options?.offset ?? 0)

  return result
}

/**
 * Get subtasks for a parent task
 */
export async function getSubtasks(
  parentId: string,
  options?: { includeArchived?: boolean }
): Promise<Task[]> {
  const conditions = [eq(tasks.parentId, parentId)]

  if (!options?.includeArchived) {
    conditions.push(eq(tasks.isArchived, false))
  }

  const result = await db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(tasks.sortOrder)

  return result
}

/**
 * Get a single task by ID
 */
export async function getTaskById(id: string): Promise<Task | null> {
  const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1)
  return result[0] ?? null
}

/**
 * Get a task with its subtasks
 */
export async function getTaskWithSubtasks(id: string) {
  const task = await getTaskById(id)
  if (!task) return null

  const subtasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.parentId, id), eq(tasks.isArchived, false)))
    .orderBy(tasks.sortOrder)

  return {
    ...task,
    subtasks,
  }
}

/**
 * Create a new task
 */
export async function createTask(data: NewTask): Promise<Task> {
  // Get the max sort order for this parent/project
  const maxSortResult = await db
    .select({ maxSort: sql<number>`COALESCE(MAX(sort_order), -1)` })
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, data.projectId),
        data.parentId ? eq(tasks.parentId, data.parentId) : isNull(tasks.parentId)
      )
    )

  const sortOrder = (maxSortResult[0]?.maxSort ?? -1) + 1

  const result = await db
    .insert(tasks)
    .values({ ...data, sortOrder })
    .returning()

  return result[0]!
}

/**
 * Update a task
 */
export async function updateTask(
  id: string,
  data: Partial<Omit<NewTask, 'id' | 'projectId'>>
): Promise<Task | null> {
  // Handle status transitions
  const updates: Partial<Task> = { ...data, updatedAt: new Date() }

  if (data.status === 'in_progress' && !data.startedAt) {
    updates.startedAt = new Date()
  }

  if (data.status === 'completed' && !data.completedAt) {
    updates.completedAt = new Date()
  }

  const result = await db
    .update(tasks)
    .set(updates)
    .where(eq(tasks.id, id))
    .returning()

  return result[0] ?? null
}

/**
 * Archive a task and its subtasks
 */
export async function archiveTask(id: string): Promise<Task | null> {
  // Archive subtasks first
  await db
    .update(tasks)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(eq(tasks.parentId, id))

  return updateTask(id, { isArchived: true })
}

/**
 * Delete a task (hard delete - cascades to subtasks)
 */
export async function deleteTask(id: string): Promise<boolean> {
  const result = await db.delete(tasks).where(eq(tasks.id, id)).returning()
  return result.length > 0
}

/**
 * Reorder tasks
 */
export async function reorderTasks(
  taskOrders: Array<{ id: string; sortOrder: number }>
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const { id, sortOrder } of taskOrders) {
      await tx
        .update(tasks)
        .set({ sortOrder, updatedAt: new Date() })
        .where(eq(tasks.id, id))
    }
  })
}

/**
 * Move task to different parent
 */
export async function moveTask(
  id: string,
  newParentId: string | null
): Promise<Task | null> {
  return updateTask(id, { parentId: newParentId ?? undefined })
}

// =============================================================================
// TASK UPDATES (Progress Logs)
// =============================================================================

/**
 * Get updates for a task
 */
export async function getTaskUpdates(
  taskId: string,
  options?: { limit?: number; offset?: number }
): Promise<TaskUpdate[]> {
  const result = await db
    .select()
    .from(taskUpdates)
    .where(eq(taskUpdates.taskId, taskId))
    .orderBy(desc(taskUpdates.createdAt))
    .limit(options?.limit ?? 50)
    .offset(options?.offset ?? 0)

  return result
}

/**
 * Add an update to a task
 */
export async function addTaskUpdate(data: NewTaskUpdate): Promise<TaskUpdate> {
  const result = await db.insert(taskUpdates).values(data).returning()
  return result[0]!
}

// =============================================================================
// TASK RELATIONS (Dependencies)
// =============================================================================

/**
 * Get all relations for a task (both source and target)
 */
export async function getTaskRelations(taskId: string) {
  const sourceRelations = await db
    .select()
    .from(taskRelations)
    .where(eq(taskRelations.sourceTaskId, taskId))

  const targetRelations = await db
    .select()
    .from(taskRelations)
    .where(eq(taskRelations.targetTaskId, taskId))

  return {
    outgoing: sourceRelations,
    incoming: targetRelations,
  }
}

/**
 * Add a relation between tasks
 */
export async function addTaskRelation(
  sourceTaskId: string,
  targetTaskId: string,
  relationType: 'blocks' | 'blocked_by' | 'relates_to' | 'duplicates'
): Promise<void> {
  // Prevent circular dependencies
  if (sourceTaskId === targetTaskId) {
    throw new Error('Cannot create a relation to the same task')
  }

  await db
    .insert(taskRelations)
    .values({ sourceTaskId, targetTaskId, relationType })
    .onConflictDoNothing()
}

/**
 * Remove a relation between tasks
 */
export async function removeTaskRelation(relationId: string): Promise<void> {
  await db.delete(taskRelations).where(eq(taskRelations.id, relationId))
}

/**
 * Check if a task has any blockers that are not completed
 */
export async function hasUnresolvedBlockers(taskId: string): Promise<boolean> {
  const blockers = await db
    .select({ id: tasks.id })
    .from(taskRelations)
    .innerJoin(tasks, eq(taskRelations.sourceTaskId, tasks.id))
    .where(
      and(
        eq(taskRelations.targetTaskId, taskId),
        eq(taskRelations.relationType, 'blocked_by'),
        sql`${tasks.status} != 'completed'`
      )
    )
    .limit(1)

  return blockers.length > 0
}

/**
 * Get tasks that would be unblocked if this task is completed
 */
export async function getTasksToUnblock(taskId: string): Promise<Task[]> {
  const result = await db
    .select({
      task: tasks,
    })
    .from(taskRelations)
    .innerJoin(tasks, eq(taskRelations.targetTaskId, tasks.id))
    .where(
      and(
        eq(taskRelations.sourceTaskId, taskId),
        eq(taskRelations.relationType, 'blocks')
      )
    )

  return result.map((r) => r.task)
}
