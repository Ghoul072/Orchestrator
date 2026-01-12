import { queryOptions } from '@tanstack/react-query'
import {
  getTasks,
  getTask,
  getTaskWithSubtasks,
  getTaskUpdates,
  getTaskRelations,
} from '~/server/functions/tasks'

interface GetTasksParams {
  projectId: string
  includeArchived?: boolean
  status?: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled'
  repositoryId?: string | null
  parentId?: string | null
  limit?: number
  offset?: number
}

export const tasksQueryOptions = (params: GetTasksParams) =>
  queryOptions({
    queryKey: ['tasks', params],
    queryFn: () => getTasks({ data: params }),
    enabled: !!params.projectId,
  })

export const taskQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['task', id],
    queryFn: () => getTask({ data: { id } }),
    enabled: !!id,
  })

export const taskWithSubtasksQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['task', id, 'subtasks'],
    queryFn: () => getTaskWithSubtasks({ data: { id } }),
    enabled: !!id,
  })

export const taskUpdatesQueryOptions = (taskId: string) =>
  queryOptions({
    queryKey: ['task', taskId, 'updates'],
    queryFn: () => getTaskUpdates({ data: { id: taskId } }),
    enabled: !!taskId,
  })

export const taskRelationsQueryOptions = (taskId: string) =>
  queryOptions({
    queryKey: ['task', taskId, 'relations'],
    queryFn: () => getTaskRelations({ data: { id: taskId } }),
    enabled: !!taskId,
  })

// Simple query for all tasks in a project (for dependency picker)
export const allTasksInProjectQueryOptions = (projectId: string) =>
  queryOptions({
    queryKey: ['tasks', projectId, 'all'],
    queryFn: () => getTasks({ data: { projectId, includeArchived: false } }),
    enabled: !!projectId,
  })
