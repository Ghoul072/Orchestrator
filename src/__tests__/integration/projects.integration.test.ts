import { describe, it, expect, afterEach } from 'vitest'
import { db } from '~/server/db'
import { projects } from '~/server/db/schema'
import { eq } from 'drizzle-orm'
import * as projectsDb from '~/server/db/projects'

// Skip if no database connection
const skipIfNoDb = process.env.SKIP_DB_TESTS === 'true'

describe.skipIf(skipIfNoDb)('Projects Database Integration', () => {
  let createdProjectIds: string[] = []

  afterEach(async () => {
    // Clean up created projects
    for (const id of createdProjectIds) {
      try {
        await db.delete(projects).where(eq(projects.id, id))
      } catch {
        // Ignore errors during cleanup
      }
    }
    createdProjectIds = []
  })

  describe('createProject', () => {
    it('should create a project with name only', async () => {
      const result = await projectsDb.createProject({
        name: 'Test Project',
      })

      createdProjectIds.push(result.id)

      expect(result.id).toBeDefined()
      expect(result.name).toBe('Test Project')
      expect(result.description).toBeNull()
      expect(result.isArchived).toBe(false)
    })

    it('should create a project with all fields', async () => {
      const result = await projectsDb.createProject({
        name: 'Full Project',
        description: 'A test project with all fields',
        agentContext: 'You are helping with a TypeScript project',
        metadata: { version: { value: '1.0.0' } },
      })

      createdProjectIds.push(result.id)

      expect(result.id).toBeDefined()
      expect(result.name).toBe('Full Project')
      expect(result.description).toBe('A test project with all fields')
      expect(result.agentContext).toBe('You are helping with a TypeScript project')
    })
  })

  describe('getProjectById', () => {
    it('should return a project by ID', async () => {
      const created = await projectsDb.createProject({
        name: 'Get By ID Test',
      })
      createdProjectIds.push(created.id)

      const result = await projectsDb.getProjectById(created.id)

      expect(result).toBeDefined()
      expect(result?.id).toBe(created.id)
      expect(result?.name).toBe('Get By ID Test')
    })

    it('should return null for non-existent ID', async () => {
      const result = await projectsDb.getProjectById('00000000-0000-0000-0000-000000000000')

      expect(result).toBeNull()
    })
  })

  describe('getProjects', () => {
    it('should return all non-archived projects', async () => {
      const project1 = await projectsDb.createProject({ name: 'Project 1' })
      const project2 = await projectsDb.createProject({ name: 'Project 2' })
      createdProjectIds.push(project1.id, project2.id)

      const result = await projectsDb.getProjects()

      expect(result.length).toBeGreaterThanOrEqual(2)
      expect(result.some(p => p.id === project1.id)).toBe(true)
      expect(result.some(p => p.id === project2.id)).toBe(true)
    })

    it('should not return archived projects by default', async () => {
      const project = await projectsDb.createProject({ name: 'Archived Project' })
      createdProjectIds.push(project.id)

      await projectsDb.updateProject(project.id, { isArchived: true })

      const result = await projectsDb.getProjects()

      expect(result.some(p => p.id === project.id)).toBe(false)
    })

    it('should return archived projects when includeArchived is true', async () => {
      const project = await projectsDb.createProject({ name: 'Include Archived' })
      createdProjectIds.push(project.id)

      await projectsDb.updateProject(project.id, { isArchived: true })

      const result = await projectsDb.getProjects({ includeArchived: true })

      expect(result.some(p => p.id === project.id)).toBe(true)
    })
  })

  describe('updateProject', () => {
    it('should update project name', async () => {
      const project = await projectsDb.createProject({ name: 'Original Name' })
      createdProjectIds.push(project.id)

      const result = await projectsDb.updateProject(project.id, {
        name: 'Updated Name',
      })

      expect(result?.name).toBe('Updated Name')
    })

    it('should update project description', async () => {
      const project = await projectsDb.createProject({ name: 'Test Project' })
      createdProjectIds.push(project.id)

      const result = await projectsDb.updateProject(project.id, {
        description: 'New description',
      })

      expect(result?.description).toBe('New description')
    })

    it('should archive a project', async () => {
      const project = await projectsDb.createProject({ name: 'To Archive' })
      createdProjectIds.push(project.id)

      const result = await projectsDb.updateProject(project.id, {
        isArchived: true,
      })

      expect(result?.isArchived).toBe(true)
    })

    it('should return null for non-existent project', async () => {
      const result = await projectsDb.updateProject(
        '00000000-0000-0000-0000-000000000000',
        { name: 'Test' }
      )

      expect(result).toBeNull()
    })
  })

  describe('deleteProject', () => {
    it('should delete a project', async () => {
      const project = await projectsDb.createProject({ name: 'To Delete' })
      // Don't add to cleanup list since we're deleting

      const deleted = await projectsDb.deleteProject(project.id)
      expect(deleted).toBe(true)

      const result = await projectsDb.getProjectById(project.id)
      expect(result).toBeNull()
    })

    it('should return false for non-existent project', async () => {
      const result = await projectsDb.deleteProject('00000000-0000-0000-0000-000000000000')

      expect(result).toBe(false)
    })
  })
})
