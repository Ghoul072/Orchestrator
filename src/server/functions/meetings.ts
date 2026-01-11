import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import * as meetingsDb from '~/server/db/meetings'

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
