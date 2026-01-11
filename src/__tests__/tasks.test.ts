import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Schema definitions from server functions for validation testing
const TaskStatusSchema = z.enum(['pending', 'in_progress', 'blocked', 'completed', 'cancelled'])
const TaskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent'])
const TaskEffortSchema = z.enum(['xs', 'sm', 'md', 'lg', 'xl'])
const TaskRelationTypeSchema = z.enum(['blocks', 'blocked_by', 'relates_to', 'duplicates'])
const TaskUpdateTypeSchema = z.enum(['progress', 'blocker', 'question', 'completion'])

const CreateTaskSchema = z.object({
  projectId: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: TaskStatusSchema.optional(),
  priority: TaskPrioritySchema.optional(),
  effort: TaskEffortSchema.optional(),
  assignee: z.string().optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  dueDate: z.string().optional(),
})

const UpdateTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: TaskStatusSchema.optional(),
  priority: TaskPrioritySchema.optional(),
  effort: TaskEffortSchema.optional(),
  assignee: z.string().optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  dueDate: z.string().nullable().optional(),
  isArchived: z.boolean().optional(),
  autoStartWhenUnblocked: z.boolean().optional(),
})

const AddTaskUpdateSchema = z.object({
  taskId: z.string().uuid(),
  content: z.string().min(1),
  updateType: TaskUpdateTypeSchema.optional(),
  author: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

const TaskRelationSchema = z.object({
  sourceTaskId: z.string().uuid(),
  targetTaskId: z.string().uuid(),
  relationType: TaskRelationTypeSchema,
})

describe('Task Validation Schemas', () => {
  describe('CreateTaskSchema', () => {
    it('should accept valid task data', () => {
      const validTask = {
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Implement user authentication',
        description: 'Add OAuth 2.0 authentication flow',
        priority: 'high',
        status: 'pending',
      }

      const result = CreateTaskSchema.safeParse(validTask)
      expect(result.success).toBe(true)
    })

    it('should reject empty title', () => {
      const invalidTask = {
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        title: '',
      }

      const result = CreateTaskSchema.safeParse(invalidTask)
      expect(result.success).toBe(false)
    })

    it('should reject title over 500 characters', () => {
      const invalidTask = {
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'a'.repeat(501),
      }

      const result = CreateTaskSchema.safeParse(invalidTask)
      expect(result.success).toBe(false)
    })

    it('should accept task with acceptance criteria', () => {
      const taskWithCriteria = {
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Build login form',
        acceptanceCriteria: [
          'Form validates email format',
          'Password has minimum 8 characters',
          'Error messages are displayed',
        ],
      }

      const result = CreateTaskSchema.safeParse(taskWithCriteria)
      expect(result.success).toBe(true)
    })

    it('should accept subtask with parentId', () => {
      const subtask = {
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        parentId: '660e8400-e29b-41d4-a716-446655440000',
        title: 'Subtask under parent',
      }

      const result = CreateTaskSchema.safeParse(subtask)
      expect(result.success).toBe(true)
    })

    it('should accept task with effort estimation', () => {
      const taskWithEffort = {
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Small bug fix',
        effort: 'xs',
      }

      const result = CreateTaskSchema.safeParse(taskWithEffort)
      expect(result.success).toBe(true)
    })
  })

  describe('UpdateTaskSchema', () => {
    it('should accept valid update', () => {
      const validUpdate = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'in_progress',
      }

      const result = UpdateTaskSchema.safeParse(validUpdate)
      expect(result.success).toBe(true)
    })

    it('should accept status transition to completed', () => {
      const completionUpdate = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'completed',
      }

      const result = UpdateTaskSchema.safeParse(completionUpdate)
      expect(result.success).toBe(true)
    })

    it('should accept auto-start flag', () => {
      const autoStartUpdate = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        autoStartWhenUnblocked: true,
      }

      const result = UpdateTaskSchema.safeParse(autoStartUpdate)
      expect(result.success).toBe(true)
    })

    it('should accept clearing due date', () => {
      const clearDueDateUpdate = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        dueDate: null,
      }

      const result = UpdateTaskSchema.safeParse(clearDueDateUpdate)
      expect(result.success).toBe(true)
    })
  })

  describe('TaskRelationSchema', () => {
    it('should accept valid blocking relation', () => {
      const blockingRelation = {
        sourceTaskId: '550e8400-e29b-41d4-a716-446655440000',
        targetTaskId: '660e8400-e29b-41d4-a716-446655440000',
        relationType: 'blocks',
      }

      const result = TaskRelationSchema.safeParse(blockingRelation)
      expect(result.success).toBe(true)
    })

    it('should accept blocked_by relation', () => {
      const blockedByRelation = {
        sourceTaskId: '550e8400-e29b-41d4-a716-446655440000',
        targetTaskId: '660e8400-e29b-41d4-a716-446655440000',
        relationType: 'blocked_by',
      }

      const result = TaskRelationSchema.safeParse(blockedByRelation)
      expect(result.success).toBe(true)
    })

    it('should reject invalid relation type', () => {
      const invalidRelation = {
        sourceTaskId: '550e8400-e29b-41d4-a716-446655440000',
        targetTaskId: '660e8400-e29b-41d4-a716-446655440000',
        relationType: 'invalid_type',
      }

      const result = TaskRelationSchema.safeParse(invalidRelation)
      expect(result.success).toBe(false)
    })
  })

  describe('AddTaskUpdateSchema', () => {
    it('should accept progress update', () => {
      const progressUpdate = {
        taskId: '550e8400-e29b-41d4-a716-446655440000',
        content: 'Completed initial implementation, starting tests',
        updateType: 'progress',
        author: 'developer@example.com',
      }

      const result = AddTaskUpdateSchema.safeParse(progressUpdate)
      expect(result.success).toBe(true)
    })

    it('should accept blocker update', () => {
      const blockerUpdate = {
        taskId: '550e8400-e29b-41d4-a716-446655440000',
        content: 'Waiting for API credentials from external team',
        updateType: 'blocker',
      }

      const result = AddTaskUpdateSchema.safeParse(blockerUpdate)
      expect(result.success).toBe(true)
    })

    it('should reject empty content', () => {
      const emptyUpdate = {
        taskId: '550e8400-e29b-41d4-a716-446655440000',
        content: '',
      }

      const result = AddTaskUpdateSchema.safeParse(emptyUpdate)
      expect(result.success).toBe(false)
    })
  })
})

