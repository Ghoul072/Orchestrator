import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { query, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import * as projectsDb from '~/server/db/projects'
import * as tasksDb from '~/server/db/tasks'

/**
 * Run a single-shot query using Claude Code SDK (runs locally)
 * Returns the assistant's text response
 */
async function runSingleQuery(prompt: string): Promise<string> {
  // Create a simple async iterable with just one message
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
      maxTurns: 1, // Single turn for task generation
      allowedTools: [], // No tools needed, just text generation
    },
  })

  let responseText = ''

  // Collect the response
  for await (const message of queryInstance) {
    const msg = message as {
      type?: string
      message?: { content?: Array<{ type: string; text?: string }> }
    }

    // Handle assistant messages
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

// Using z.any() for metadata to allow arbitrary JSON objects
const MetadataSchema = z.record(z.string(), z.any()).optional()

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  agentContext: z.string().optional(),
  metadata: MetadataSchema,
})

const UpdateProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  agentContext: z.string().optional(),
  metadata: MetadataSchema,
  isArchived: z.boolean().optional(),
})

const ProjectIdSchema = z.object({
  id: z.string().uuid(),
})

const GetProjectsSchema = z.object({
  includeArchived: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
})

const ProjectTagSchema = z.object({
  projectId: z.string().uuid(),
  tagId: z.string().uuid(),
})

// =============================================================================
// SERVER FUNCTIONS
// =============================================================================

/**
 * Get all projects
 */
export const getProjects = createServerFn({ method: 'GET' })
  .handler(async () => {
    return projectsDb.getProjects()
  })

/**
 * Get projects with options
 */
export const getProjectsWithOptions = createServerFn({ method: 'POST' })
  .inputValidator(GetProjectsSchema)
  .handler(async ({ data }) => {
    return projectsDb.getProjects(data)
  })

/**
 * Get a single project by ID
 */
export const getProject = createServerFn({ method: 'POST' })
  .inputValidator(ProjectIdSchema)
  .handler(async ({ data }) => {
    const project = await projectsDb.getProjectById(data.id)
    if (!project) {
      throw new Error('Project not found')
    }
    return project
  })

/**
 * Get a project with its tags
 */
export const getProjectWithTags = createServerFn({ method: 'POST' })
  .inputValidator(ProjectIdSchema)
  .handler(async ({ data }) => {
    const project = await projectsDb.getProjectWithTags(data.id)
    if (!project) {
      throw new Error('Project not found')
    }
    return project
  })

/**
 * Get project statistics
 */
export const getProjectStats = createServerFn({ method: 'POST' })
  .inputValidator(ProjectIdSchema)
  .handler(async ({ data }) => {
    const stats = await projectsDb.getProjectStats(data.id)
    return stats
  })

/**
 * Create a new project
 */
export const createProject = createServerFn({ method: 'POST' })
  .inputValidator(CreateProjectSchema)
  .handler(async ({ data }) => {
    return projectsDb.createProject(data)
  })

/**
 * Update a project
 */
export const updateProject = createServerFn({ method: 'POST' })
  .inputValidator(UpdateProjectSchema)
  .handler(async ({ data }) => {
    const { id, ...updateData } = data
    const project = await projectsDb.updateProject(id, updateData)
    if (!project) {
      throw new Error('Project not found')
    }
    return project
  })

/**
 * Archive a project
 */
export const archiveProject = createServerFn({ method: 'POST' })
  .inputValidator(ProjectIdSchema)
  .handler(async ({ data }) => {
    const project = await projectsDb.archiveProject(data.id)
    if (!project) {
      throw new Error('Project not found')
    }
    return project
  })

/**
 * Restore an archived project
 */
export const restoreProject = createServerFn({ method: 'POST' })
  .inputValidator(ProjectIdSchema)
  .handler(async ({ data }) => {
    const project = await projectsDb.restoreProject(data.id)
    if (!project) {
      throw new Error('Project not found')
    }
    return project
  })

/**
 * Delete a project
 */
