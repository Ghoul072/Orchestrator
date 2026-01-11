import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import { currentUserQueryOptions } from '~/queries/auth'
import { startAuth, logout } from '~/server/auth'

export interface User {
  id: string
  email: string
  name: string | null
}

export function useAuth() {
  const queryClient = useQueryClient()
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const { data: session, isLoading, error } = useQuery(currentUserQueryOptions())

  const user: User | null = session
    ? {
        id: session.userId,
        email: session.email,
        name: session.name,
      }
    : null

  const login = useCallback(async (returnUrl?: string) => {
    setIsLoggingIn(true)
    try {
      const result = await startAuth({ data: { returnUrl } })

      // Set the OAuth state cookie
      document.cookie = result.stateCookie

      // Redirect to Anthropic OAuth
      window.location.href = result.authUrl
    } catch (err) {
      setIsLoggingIn(false)
      throw err
    }
  }, [])

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true)
    try {
      const result = await logout()

      // Clear the session cookie
      document.cookie = result.logoutCookie

      // Invalidate auth queries
      await queryClient.invalidateQueries({ queryKey: ['auth'] })

      // Redirect to home
      window.location.href = '/'
    } catch (err) {
      setIsLoggingOut(false)
      throw err
    }
  }, [queryClient])

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    isLoggingIn,
    isLoggingOut,
    error,
    login,
    logout: handleLogout,
  }
}