describe('Task Status Transitions', () => {
  it('should accept all valid statuses', () => {
    const validStatuses = ['pending', 'in_progress', 'blocked', 'completed', 'cancelled']

    validStatuses.forEach((status) => {
      const result = TaskStatusSchema.safeParse(status)
      expect(result.success).toBe(true)
    })
  })

  it('should reject invalid status', () => {
    const invalidStatuses = ['done', 'todo', 'active', 'paused', 'closed']

    invalidStatuses.forEach((status) => {
      const result = TaskStatusSchema.safeParse(status)
      expect(result.success).toBe(false)
    })
  })
})

describe('Task Priority Levels', () => {
  it('should accept all priority levels', () => {
    const priorities = ['low', 'medium', 'high', 'urgent']

    priorities.forEach((priority) => {
      const result = TaskPrioritySchema.safeParse(priority)
      expect(result.success).toBe(true)
    })
  })

  it('should reject invalid priority', () => {
    const invalidPriorities = ['critical', 'normal', 'highest', '1', 'p0']

    invalidPriorities.forEach((priority) => {
      const result = TaskPrioritySchema.safeParse(priority)
      expect(result.success).toBe(false)
    })
  })
})

describe('Task Effort Estimations', () => {
  it('should accept all effort sizes', () => {
    const efforts = ['xs', 'sm', 'md', 'lg', 'xl']

    efforts.forEach((effort) => {
      const result = TaskEffortSchema.safeParse(effort)
      expect(result.success).toBe(true)
    })
  })

  it('should reject invalid effort values', () => {
    const invalidEfforts = ['xxs', 'xxl', 'small', 'large', '1', '5']

    invalidEfforts.forEach((effort) => {
      const result = TaskEffortSchema.safeParse(effort)
      expect(result.success).toBe(false)
    })
  })
})
