import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import * as tasksDb from '~/server/db/tasks'
import * as reposDb from '~/server/db/repositories'

// =============================================================================
// SCHEMAS
// =============================================================================

const TaskStatusSchema = z.enum(['pending', 'in_progress', 'blocked', 'completed', 'cancelled'])
const TaskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent'])
const TaskEffortSchema = z.enum(['xs', 'sm', 'md', 'lg', 'xl'])
const TaskRelationTypeSchema = z.enum(['blocks', 'blocked_by', 'relates_to', 'duplicates'])
const TaskUpdateTypeSchema = z.enum(['progress', 'blocker', 'question', 'completion'])

const CreateTaskSchema = z.object({
  projectId: z.string().uuid(),
  repositoryId: z.string().uuid().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: TaskStatusSchema.optional(),
  priority: TaskPrioritySchema.optional(),
  effort: TaskEffortSchema.optional(),
  assignee: z.string().optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  dueDate: z.string().optional(), // ISO date string
})

const UpdateTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: TaskStatusSchema.optional(),
  priority: TaskPrioritySchema.optional(),
  effort: TaskEffortSchema.optional(),
  assignee: z.string().optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  dueDate: z.string().nullable().optional(),
  isArchived: z.boolean().optional(),
  autoStartWhenUnblocked: z.boolean().optional(),
  repositoryId: z.string().uuid().nullable().optional(),
})

const TaskIdSchema = z.object({
  id: z.string().uuid(),
})

const GetTasksSchema = z.object({
  projectId: z.string().uuid(),
  includeArchived: z.boolean().optional(),
  status: TaskStatusSchema.optional(),
  repositoryId: z.string().uuid().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  offset: z.number().int().min(0).optional(),
})

