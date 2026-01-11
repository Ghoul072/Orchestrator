import { queryOptions } from '@tanstack/react-query'
import { getRepositories, getRepository } from '~/server/functions/repos'

export const repositoriesQueryOptions = (projectId: string) =>
  queryOptions({
    queryKey: ['repositories', projectId],
    queryFn: () => getRepositories({ data: { projectId } }),
    enabled: !!projectId,
  })

export const repositoryQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['repository', id],
    queryFn: () => getRepository({ data: { id } }),
    enabled: !!id,
  })
