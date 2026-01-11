import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import * as promptsDb from '~/server/db/prompts'

// =============================================================================
// SCHEMAS
// =============================================================================

const PromptIdSchema = z.object({
  id: z.string().uuid(),
})

const PromptCategorySchema = z.enum([
  'analysis',
  'security',
  'documentation',
  'review',
  'custom',
])

const VariableSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'text', 'select']),
  options: z.array(z.string()).optional(),
  default: z.string().optional(),
})

const ListPromptsSchema = z.object({
  category: PromptCategorySchema.optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
})

const CreatePromptSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  content: z.string().min(1),
  category: PromptCategorySchema.optional(),
  variables: z.array(VariableSchema).optional(),
})

const UpdatePromptSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  content: z.string().min(1).optional(),
  category: PromptCategorySchema.optional(),
  variables: z.array(VariableSchema).optional(),
})

// =============================================================================
// SERVER FUNCTIONS
// =============================================================================

/**
 * List prompts with optional filters
 */
export const listPrompts = createServerFn({ method: 'POST' })
  .inputValidator(ListPromptsSchema)
  .handler(async ({ data }) => {
    return promptsDb.getPrompts({
      category: data.category,
      search: data.search,
      limit: data.limit,
      offset: data.offset,
    })
  })

/**
 * Get a single prompt
 */
export const getPrompt = createServerFn({ method: 'POST' })
  .inputValidator(PromptIdSchema)
  .handler(async ({ data }) => {
    const prompt = await promptsDb.getPromptById(data.id)
    if (!prompt) {
      throw new Error('Prompt not found')
    }
    return prompt
  })

/**
 * Get prompt categories
 */
export const getPromptCategories = createServerFn({ method: 'POST' })
  .handler(async () => {
    return promptsDb.getPromptCategories()
  })

/**
 * Create a new prompt
 */
export const createPrompt = createServerFn({ method: 'POST' })
  .inputValidator(CreatePromptSchema)
  .handler(async ({ data }) => {
    return promptsDb.createPrompt({
      name: data.name,
      description: data.description,
      content: data.content,
      category: data.category,
      variables: data.variables,
    })
  })

/**
 * Update a prompt
 */
export const updatePrompt = createServerFn({ method: 'POST' })
  .inputValidator(UpdatePromptSchema)
  .handler(async ({ data }) => {
    const { id, ...updateData } = data
    const prompt = await promptsDb.updatePrompt(id, updateData)
    if (!prompt) {
      throw new Error('Prompt not found')
    }
    return prompt
  })

/**
 * Delete a prompt
 */
export const deletePrompt = createServerFn({ method: 'POST' })
  .inputValidator(PromptIdSchema)
  .handler(async ({ data }) => {
    const deleted = await promptsDb.deletePrompt(data.id)
    if (!deleted) {
      throw new Error('Prompt not found')
    }
    return { success: true }
  })

/**
 * Duplicate a prompt
 */
export const duplicatePrompt = createServerFn({ method: 'POST' })
  .inputValidator(PromptIdSchema)
  .handler(async ({ data }) => {
    const prompt = await promptsDb.duplicatePrompt(data.id)
    if (!prompt) {
      throw new Error('Prompt not found')
    }
    return prompt
  })
