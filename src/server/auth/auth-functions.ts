import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'
import { authConfig } from './config'
import {
  generateAuthUrl,
  exchangeCodeForTokens,
  fetchUserProfile,
  getOAuthStateFromRequest,
  createOAuthStateCookie,
  clearOAuthStateCookie,
} from './oauth'
import {
  signSession,
  verifySession,
  getSessionFromRequest,
  createSessionCookieHeader,
  createLogoutCookieHeader,
  type SessionData,
} from './session'

/**
 * Get the current user from session
 */
export const getCurrentUser = createServerFn({ method: 'POST' }).handler(
  async () => {
    const request = getRequest()
    const signedSession = getSessionFromRequest(request)

    if (!signedSession) {
      return null
    }

    const session = await verifySession(signedSession)
    return session
  }
)

/**
 * Check if user is authenticated
 */
export const isAuthenticated = createServerFn({ method: 'POST' }).handler(
  async () => {
    const request = getRequest()
    const signedSession = getSessionFromRequest(request)

    if (!signedSession) {
      return false
    }

    const session = await verifySession(signedSession)
    return session !== null
  }
)

/**
 * Start OAuth flow - returns the authorization URL
 */
export const startAuth = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      returnUrl: z.string().optional(),
    })
  )
  .handler(async ({ data }) => {
    const { url, state } = await generateAuthUrl(data.returnUrl || '/')

    return {
      authUrl: url,
      stateCookie: createOAuthStateCookie(state),
    }
  })

/**
 * Complete OAuth flow - exchange code for tokens
 */
export const completeAuth = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      code: z.string(),
      state: z.string(),
    })
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const storedState = getOAuthStateFromRequest(request)

    // Verify state matches
    if (!storedState || storedState.state !== data.state) {
      throw new Error('Invalid OAuth state')
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(data.code, storedState.codeVerifier)

    // Fetch user profile
    const profile = await fetchUserProfile(tokens.access_token)

    // Create session
    const sessionData: SessionData = {
      userId: profile.id,
      email: profile.email,
      name: profile.name,
      accessToken: tokens.access_token,
      expiresAt: Date.now() + authConfig.sessionDuration,
      createdAt: Date.now(),
    }

    const signedSession = await signSession(sessionData)
    const maxAge = Math.floor(authConfig.sessionDuration / 1000)

    return {
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
      },
      sessionCookie: createSessionCookieHeader(signedSession, maxAge),
      clearStateCookie: clearOAuthStateCookie(),
      returnUrl: storedState.returnUrl,
    }
  })

/**
 * Logout - clear session
 */
export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  return {
    logoutCookie: createLogoutCookieHeader(),
  }
})

/**
 * Require authentication - throws if not authenticated
 */
export const requireAuth = createServerFn({ method: 'POST' }).handler(
  async () => {
    const request = getRequest()
    const signedSession = getSessionFromRequest(request)

    if (!signedSession) {
      throw new Error('Not authenticated')
    }

    const session = await verifySession(signedSession)
    if (!session) {
      throw new Error('Session expired')
    }

    return session
  }
)

/**
 * Refresh session - extends expiration if still valid
 */
export const refreshSession = createServerFn({ method: 'POST' }).handler(
  async () => {
    const request = getRequest()
    const signedSession = getSessionFromRequest(request)

    if (!signedSession) {
      return null
    }

    const session = await verifySession(signedSession)
    if (!session) {
      return null
    }

    // Extend session expiration
    const newSessionData: SessionData = {
      ...session,
      expiresAt: Date.now() + authConfig.sessionDuration,
    }

    const newSignedSession = await signSession(newSessionData)
    const maxAge = Math.floor(authConfig.sessionDuration / 1000)

    return {
      sessionCookie: createSessionCookieHeader(newSignedSession, maxAge),
    }
  }
)
