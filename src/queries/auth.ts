import { queryOptions } from '@tanstack/react-query'
import { getCurrentUser, isAuthenticated } from '~/server/auth'

export const currentUserQueryOptions = () =>
  queryOptions({
    queryKey: ['auth', 'currentUser'],
    queryFn: () => getCurrentUser(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

export const isAuthenticatedQueryOptions = () =>
  queryOptions({
    queryKey: ['auth', 'isAuthenticated'],
    queryFn: () => isAuthenticated(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
