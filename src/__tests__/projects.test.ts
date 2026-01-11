import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Schema definitions from server functions for validation testing
const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  agentContext: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

const UpdateProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  agentContext: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  isArchived: z.boolean().optional(),
})

const ProjectIdSchema = z.object({
  id: z.string().uuid(),
})

describe('Project Validation Schemas', () => {
  describe('CreateProjectSchema', () => {
    it('should accept valid project data', () => {
      const validProject = {
        name: 'Test Project',
        description: 'A test project description',
      }

      const result = CreateProjectSchema.safeParse(validProject)
      expect(result.success).toBe(true)
    })

    it('should reject empty name', () => {
      const invalidProject = {
        name: '',
        description: 'A test project',
      }

      const result = CreateProjectSchema.safeParse(invalidProject)
      expect(result.success).toBe(false)
    })

    it('should reject name over 255 characters', () => {
      const invalidProject = {
        name: 'a'.repeat(256),
        description: 'A test project',
      }

      const result = CreateProjectSchema.safeParse(invalidProject)
      expect(result.success).toBe(false)
    })

    it('should accept project with only name', () => {
      const minimalProject = {
        name: 'Minimal Project',
      }

      const result = CreateProjectSchema.safeParse(minimalProject)
      expect(result.success).toBe(true)
    })

    it('should accept project with metadata', () => {
      const projectWithMetadata = {
        name: 'Project with Metadata',
        metadata: { key: 'value', nested: { data: true } },
      }

      const result = CreateProjectSchema.safeParse(projectWithMetadata)
      expect(result.success).toBe(true)
    })

    it('should accept project with agent context', () => {
      const projectWithContext = {
        name: 'AI Project',
        agentContext: 'You are helping with a TypeScript project using React.',
      }

      const result = CreateProjectSchema.safeParse(projectWithContext)
      expect(result.success).toBe(true)
    })
  })

  describe('UpdateProjectSchema', () => {
    it('should accept valid update data', () => {
      const validUpdate = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Updated Project Name',
      }

      const result = UpdateProjectSchema.safeParse(validUpdate)
      expect(result.success).toBe(true)
    })

    it('should reject invalid UUID', () => {
      const invalidUpdate = {
        id: 'not-a-uuid',
        name: 'Updated Project',
      }

      const result = UpdateProjectSchema.safeParse(invalidUpdate)
      expect(result.success).toBe(false)
    })

    it('should accept update with only id', () => {
      const minimalUpdate = {
        id: '550e8400-e29b-41d4-a716-446655440000',
      }

      const result = UpdateProjectSchema.safeParse(minimalUpdate)
      expect(result.success).toBe(true)
    })

    it('should accept archive flag', () => {
      const archiveUpdate = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        isArchived: true,
      }

      const result = UpdateProjectSchema.safeParse(archiveUpdate)
      expect(result.success).toBe(true)
    })
  })

  describe('ProjectIdSchema', () => {
    it('should accept valid UUID', () => {
      const validId = {
        id: '550e8400-e29b-41d4-a716-446655440000',
      }

      const result = ProjectIdSchema.safeParse(validId)
      expect(result.success).toBe(true)
    })

    it('should reject invalid UUID', () => {
      const invalidId = {
        id: 'invalid-id',
      }

      const result = ProjectIdSchema.safeParse(invalidId)
      expect(result.success).toBe(false)
    })

    it('should reject missing id', () => {
      const missingId = {}

      const result = ProjectIdSchema.safeParse(missingId)
      expect(result.success).toBe(false)
    })
  })
})

describe('Project Business Logic', () => {
  describe('Project naming rules', () => {
    it('should allow alphanumeric project names', () => {
      const validNames = [
        'MyProject123',
        'test-project',
        'Project_Name',
        'My Awesome Project',
        '2024 Roadmap',
      ]

      validNames.forEach((name) => {
        const result = CreateProjectSchema.safeParse({ name })
        expect(result.success).toBe(true)
      })
    })

    it('should allow special characters in names', () => {
      const validNames = [
        'Project (v2)',
        "User's Guide",
        'API: Development',
        'Feature #123',
      ]

      validNames.forEach((name) => {
        const result = CreateProjectSchema.safeParse({ name })
        expect(result.success).toBe(true)
      })
    })
  })

  describe('Metadata handling', () => {
    it('should accept complex nested metadata', () => {
      const project = {
        name: 'Complex Project',
        metadata: {
          version: '1.0.0',
          settings: {
            theme: 'dark',
            notifications: true,
          },
          tags: ['frontend', 'react'],
          priority: 5,
        },
      }

      const result = CreateProjectSchema.safeParse(project)
      expect(result.success).toBe(true)
    })

    it('should accept empty metadata', () => {
      const project = {
        name: 'Minimal Metadata',
        metadata: {},
      }

      const result = CreateProjectSchema.safeParse(project)
      expect(result.success).toBe(true)
    })
  })
})
