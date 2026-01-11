// Auth configuration
export { authConfig } from './config'

// PKCE utilities
export {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  base64UrlEncode,
  base64UrlDecode,
} from './pkce'

// OAuth utilities
export {
  generateAuthUrl,
  exchangeCodeForTokens,
  fetchUserProfile,
  serializeOAuthState,
  deserializeOAuthState,
  createOAuthStateCookie,
  clearOAuthStateCookie,
  getOAuthStateFromRequest,
  type OAuthState,
  type TokenResponse,
  type UserProfile,
} from './oauth'

// Session management
export {
  signSession,
  verifySession,
  createSessionCookieHeader,
  createLogoutCookieHeader,
  getSessionFromRequest,
  type SessionData,
} from './session'

// Server functions
export {
  getCurrentUser,
  isAuthenticated,
  startAuth,
  completeAuth,
  logout,
  requireAuth,
  refreshSession,
} from './auth-functions'
