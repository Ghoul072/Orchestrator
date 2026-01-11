import { eq, desc, and } from 'drizzle-orm'
import { db } from '~/server/db'
import { documents, type NewDocument, type Document } from '~/server/db/schema'

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

/**
 * Get all documents for a project
 */
export async function getDocumentsByProject(
  projectId: string,
  options?: {
    type?: 'note' | 'diagram' | 'upload'
    limit?: number
    offset?: number
  }
): Promise<Document[]> {
  // Build where clause based on options
  const whereClause = options?.type
    ? and(eq(documents.projectId, projectId), eq(documents.type, options.type))
    : eq(documents.projectId, projectId)

  // Build base query
  let query = db
    .select()
    .from(documents)
    .where(whereClause)
    .orderBy(desc(documents.updatedAt))
    .$dynamic()

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  if (options?.offset) {
    query = query.offset(options.offset)
  }

  return query
}

/**
 * Get a document by ID
 */
export async function getDocumentById(id: string): Promise<Document | undefined> {
  const [result] = await db.select().from(documents).where(eq(documents.id, id)).limit(1)
  return result
}

/**
 * Get documents linked to a task
 */
export async function getDocumentsByTask(taskId: string): Promise<Document[]> {
  return db
    .select()
    .from(documents)
    .where(eq(documents.linkedTaskId, taskId))
    .orderBy(desc(documents.updatedAt))
}

/**
 * Get documents linked to a meeting
 */
export async function getDocumentsByMeeting(meetingId: string): Promise<Document[]> {
  return db
    .select()
    .from(documents)
    .where(eq(documents.linkedMeetingId, meetingId))
    .orderBy(desc(documents.updatedAt))
}

// =============================================================================
// MUTATION FUNCTIONS
// =============================================================================

/**
 * Create a new document
 */
export async function createDocument(data: NewDocument): Promise<Document> {
  const [result] = await db.insert(documents).values(data).returning()
  return result!
}

/**
 * Update a document
 */
export async function updateDocument(
  id: string,
  data: Partial<Omit<Document, 'id' | 'projectId' | 'createdAt'>>
): Promise<Document | undefined> {
  const [result] = await db
    .update(documents)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, id))
    .returning()
  return result
}

/**
 * Delete a document
 */
export async function deleteDocument(id: string): Promise<boolean> {
  const result = await db.delete(documents).where(eq(documents.id, id)).returning()
  return result.length > 0
}

/**
 * Link document to a task
 */
export async function linkDocumentToTask(
  documentId: string,
  taskId: string | null
): Promise<Document | undefined> {
  const [result] = await db
    .update(documents)
    .set({
      linkedTaskId: taskId,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId))
    .returning()
  return result
}

/**
 * Link document to a meeting
 */
export async function linkDocumentToMeeting(
  documentId: string,
  meetingId: string | null
): Promise<Document | undefined> {
  const [result] = await db
    .update(documents)
    .set({
      linkedMeetingId: meetingId,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId))
    .returning()
  return result
}
