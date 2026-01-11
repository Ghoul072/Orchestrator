import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import * as agentSessionsDb from '~/server/db/agent-sessions'
import * as tasksDb from '~/server/db/tasks'
import * as projectsDb from '~/server/db/projects'

// =============================================================================
// SCHEMAS
// =============================================================================

const SessionIdSchema = z.object({
  id: z.string().uuid(),
})

const TaskIdSchema = z.object({
  taskId: z.string().uuid(),
})

const CreateSessionSchema = z.object({
  taskId: z.string().uuid(),
  maxTurns: z.number().min(1).max(200).optional(),
})

const UpdateSessionStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum([
    'queued',
    'planning',
    'awaiting_approval',
    'executing',
    'paused',
    'completed',
    'failed',
    'timeout',
  ]),
  errorMessage: z.string().optional(),
})

// =============================================================================
// SERVER FUNCTIONS
// =============================================================================

/**
 * Get all agent sessions for a task
 */
export const getSessionsByTask = createServerFn({ method: 'POST' })
  .inputValidator(TaskIdSchema)
  .handler(async ({ data }) => {
    return agentSessionsDb.getSessionsByTask(data.taskId)
  })

/**
 * Get active session for a task
 */
export const getActiveSessionByTask = createServerFn({ method: 'POST' })
  .inputValidator(TaskIdSchema)
  .handler(async ({ data }) => {
    return agentSessionsDb.getActiveSessionByTask(data.taskId)
  })

/**
 * Get a session by ID
 */
export const getSession = createServerFn({ method: 'POST' })
  .inputValidator(SessionIdSchema)
  .handler(async ({ data }) => {
    const session = await agentSessionsDb.getSessionById(data.id)
    if (!session) {
      throw new Error('Session not found')
    }
    return session
  })

/**
 * Create a new agent session for a task
 */
export const createSession = createServerFn({ method: 'POST' })
  .inputValidator(CreateSessionSchema)
  .handler(async ({ data }) => {
    // Check if task exists
    const task = await tasksDb.getTaskById(data.taskId)
    if (!task) {
      throw new Error('Task not found')
    }

    // Check if there's already an active session
    const activeSession = await agentSessionsDb.getActiveSessionByTask(data.taskId)
    if (activeSession) {
      throw new Error('Task already has an active agent session')
    }

    // Create the session
    return agentSessionsDb.createSession({
      taskId: data.taskId,
      status: 'queued',
      maxTurns: data.maxTurns ?? 50,
      currentTurn: 0,
    })
  })

/**
 * Update session status
 */
export const updateSessionStatus = createServerFn({ method: 'POST' })
  .inputValidator(UpdateSessionStatusSchema)
  .handler(async ({ data }) => {
    const session = await agentSessionsDb.updateSessionStatus(
      data.id,
      data.status,
      data.errorMessage
    )

    if (!session) {
      throw new Error('Session not found')
    }

    return session
  })

/**
 * Get task context for agent prompt
 */
export const getTaskContext = createServerFn({ method: 'POST' })
  .inputValidator(TaskIdSchema)
  .handler(async ({ data }) => {
    // Get task with full details
    const task = await tasksDb.getTaskById(data.taskId)
    if (!task) {
      throw new Error('Task not found')
    }

    // Get project for context
    const project = await projectsDb.getProjectById(task.projectId)
    if (!project) {
      throw new Error('Project not found')
    }

    // Get subtasks
    const subtasks = await tasksDb.getSubtasks(data.taskId)

    // Build context prompt
    const contextParts: string[] = []

    // Project context
    contextParts.push(`# Project: ${project.name}`)
    if (project.description) {
      contextParts.push(`\n${project.description}`)
    }
    if (project.agentContext) {
      contextParts.push(`\n## Project Instructions\n${project.agentContext}`)
    }

    // Task details
    contextParts.push(`\n\n# Current Task: ${task.title}`)
    contextParts.push(`\nStatus: ${task.status}`)
    contextParts.push(`Priority: ${task.priority}`)
    if (task.effort) {
      contextParts.push(`Effort: ${task.effort}`)
    }

    if (task.description) {
      contextParts.push(`\n## Description\n${task.description}`)
    }

    // Acceptance criteria
    if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
      contextParts.push(`\n## Acceptance Criteria`)
      task.acceptanceCriteria.forEach((criterion, i) => {
        contextParts.push(`${i + 1}. ${criterion}`)
      })
    }

    // Subtasks
    if (subtasks.length > 0) {
      contextParts.push(`\n## Subtasks`)
      subtasks.forEach((subtask) => {
        const statusIcon =
          subtask.status === 'completed'
            ? '[x]'
            : subtask.status === 'in_progress'
              ? '[~]'
              : '[ ]'
        contextParts.push(`- ${statusIcon} ${subtask.title}`)
      })
    }

    // Instructions
    contextParts.push(`\n\n# Instructions`)
    contextParts.push(`You are working on this task. Your goal is to complete all acceptance criteria.`)
    contextParts.push(`- Read and understand the codebase before making changes`)
    contextParts.push(`- Make small, focused commits`)
    contextParts.push(`- Write tests for new functionality`)
    contextParts.push(`- Update the task status when you complete it`)

    return {
      task,
      project,
      subtasks,
      contextPrompt: contextParts.join('\n'),
    }
  })

/**
 * Delete an agent session
 */
export const deleteSession = createServerFn({ method: 'POST' })
  .inputValidator(SessionIdSchema)
  .handler(async ({ data }) => {
    const deleted = await agentSessionsDb.deleteSession(data.id)
    if (!deleted) {
      throw new Error('Session not found')
    }
    return { success: true }
  })

/**
 * Get all active sessions
 */
export const getActiveSessions = createServerFn({ method: 'POST' })
  .handler(async () => {
    return agentSessionsDb.getActiveSessions()
  })
