import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import * as projectsDb from '~/server/db/projects'

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
