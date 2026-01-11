import { eq, desc, and } from 'drizzle-orm'
import { db } from './index'
import {
  meetings,
  meetingTaskLinks,
  type NewMeeting,
  type Meeting,
} from './schema'

// =============================================================================
// MEETING CRUD
// =============================================================================

/**
 * Get all meetings for a project
 */
export async function getMeetingsByProject(
  projectId: string,
  options?: {
    status?: Meeting['status']
    limit?: number
    offset?: number
  }
): Promise<Meeting[]> {
  const conditions = [eq(meetings.projectId, projectId)]

  if (options?.status) {
    conditions.push(eq(meetings.status, options.status))
  }

  const result = await db
    .select()
    .from(meetings)
    .where(and(...conditions))
    .orderBy(desc(meetings.date))
    .limit(options?.limit ?? 100)
    .offset(options?.offset ?? 0)

  return result
}

/**
 * Get a single meeting by ID
 */
export async function getMeetingById(id: string): Promise<Meeting | null> {
  const result = await db
    .select()
    .from(meetings)
    .where(eq(meetings.id, id))
    .limit(1)

  return result[0] ?? null
}

/**
 * Create a new meeting
 */
export async function createMeeting(data: NewMeeting): Promise<Meeting> {
  const result = await db.insert(meetings).values(data).returning()
  return result[0]!
}

/**
 * Update a meeting
 */
export async function updateMeeting(
  id: string,
  data: Partial<Omit<NewMeeting, 'id' | 'projectId'>>
): Promise<Meeting | null> {
  const result = await db
    .update(meetings)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(meetings.id, id))
    .returning()

  return result[0] ?? null
}

/**
 * Delete a meeting
 */
export async function deleteMeeting(id: string): Promise<boolean> {
  const result = await db.delete(meetings).where(eq(meetings.id, id)).returning()
  return result.length > 0
}

// =============================================================================
// MEETING-TASK LINKS
// =============================================================================

/**
 * Get task links for a meeting
 */
export async function getMeetingTaskLinks(meetingId: string) {
  return db
    .select()
    .from(meetingTaskLinks)
    .where(eq(meetingTaskLinks.meetingId, meetingId))
    .orderBy(desc(meetingTaskLinks.createdAt))
}

/**
 * Link a task to a meeting
 */
export async function linkTaskToMeeting(
  meetingId: string,
  taskId: string,
  linkType: 'created' | 'updated',
  changesSummary?: string
) {
  const result = await db
    .insert(meetingTaskLinks)
    .values({
      meetingId,
      taskId,
      linkType,
      changesSummary,
    })
    .returning()

  return result[0]!
}

/**
 * Remove a task link from a meeting
 */
export async function unlinkTaskFromMeeting(linkId: string): Promise<void> {
  await db.delete(meetingTaskLinks).where(eq(meetingTaskLinks.id, linkId))
}
