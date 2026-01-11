import { queryOptions } from '@tanstack/react-query'
import {
  getSessionsByTask,
  getActiveSessionByTask,
  getSession,
  getActiveSessions,
} from '~/server/functions/agent-sessions'

export const sessionsByTaskQueryOptions = (taskId: string) =>
  queryOptions({
    queryKey: ['agent-sessions', 'task', taskId],
    queryFn: () => getSessionsByTask({ data: { taskId } }),
    enabled: !!taskId,
  })

export const activeSessionByTaskQueryOptions = (taskId: string) =>
  queryOptions({
    queryKey: ['agent-sessions', 'active', taskId],
    queryFn: () => getActiveSessionByTask({ data: { taskId } }),
    enabled: !!taskId,
  })

export const sessionQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['agent-sessions', id],
    queryFn: () => getSession({ data: { id } }),
    enabled: !!id,
  })

export const activeSessionsQueryOptions = () =>
  queryOptions({
    queryKey: ['agent-sessions', 'active'],
    queryFn: () => getActiveSessions(),
  })
