import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as documentsDb from '~/server/db/documents'

// =============================================================================
// CONFIGURATION
// =============================================================================

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/svg+xml',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/json',
]

// Ensure uploads directory exists
async function ensureUploadsDir() {
  try {
    await fs.access(UPLOADS_DIR)
  } catch {
    await fs.mkdir(UPLOADS_DIR, { recursive: true })
  }
}

// =============================================================================
// SCHEMAS
// =============================================================================

const UploadSchema = z.object({
  projectId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  fileType: z.string().min(1).max(100),
  fileSize: z.number().min(1).max(MAX_FILE_SIZE),
  fileData: z.string(), // Base64 encoded file data
  title: z.string().min(1).max(500).optional(),
  linkedTaskId: z.string().uuid().optional(),
  linkedMeetingId: z.string().uuid().optional(),
})

const DeleteUploadSchema = z.object({
  documentId: z.string().uuid(),
})

// =============================================================================
// SERVER FUNCTIONS
// =============================================================================

/**
 * Upload a file and create a document record
 */
export const uploadFile = createServerFn({ method: 'POST' })
  .inputValidator(UploadSchema)
  .handler(async ({ data }) => {
    // Validate file type
    if (!ALLOWED_TYPES.includes(data.fileType)) {
      throw new Error(`File type ${data.fileType} is not allowed`)
    }

    // Ensure uploads directory exists
    await ensureUploadsDir()

    // Generate unique filename
    const timestamp = Date.now()
    const safeFileName = data.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const uniqueFileName = `${timestamp}-${safeFileName}`
    const filePath = path.join(UPLOADS_DIR, uniqueFileName)

    // Decode base64 and write file
    const fileBuffer = Buffer.from(data.fileData, 'base64')
    await fs.writeFile(filePath, fileBuffer)

    // Create document record
    const document = await documentsDb.createDocument({
      projectId: data.projectId,
      title: data.title || data.fileName,
      content: '', // Uploads don't have content
      type: 'upload',
      filePath: uniqueFileName, // Store relative path
      fileType: data.fileType,
      fileSize: data.fileSize,
      linkedTaskId: data.linkedTaskId,
      linkedMeetingId: data.linkedMeetingId,
    })

    return document
  })

/**
 * Delete an uploaded file and its document record
 */
export const deleteUpload = createServerFn({ method: 'POST' })
  .inputValidator(DeleteUploadSchema)
  .handler(async ({ data }) => {
    // Get document to find file path
    const document = await documentsDb.getDocumentById(data.documentId)
    if (!document) {
      throw new Error('Document not found')
    }

    if (document.type !== 'upload' || !document.filePath) {
      throw new Error('Document is not an upload')
    }

    // Delete file from disk
    const fullPath = path.join(UPLOADS_DIR, document.filePath)
    try {
      await fs.unlink(fullPath)
    } catch (error) {
      // File might already be deleted, continue
      console.warn('Could not delete file:', fullPath, error)
    }

    // Delete document record
    await documentsDb.deleteDocument(data.documentId)

    return { success: true }
  })

/**
 * Get file content for display
 */
export const getFileContent = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ documentId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const document = await documentsDb.getDocumentById(data.documentId)
    if (!document) {
      throw new Error('Document not found')
    }

    if (document.type !== 'upload' || !document.filePath) {
      throw new Error('Document is not an upload')
    }

    // Read file and return as base64
    const fullPath = path.join(UPLOADS_DIR, document.filePath)
    const fileBuffer = await fs.readFile(fullPath)
    const base64 = fileBuffer.toString('base64')

    return {
      data: base64,
      fileName: document.title,
      fileType: document.fileType,
      fileSize: document.fileSize,
    }
  })

/**
 * Get file URL (data URL for images)
 */
export const getFileDataUrl = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ documentId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const document = await documentsDb.getDocumentById(data.documentId)
    if (!document) {
      throw new Error('Document not found')
    }

    if (document.type !== 'upload' || !document.filePath) {
      throw new Error('Document is not an upload')
    }

    // Read file and return as data URL
    const fullPath = path.join(UPLOADS_DIR, document.filePath)
    const fileBuffer = await fs.readFile(fullPath)
    const base64 = fileBuffer.toString('base64')
    const dataUrl = `data:${document.fileType};base64,${base64}`

    return {
      url: dataUrl,
      fileName: document.title,
      fileType: document.fileType,
      fileSize: document.fileSize,
    }
  })

export { MAX_FILE_SIZE, ALLOWED_TYPES }
