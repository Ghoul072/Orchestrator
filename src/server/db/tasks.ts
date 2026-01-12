import { eq, desc, and, sql, isNull, type SQL } from 'drizzle-orm'
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
    repositoryId?: string | null
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

  if (options?.repositoryId === null) {
    conditions.push(isNull(tasks.repositoryId))
  } else if (options?.repositoryId) {
    conditions.push(eq(tasks.repositoryId, options.repositoryId))
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
  repositoryId?: string | null
  includeArchived?: boolean
  limit?: number
  offset?: number
}): Promise<Task[]> {
  const conditions: SQL[] = []

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

  if (options?.repositoryId === null) {
    conditions.push(isNull(tasks.repositoryId))
  } else if (options?.repositoryId) {
    conditions.push(eq(tasks.repositoryId, options.repositoryId))
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

/**
 * Process unblocking when a task is completed
 * Returns list of tasks that were unblocked (status changed from 'blocked' to 'pending')
 */
export async function processTaskCompletion(completedTaskId: string): Promise<Task[]> {
  const unblocked: Task[] = []

  // Get all tasks that this task was blocking
  const tasksToCheck = await getTasksToUnblock(completedTaskId)

  for (const task of tasksToCheck) {
    // Only process tasks that are currently blocked
    if (task.status !== 'blocked') continue

    // Check if this task has any other unresolved blockers
    const hasOtherBlockers = await hasUnresolvedBlockers(task.id)

    if (!hasOtherBlockers) {
      // No more blockers - unblock the task
      const updated = await updateTask(task.id, { status: 'pending' })
      if (updated) {
        unblocked.push(updated)
      }
    }
  }

  return unblocked
}

/**
 * Check if two tasks have a dependency relationship (direct or transitive)
 */
export async function tasksHaveDependency(taskId1: string, taskId2: string): Promise<boolean> {
  // Check direct dependencies in both directions
  const relations = await db
    .select()
    .from(taskRelations)
    .where(
      and(
        sql`(${taskRelations.sourceTaskId} = ${taskId1} AND ${taskRelations.targetTaskId} = ${taskId2})
           OR (${taskRelations.sourceTaskId} = ${taskId2} AND ${taskRelations.targetTaskId} = ${taskId1})`,
        sql`${taskRelations.relationType} IN ('blocks', 'blocked_by')`
      )
    )

  return relations.length > 0
}

/**
 * Get tasks that can run in parallel (no dependency conflicts)
 * Returns groups of independent tasks
 */
export async function getParallelizableTasks(projectId: string): Promise<Task[][]> {
  // Get all pending or in_progress tasks for the project
  const allTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        eq(tasks.isArchived, false),
        sql`${tasks.status} IN ('pending', 'in_progress')`
      )
    )

  if (allTasks.length === 0) return []

  // Get all dependency relations for these tasks
  const taskIds = allTasks.map((t) => t.id)
  const relations = await db
    .select()
    .from(taskRelations)
    .where(
      and(
        sql`${taskRelations.sourceTaskId} = ANY(${sql.raw(`ARRAY[${taskIds.map(id => `'${id}'`).join(',')}]::uuid[]`)})`,
        sql`${taskRelations.relationType} IN ('blocks', 'blocked_by')`
      )
    )

  // Build adjacency list
  const hasConflict = new Map<string, Set<string>>()
  for (const task of allTasks) {
    hasConflict.set(task.id, new Set())
  }
  for (const rel of relations) {
    hasConflict.get(rel.sourceTaskId)?.add(rel.targetTaskId)
    hasConflict.get(rel.targetTaskId)?.add(rel.sourceTaskId)
  }

  // Group independent tasks using graph coloring approach
  const assigned = new Set<string>()
  const groups: Task[][] = []

  for (const task of allTasks) {
    if (assigned.has(task.id)) continue

    // Start a new group with this task
    const group: Task[] = [task]
    assigned.add(task.id)

    // Add other tasks that don't conflict with any task in this group
    for (const otherTask of allTasks) {
      if (assigned.has(otherTask.id)) continue

      // Check if otherTask conflicts with any task in current group
      const conflicts = group.some((groupTask) =>
        hasConflict.get(otherTask.id)?.has(groupTask.id) ?? false
      )

      if (!conflicts) {
        group.push(otherTask)
        assigned.add(otherTask.id)
      }
    }

    groups.push(group)
  }

  return groups
}

/**
 * Get independent tasks that can be started in parallel
 * Only returns tasks that are ready (pending, no blockers)
 */
export async function getReadyParallelTasks(projectId: string, limit = 3): Promise<Task[]> {
  // Get pending tasks without blockers
  const pendingTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        eq(tasks.isArchived, false),
        eq(tasks.status, 'pending')
      )
    )
    .orderBy(tasks.sortOrder, tasks.createdAt)

  // Filter out tasks with unresolved blockers
  const readyTasks: Task[] = []
  for (const task of pendingTasks) {
    if (readyTasks.length >= limit) break

    const hasBlockers = await hasUnresolvedBlockers(task.id)
    if (!hasBlockers) {
      // Check if this task conflicts with any already selected tasks
      const conflicts = await Promise.all(
        readyTasks.map((t) => tasksHaveDependency(task.id, t.id))
      )
      if (!conflicts.some(Boolean)) {
        readyTasks.push(task)
      }
    }
  }

  return readyTasks
}