const AddTaskUpdateSchema = z.object({
  taskId: z.string().uuid(),
  content: z.string().min(1),
  updateType: TaskUpdateTypeSchema.optional(),
  author: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

const TaskRelationSchema = z.object({
  sourceTaskId: z.string().uuid(),
  targetTaskId: z.string().uuid(),
  relationType: TaskRelationTypeSchema,
})

const ReorderTasksSchema = z.object({
  taskOrders: z.array(
    z.object({
      id: z.string().uuid(),
      sortOrder: z.number().int().min(0),
    })
  ),
})

const MoveTaskSchema = z.object({
  id: z.string().uuid(),
  newParentId: z.string().uuid().nullable(),
})

// =============================================================================
// SERVER FUNCTIONS
// =============================================================================

/**
 * Get tasks for a project
 */
export const getTasks = createServerFn({ method: 'POST' })
  .inputValidator(GetTasksSchema)
  .handler(async ({ data }) => {
    return tasksDb.getTasksByProject(data.projectId, {
      includeArchived: data.includeArchived,
      status: data.status,
      repositoryId: data.repositoryId,
      parentId: data.parentId,
      limit: data.limit,
      offset: data.offset,
    })
  })

/**
 * Get a single task
 */
export const getTask = createServerFn({ method: 'POST' })
  .inputValidator(TaskIdSchema)
  .handler(async ({ data }) => {
    const task = await tasksDb.getTaskById(data.id)
    if (!task) {
      throw new Error('Task not found')
    }
    return task
  })

/**
 * Get a task with its subtasks
 */
export const getTaskWithSubtasks = createServerFn({ method: 'POST' })
  .inputValidator(TaskIdSchema)
  .handler(async ({ data }) => {
    const task = await tasksDb.getTaskWithSubtasks(data.id)
    if (!task) {
      throw new Error('Task not found')
    }
    return task
  })

/**
 * Create a new task
 */
export const createTask = createServerFn({ method: 'POST' })
  .inputValidator(CreateTaskSchema)
  .handler(async ({ data }) => {
    let repositoryId = data.repositoryId
    if (repositoryId === undefined) {
      const repositories = await reposDb.getRepositoriesByProject(data.projectId)
      if (repositories.length === 1) {
        repositoryId = repositories[0]?.id ?? null
      }
    }

    const taskData: Parameters<typeof tasksDb.createTask>[0] = {
      projectId: data.projectId,
      repositoryId: repositoryId ?? null,
      parentId: data.parentId ?? undefined,
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      effort: data.effort,
      assignee: data.assignee,
      acceptanceCriteria: data.acceptanceCriteria,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    }
    return tasksDb.createTask(taskData)
  })

/**
 * Update a task
 */
export const updateTask = createServerFn({ method: 'POST' })
  .inputValidator(UpdateTaskSchema)
  .handler(async ({ data }) => {
    const { id, dueDate, ...rest } = data

    // Check for blockers before allowing status change to in_progress
    if (rest.status === 'in_progress') {
      const hasBlockers = await tasksDb.hasUnresolvedBlockers(id)
      if (hasBlockers) {
        throw new Error('Cannot start task: there are unresolved blockers')
      }
    }

    const updateData: Parameters<typeof tasksDb.updateTask>[1] = {
      ...rest,
      dueDate: dueDate === null ? undefined : dueDate ? new Date(dueDate) : undefined,
    }

    const task = await tasksDb.updateTask(id, updateData)
    if (!task) {
      throw new Error('Task not found')
    }

    // If task was completed, check for tasks to auto-start
    if (rest.status === 'completed') {
      const tasksToUnblock = await tasksDb.getTasksToUnblock(id)
      for (const unblockedTask of tasksToUnblock) {
        if (unblockedTask.autoStartWhenUnblocked) {
          const stillHasBlockers = await tasksDb.hasUnresolvedBlockers(unblockedTask.id)
          if (!stillHasBlockers) {
            await tasksDb.updateTask(unblockedTask.id, { status: 'in_progress' })
          }
        }
      }
    }

    return task
  })

/**
 * Archive a task
 */
export const archiveTask = createServerFn({ method: 'POST' })
  .inputValidator(TaskIdSchema)
  .handler(async ({ data }) => {
    const task = await tasksDb.archiveTask(data.id)
    if (!task) {
      throw new Error('Task not found')
    }
    return task
  })

/**
 * Delete a task
 */
export const deleteTask = createServerFn({ method: 'POST' })
  .inputValidator(TaskIdSchema)
  .handler(async ({ data }) => {
    const deleted = await tasksDb.deleteTask(data.id)
    if (!deleted) {
      throw new Error('Task not found')
    }
    return { success: true }
  })

/**
 * Reorder tasks
 */
export const reorderTasks = createServerFn({ method: 'POST' })
  .inputValidator(ReorderTasksSchema)
  .handler(async ({ data }) => {
    await tasksDb.reorderTasks(data.taskOrders)
    return { success: true }
  })

/**
 * Move task to different parent
 */
export const moveTask = createServerFn({ method: 'POST' })
  .inputValidator(MoveTaskSchema)
  .handler(async ({ data }) => {
    const task = await tasksDb.moveTask(data.id, data.newParentId)
    if (!task) {
      throw new Error('Task not found')
    }
    return task
  })

// =============================================================================
// TASK UPDATES
// =============================================================================

/**
 * Get updates for a task
 */
export const getTaskUpdates = createServerFn({ method: 'POST' })
  .inputValidator(TaskIdSchema)
  .handler(async ({ data }) => {
    return tasksDb.getTaskUpdates(data.id)
  })

/**
 * Add an update to a task
 */
export const addTaskUpdate = createServerFn({ method: 'POST' })
  .inputValidator(AddTaskUpdateSchema)
  .handler(async ({ data }) => {
    return tasksDb.addTaskUpdate(data)
  })

// =============================================================================
// TASK RELATIONS
// =============================================================================

/**
 * Get relations for a task
 */
export const getTaskRelations = createServerFn({ method: 'POST' })
  .inputValidator(TaskIdSchema)
  .handler(async ({ data }) => {
    return tasksDb.getTaskRelations(data.id)
  })

/**
 * Add a relation between tasks
 */
export const addTaskRelation = createServerFn({ method: 'POST' })
  .inputValidator(TaskRelationSchema)
  .handler(async ({ data }) => {
    await tasksDb.addTaskRelation(data.sourceTaskId, data.targetTaskId, data.relationType)
    return { success: true }
  })

/**
 * Remove a relation
 */
export const removeTaskRelation = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await tasksDb.removeTaskRelation(data.id)
    return { success: true }
  })

/**
 * Check if task has blockers
 */
export const checkTaskBlockers = createServerFn({ method: 'POST' })
  .inputValidator(TaskIdSchema)
  .handler(async ({ data }) => {
    const hasBlockers = await tasksDb.hasUnresolvedBlockers(data.id)
    return { hasBlockers }
  })
