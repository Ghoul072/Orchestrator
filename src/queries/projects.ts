import { queryOptions } from '@tanstack/react-query'
import {
  getProjects,
  getProject,
  getProjectWithTags,
  getProjectStats,
} from '~/server/functions/projects'

export const projectsQueryOptions = () =>
  queryOptions({
    queryKey: ['projects'],
    queryFn: () => getProjects(),
  })

export const projectQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['project', id],
    queryFn: () => getProject({ data: { id } }),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // Keep project data fresh for 5 minutes
  })

export const projectWithTagsQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['project', id, 'tags'],
    queryFn: () => getProjectWithTags({ data: { id } }),
    enabled: !!id,
  })

export const projectStatsQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['project', id, 'stats'],
    queryFn: () => getProjectStats({ data: { id } }),
    enabled: !!id,
  })
