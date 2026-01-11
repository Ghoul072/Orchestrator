import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import * as meetingsDb from '~/server/db/meetings'
import * as tasksDb from '~/server/db/tasks'

// Initialize Anthropic client
const anthropic = new Anthropic()

// =============================================================================
// SCHEMAS
// =============================================================================

const MeetingIdSchema = z.object({
  id: z.string().uuid(),
})

const ProjectIdSchema = z.object({
  projectId: z.string().uuid(),
  status: z.enum(['draft', 'finalized']).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
})

const CreateMeetingSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(255),
  date: z.string(), // ISO date string
  attendees: z.array(z.string()).optional(),
  content: z.string().optional(),
  summary: z.string().optional(),
  status: z.enum(['draft', 'finalized']).optional(),
})

const UpdateMeetingSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255).optional(),
  date: z.string().optional(),
  attendees: z.array(z.string()).optional(),
  content: z.string().optional(),
  summary: z.string().optional(),
  status: z.enum(['draft', 'finalized']).optional(),
})

const LinkTaskSchema = z.object({
  meetingId: z.string().uuid(),
  taskId: z.string().uuid(),
  linkType: z.enum(['created', 'updated']),
  changesSummary: z.string().optional(),
})

// =============================================================================
// SERVER FUNCTIONS
// =============================================================================

/**
 * List meetings for a project
 */
export const listMeetings = createServerFn({ method: 'POST' })
  .inputValidator(ProjectIdSchema)
  .handler(async ({ data }) => {
    return meetingsDb.getMeetingsByProject(data.projectId, {
      status: data.status,
      limit: data.limit,
      offset: data.offset,
    })
  })

/**
 * Get a meeting by ID
 */
export const getMeeting = createServerFn({ method: 'POST' })
  .inputValidator(MeetingIdSchema)
  .handler(async ({ data }) => {
    const meeting = await meetingsDb.getMeetingById(data.id)
    if (!meeting) {
      throw new Error('Meeting not found')
    }
    return meeting
  })

/**
 * Create a new meeting
 */
export const createMeeting = createServerFn({ method: 'POST' })
  .inputValidator(CreateMeetingSchema)
  .handler(async ({ data }) => {
    return meetingsDb.createMeeting({
      projectId: data.projectId,
      title: data.title,
      date: new Date(data.date),
      attendees: data.attendees ?? [],
      content: data.content ?? '',
      summary: data.summary,
      status: data.status ?? 'draft',
    })
  })

/**
 * Update a meeting
 */
export const updateMeeting = createServerFn({ method: 'POST' })
  .inputValidator(UpdateMeetingSchema)
  .handler(async ({ data }) => {
    const meeting = await meetingsDb.updateMeeting(data.id, {
      title: data.title,
      date: data.date ? new Date(data.date) : undefined,
      attendees: data.attendees,
      content: data.content,
      summary: data.summary,
      status: data.status,
    })

    if (!meeting) {
      throw new Error('Meeting not found')
    }

    return meeting
  })

/**
 * Delete a meeting
 */
export const deleteMeeting = createServerFn({ method: 'POST' })
  .inputValidator(MeetingIdSchema)
  .handler(async ({ data }) => {
    const deleted = await meetingsDb.deleteMeeting(data.id)
    if (!deleted) {
      throw new Error('Meeting not found')
    }
    return { success: true }
  })

/**
 * Get task links for a meeting
 */
export const getMeetingTaskLinks = createServerFn({ method: 'POST' })
  .inputValidator(MeetingIdSchema)
  .handler(async ({ data }) => {
    return meetingsDb.getMeetingTaskLinks(data.id)
  })

/**
 * Link a task to a meeting
 */
export const linkTaskToMeeting = createServerFn({ method: 'POST' })
  .inputValidator(LinkTaskSchema)
  .handler(async ({ data }) => {
    return meetingsDb.linkTaskToMeeting(
      data.meetingId,
      data.taskId,
      data.linkType,
      data.changesSummary
    )
  })

// =============================================================================
// AI TASK GENERATION
// =============================================================================

const GenerateTasksSchema = z.object({
  meetingId: z.string().uuid(),
  projectId: z.string().uuid(),
})

interface GeneratedTask {
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  acceptanceCriteria: string[]
}

/**
 * Generate tasks from meeting content using AI
 */
