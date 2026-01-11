import { queryOptions } from '@tanstack/react-query'
import {
  listPrompts,
  getPrompt,
  getPromptCategories,
} from '~/server/functions/prompts'

type PromptCategory = 'analysis' | 'security' | 'documentation' | 'review' | 'custom'

/**
 * Query options for listing prompts
 */
export const promptsQueryOptions = (options?: {
  category?: PromptCategory
  search?: string
}) =>
  queryOptions({
    queryKey: ['prompts', options],
    queryFn: () =>
      listPrompts({
        data: {
          category: options?.category,
          search: options?.search,
        },
      }),
  })

/**
 * Query options for a single prompt
 */
export const promptQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['prompt', id],
    queryFn: () => getPrompt({ data: { id } }),
    enabled: !!id,
  })

/**
 * Query options for prompt categories
 */
export const promptCategoriesQueryOptions = () =>
  queryOptions({
    queryKey: ['prompt-categories'],
    queryFn: () => getPromptCategories({}),
  })
