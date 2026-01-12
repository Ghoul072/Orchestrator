import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { query, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import * as documentsDb from '~/server/db/documents'
import * as tasksDb from '~/server/db/tasks'
import * as reposDb from '~/server/db/repositories'

/**
 * Run a single-shot query using Claude Code SDK (runs locally)
 * Returns the assistant's text response
 */
async function runSingleQuery(prompt: string): Promise<string> {
  const messages: SDKUserMessage[] = [
    {
      type: 'user',
      message: { role: 'user', content: prompt },
      parent_tool_use_id: null,
      session_id: crypto.randomUUID(),
    } as SDKUserMessage,
  ]

  async function* messageIterator(): AsyncIterable<SDKUserMessage> {
    for (const msg of messages) {
      yield msg
    }
  }

  const queryInstance = query({
    prompt: messageIterator(),
    options: {
      maxTurns: 1,
      allowedTools: [],
    },
  })

  let responseText = ''

  for await (const message of queryInstance) {
    const msg = message as {
      type?: string
      message?: { content?: Array<{ type: string; text?: string }> }
    }

    if (msg.type === 'assistant' && msg.message?.content) {
      const textContent = msg.message.content.find((c) => c.type === 'text')
      if (textContent?.text) {
        responseText = textContent.text
      }
    }
  }

  return responseText
}

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

// =============================================================================
// AI TASK GENERATION
// =============================================================================

const GenerateTasksFromDocumentSchema = z.object({
  documentId: z.string().uuid(),
  projectId: z.string().uuid(),
})

interface GeneratedTask {
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  acceptanceCriteria: string[]
}

/**
 * Generate tasks from document content using AI
 */
export const generateTasksFromDocument = createServerFn({ method: 'POST' })
  .inputValidator(GenerateTasksFromDocumentSchema)
  .handler(async ({ data }) => {
    const document = await documentsDb.getDocumentById(data.documentId)
    if (!document) {
      throw new Error('Document not found')
    }

    if (!document.content) {
      throw new Error('Document has no content')
    }

    // Strip HTML tags for cleaner content
    const plainContent = document.content
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (!plainContent) {
      throw new Error('Document content is empty')
    }

    // Use Claude Code SDK to analyze document content
    const prompt = `Analyze the following document and extract actionable tasks. For each task, provide a clear title, description, priority (low/medium/high/urgent), and acceptance criteria.

Document Title: ${document.title}
Document Type: ${document.type}

Document Content:
${plainContent}

Respond with ONLY a JSON object (no markdown code blocks):
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

Only include tasks that represent actual action items or requirements from the document. Be specific and actionable. If no clear tasks are mentioned, return an empty array.`

    const responseText = await runSingleQuery(prompt)
    if (!responseText) {
      throw new Error('No response from AI')
    }

    // Extract JSON from response (may be wrapped in markdown code block)
    let jsonStr = responseText
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

    // Create tasks and link them to the document
    const repositories = await reposDb.getRepositoriesByProject(data.projectId)
    const defaultRepositoryId =
      repositories.length === 1 ? repositories[0]?.id ?? null : null

    const createdTasks = []
    for (const taskData of parsedResponse.tasks) {
      // Create the task
      const task = await tasksDb.createTask({
        projectId: data.projectId,
        repositoryId: defaultRepositoryId ?? undefined,
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority,
        acceptanceCriteria: taskData.acceptanceCriteria,
        status: 'pending',
      })

      // Link document to the created task
      await documentsDb.linkDocumentToTask(data.documentId, task.id)

      createdTasks.push(task)
    }

    return {
      success: true,
      tasksCreated: createdTasks.length,
      tasks: createdTasks,
    }
  })
