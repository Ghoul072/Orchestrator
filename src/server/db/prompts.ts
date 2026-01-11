import { eq, desc, and, ilike, or } from 'drizzle-orm'
import { db } from '~/server/db'
import { prompts, type NewPrompt, type Prompt } from '~/server/db/schema'

// Valid category types from schema
type PromptCategory = 'analysis' | 'security' | 'documentation' | 'review' | 'custom'

// Variable type from schema
type PromptVariable = {
  name: string
  type: 'string' | 'text' | 'select'
  options?: string[]
  default?: string
}

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

/**
 * Get all prompts (with optional filters)
 */
export async function getPrompts(options?: {
  category?: PromptCategory
  search?: string
  limit?: number
  offset?: number
}): Promise<Prompt[]> {
  const conditions: ReturnType<typeof eq>[] = []

  if (options?.category) {
    conditions.push(eq(prompts.category, options.category))
  }

  let query = db
    .select()
    .from(prompts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(prompts.updatedAt))
    .limit(options?.limit ?? 100)
    .offset(options?.offset ?? 0)

  // Add search filter if provided
  if (options?.search) {
    const searchTerm = `%${options.search}%`
    query = db
      .select()
      .from(prompts)
      .where(
        and(
          conditions.length > 0 ? and(...conditions) : undefined,
          or(
            ilike(prompts.name, searchTerm),
            ilike(prompts.description, searchTerm)
          )
        )
      )
      .orderBy(desc(prompts.updatedAt))
      .limit(options?.limit ?? 100)
      .offset(options?.offset ?? 0)
  }

  return query
}

/**
 * Get a prompt by ID
 */
export async function getPromptById(id: string): Promise<Prompt | undefined> {
  const [result] = await db
    .select()
    .from(prompts)
    .where(eq(prompts.id, id))
    .limit(1)
  return result
}

/**
 * Get prompt categories (from enum)
 */
export function getPromptCategories(): PromptCategory[] {
  return ['analysis', 'security', 'documentation', 'review', 'custom']
}

// =============================================================================
// MUTATION FUNCTIONS
// =============================================================================

/**
 * Create a new prompt
 */
export async function createPrompt(data: NewPrompt): Promise<Prompt> {
  const [result] = await db.insert(prompts).values(data).returning()
  return result!
}

/**
 * Update a prompt
 */
export async function updatePrompt(
  id: string,
  data: Partial<Omit<NewPrompt, 'id' | 'createdAt'>>
): Promise<Prompt | undefined> {
  const [result] = await db
    .update(prompts)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(prompts.id, id))
    .returning()
  return result
}

/**
 * Delete a prompt
 */
export async function deletePrompt(id: string): Promise<boolean> {
  const result = await db
    .delete(prompts)
    .where(eq(prompts.id, id))
    .returning()
  return result.length > 0
}

/**
 * Duplicate a prompt
 */
export async function duplicatePrompt(id: string): Promise<Prompt | undefined> {
  const original = await getPromptById(id)
  if (!original) return undefined

  const [result] = await db
    .insert(prompts)
    .values({
      name: `${original.name} (Copy)`,
      description: original.description,
      content: original.content,
      category: original.category,
      variables: original.variables,
      isBuiltIn: false,
    })
    .returning()
  return result
}

export type { PromptCategory, PromptVariable }