export const generateTasksFromMeeting = createServerFn({ method: 'POST' })
  .inputValidator(GenerateTasksSchema)
  .handler(async ({ data }) => {
    const meeting = await meetingsDb.getMeetingById(data.meetingId)
    if (!meeting) {
      throw new Error('Meeting not found')
    }

    if (meeting.status !== 'finalized') {
      throw new Error('Meeting must be finalized before generating tasks')
    }

    // Strip HTML tags for cleaner content
    const plainContent = meeting.content
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    // Use Claude to analyze meeting content
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Analyze the following meeting notes and extract actionable tasks. For each task, provide a clear title, description, priority (low/medium/high/urgent), and acceptance criteria.

Meeting Title: ${meeting.title}
Date: ${meeting.date}
Attendees: ${meeting.attendees?.join(', ') || 'Not specified'}

Meeting Notes:
${plainContent}

Respond with a JSON array of tasks in this exact format:
{
  "tasks": [
    {
      "title": "Task title",
      "description": "Detailed description of what needs to be done",
      "priority": "medium",
      "acceptanceCriteria": ["Criterion 1", "Criterion 2"]
    }
  ]
}

Only include tasks that represent actual action items. Be specific and actionable. If no clear tasks are mentioned, return an empty array.`,
        },
      ],
    })

    // Parse the response
    const textBlock = response.content.find((c) => c.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from AI')
    }

    // Extract JSON from response (may be wrapped in markdown code block)
    let jsonStr = textBlock.text
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1]
    }

    let parsedResponse: { tasks: GeneratedTask[] }
    try {
      parsedResponse = JSON.parse(jsonStr.trim())
    } catch {
      throw new Error('Failed to parse AI response as JSON')
    }

    if (!Array.isArray(parsedResponse.tasks)) {
      throw new Error('Invalid response format from AI')
    }

    // Create tasks and link them to the meeting
    const createdTasks = []
    for (const taskData of parsedResponse.tasks) {
      // Create the task
      const task = await tasksDb.createTask({
        projectId: data.projectId,
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority,
        acceptanceCriteria: taskData.acceptanceCriteria,
        status: 'pending',
      })

      // Link task to meeting
      await meetingsDb.linkTaskToMeeting(data.meetingId, task.id, 'created')

      createdTasks.push(task)
    }

    return {
      success: true,
      tasksCreated: createdTasks.length,
      tasks: createdTasks,
    }
  })

/**
 * Update existing tasks from meeting content using AI
 */
export const updateTasksFromMeeting = createServerFn({ method: 'POST' })
  .inputValidator(GenerateTasksSchema)
  .handler(async ({ data }) => {
    const meeting = await meetingsDb.getMeetingById(data.meetingId)
    if (!meeting) {
      throw new Error('Meeting not found')
    }

    if (meeting.status !== 'finalized') {
      throw new Error('Meeting must be finalized before updating tasks')
    }

    // Get existing tasks for the project
    const existingTasks = await tasksDb.listTasks({
      projectId: data.projectId,
      includeArchived: false,
    })

    if (existingTasks.length === 0) {
      return {
        success: true,
        tasksUpdated: 0,
        updates: [],
      }
    }

    // Strip HTML tags for cleaner content
    const plainContent = meeting.content
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    // Format existing tasks for the prompt
    const tasksContext = existingTasks
      .map(
        (t) =>
          `- ID: ${t.id}\n  Title: ${t.title}\n  Status: ${t.status}\n  Priority: ${t.priority}\n  Description: ${t.description || 'None'}`
      )
      .join('\n\n')

    // Use Claude to analyze meeting content and suggest updates
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Analyze the following meeting notes and compare them against existing project tasks. Identify any tasks that need updates based on new requirements, scope changes, or priority adjustments mentioned in the meeting.

Meeting Title: ${meeting.title}
Date: ${meeting.date}
Attendees: ${meeting.attendees?.join(', ') || 'Not specified'}

Meeting Notes:
${plainContent}

Existing Tasks:
${tasksContext}

Respond with a JSON object containing tasks that need updates:
{
  "updates": [
    {
      "taskId": "uuid-of-task-to-update",
      "title": "Updated title if changed (optional)",
      "description": "Updated description if changed (optional)",
      "priority": "updated priority if changed (optional: low/medium/high/urgent)",
      "acceptanceCriteria": ["New criterion 1", "New criterion 2"] (optional),
      "changesSummary": "Brief description of what changed and why"
    }
  ]
}

Only include tasks that actually need updates based on the meeting content. If a task's requirements, scope, or priority were discussed and changed, include it. If nothing relevant was discussed, return an empty array.`,
        },
      ],
    })

    // Parse the response
    const textBlock = response.content.find((c) => c.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from AI')
    }

    // Extract JSON from response
    let jsonStr = textBlock.text
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1]
    }

    interface TaskUpdate {
      taskId: string
      title?: string
      description?: string
      priority?: 'low' | 'medium' | 'high' | 'urgent'
      acceptanceCriteria?: string[]
      changesSummary: string
    }

    let parsedResponse: { updates: TaskUpdate[] }
    try {
      parsedResponse = JSON.parse(jsonStr.trim())
    } catch {
      throw new Error('Failed to parse AI response as JSON')
    }

    if (!Array.isArray(parsedResponse.updates)) {
      throw new Error('Invalid response format from AI')
    }

    // Apply updates and link to meeting
    const appliedUpdates = []
    for (const update of parsedResponse.updates) {
      // Verify task exists
      const existingTask = existingTasks.find((t) => t.id === update.taskId)
      if (!existingTask) continue

      // Build update data
      const updateData: Parameters<typeof tasksDb.updateTask>[1] = {}
      if (update.title) updateData.title = update.title
      if (update.description) updateData.description = update.description
      if (update.priority) updateData.priority = update.priority
      if (update.acceptanceCriteria) {
        updateData.acceptanceCriteria = update.acceptanceCriteria
      }

      // Only update if there's something to change
      if (Object.keys(updateData).length > 0) {
        await tasksDb.updateTask(update.taskId, updateData)

        // Link task to meeting with changes summary
        await meetingsDb.linkTaskToMeeting(
          data.meetingId,
          update.taskId,
          'updated',
          update.changesSummary
        )

        appliedUpdates.push({
          taskId: update.taskId,
          taskTitle: existingTask.title,
          changesSummary: update.changesSummary,
        })
      }
    }

    return {
      success: true,
      tasksUpdated: appliedUpdates.length,
      updates: appliedUpdates,
    }
  })