export const deleteProject = createServerFn({ method: 'POST' })
  .inputValidator(ProjectIdSchema)
  .handler(async ({ data }) => {
    const deleted = await projectsDb.deleteProject(data.id)
    if (!deleted) {
      throw new Error('Project not found')
    }
    return { success: true }
  })

/**
 * Add a tag to a project
 */
export const addTagToProject = createServerFn({ method: 'POST' })
  .inputValidator(ProjectTagSchema)
  .handler(async ({ data }) => {
    await projectsDb.addTagToProject(data.projectId, data.tagId)
    return { success: true }
  })

/**
 * Remove a tag from a project
 */
export const removeTagFromProject = createServerFn({ method: 'POST' })
  .inputValidator(ProjectTagSchema)
  .handler(async ({ data }) => {
    await projectsDb.removeTagFromProject(data.projectId, data.tagId)
    return { success: true }
  })

// =============================================================================
// AI TASK GENERATION FROM PROJECT DESCRIPTION
// =============================================================================

const GenerateTasksFromDescriptionSchema = z.object({
  projectId: z.string().uuid(),
})

interface GeneratedTask {
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  effort: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  acceptanceCriteria: string[]
  subtasks?: Array<{
    title: string
    description?: string
  }>
}

/**
 * Generate initial tasks from project description using AI
 */
export const generateTasksFromDescription = createServerFn({ method: 'POST' })
  .inputValidator(GenerateTasksFromDescriptionSchema)
  .handler(async ({ data }) => {
    const project = await projectsDb.getProjectById(data.projectId)
    if (!project) {
      throw new Error('Project not found')
    }

    if (!project.description || project.description.trim().length < 10) {
      throw new Error('Project description is too short to generate meaningful tasks')
    }

    // Strip HTML tags for cleaner content
    const plainDescription = project.description
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    // Use Claude Code SDK to analyze project description and generate tasks
    const prompt = `You are a project planning assistant. Analyze the following project description and create a comprehensive task breakdown for building this project.

Project Name: ${project.name}

Project Description:
${plainDescription}

Create a structured list of tasks needed to complete this project. For each task, provide:
- A clear, actionable title
- A detailed description
- Priority (low/medium/high/urgent)
- Effort estimate (xs/sm/md/lg/xl)
- Acceptance criteria
- Subtasks if needed for complex tasks

Respond with ONLY a JSON object (no markdown code blocks):
{
  "tasks": [
    {
      "title": "Task title",
      "description": "Detailed description of what needs to be done",
      "priority": "medium",
      "effort": "md",
      "acceptanceCriteria": ["Criterion 1", "Criterion 2"],
      "subtasks": [
        { "title": "Subtask title", "description": "Optional description" }
      ]
    }
  ]
}

Focus on:
1. Breaking down the project into manageable, actionable tasks
2. Logical ordering (foundation tasks first, then features)
3. Including technical setup, core features, and polish tasks
4. Being specific and actionable

Generate between 5-15 tasks depending on project complexity.`

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

    // Create tasks
    const createdTasks = []
    let sortOrder = 0

    for (const taskData of parsedResponse.tasks) {
      // Create the main task
      const task = await tasksDb.createTask({
        projectId: data.projectId,
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority,
        effort: taskData.effort,
        acceptanceCriteria: taskData.acceptanceCriteria,
        status: 'pending',
        sortOrder: sortOrder++,
      })

      createdTasks.push(task)

      // Create subtasks if any
      if (taskData.subtasks && taskData.subtasks.length > 0) {
        let subtaskOrder = 0
        for (const subtaskData of taskData.subtasks) {
          await tasksDb.createTask({
            projectId: data.projectId,
            parentId: task.id,
            title: subtaskData.title,
            description: subtaskData.description,
            priority: taskData.priority,
            status: 'pending',
            sortOrder: subtaskOrder++,
          })
        }
      }
    }

    return {
      success: true,
      tasksCreated: createdTasks.length,
      tasks: createdTasks,
    }
  })
