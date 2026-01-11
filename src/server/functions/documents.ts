import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import * as documentsDb from '~/server/db/documents'

// =============================================================================
// SCHEMAS
// =============================================================================

const DocumentIdSchema = z.object({
  id: z.string().uuid(),
})

const ProjectIdSchema = z.object({
  projectId: z.string().uuid(),
  type: z.enum(['note', 'diagram', 'upload']).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
})

const CreateDocumentSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(500),
  content: z.string().optional(),
  type: z.enum(['note', 'diagram', 'upload']).optional(),
  linkedTaskId: z.string().uuid().optional(),
  linkedMeetingId: z.string().uuid().optional(),
})

const UpdateDocumentSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(500).optional(),
  content: z.string().optional(),
})

const LinkDocumentSchema = z.object({
  documentId: z.string().uuid(),
  taskId: z.string().uuid().nullable().optional(),
  meetingId: z.string().uuid().nullable().optional(),
})

// =============================================================================
// SERVER FUNCTIONS
// =============================================================================

/**
 * List documents for a project
 */
export const listDocuments = createServerFn({ method: 'POST' })
  .inputValidator(ProjectIdSchema)
  .handler(async ({ data }) => {
    return documentsDb.getDocumentsByProject(data.projectId, {
      type: data.type,
      limit: data.limit,
      offset: data.offset,
    })
  })

/**
 * Get a document by ID
 */
export const getDocument = createServerFn({ method: 'POST' })
  .inputValidator(DocumentIdSchema)
  .handler(async ({ data }) => {
    const document = await documentsDb.getDocumentById(data.id)
    if (!document) {
      throw new Error('Document not found')
    }
    return document
  })

/**
 * Get documents linked to a task
 */
export const getDocumentsByTask = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ taskId: z.string().uuid() }))
  .handler(async ({ data }) => {
    return documentsDb.getDocumentsByTask(data.taskId)
  })

/**
 * Get documents linked to a meeting
 */
export const getDocumentsByMeeting = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ meetingId: z.string().uuid() }))
  .handler(async ({ data }) => {
    return documentsDb.getDocumentsByMeeting(data.meetingId)
  })

/**
 * Create a new document
 */
export const createDocument = createServerFn({ method: 'POST' })
  .inputValidator(CreateDocumentSchema)
  .handler(async ({ data }) => {
    return documentsDb.createDocument({
      projectId: data.projectId,
      title: data.title,
      content: data.content ?? '',
      type: data.type ?? 'note',
      linkedTaskId: data.linkedTaskId,
      linkedMeetingId: data.linkedMeetingId,
    })
  })

/**
 * Update a document
 */
export const updateDocument = createServerFn({ method: 'POST' })
  .inputValidator(UpdateDocumentSchema)
  .handler(async ({ data }) => {
    const document = await documentsDb.updateDocument(data.id, {
      title: data.title,
      content: data.content,
    })

    if (!document) {
      throw new Error('Document not found')
    }

    return document
  })

/**
 * Delete a document
 */
export const deleteDocument = createServerFn({ method: 'POST' })
  .inputValidator(DocumentIdSchema)
  .handler(async ({ data }) => {
    const deleted = await documentsDb.deleteDocument(data.id)
    if (!deleted) {
      throw new Error('Document not found')
    }
    return { success: true }
  })

/**
 * Link document to task or meeting
 */
export const linkDocument = createServerFn({ method: 'POST' })
  .inputValidator(LinkDocumentSchema)
  .handler(async ({ data }) => {
    let result

    if (data.taskId !== undefined) {
      result = await documentsDb.linkDocumentToTask(data.documentId, data.taskId)
    }

    if (data.meetingId !== undefined) {
      result = await documentsDb.linkDocumentToMeeting(data.documentId, data.meetingId)
    }

    if (!result) {
      throw new Error('Document not found')
    }

    return result
  })
