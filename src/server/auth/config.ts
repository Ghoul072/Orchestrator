/**
 * Anthropic OAuth Configuration
 * For Claude Max subscription users
 */
export const authConfig = {
  // OAuth Provider
  clientId: process.env.ANTHROPIC_OAUTH_CLIENT_ID || '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
  authUrl: 'https://claude.ai/oauth/authorize',
  tokenUrl: 'https://console.anthropic.com/v1/oauth/token',

  // Redirect URI - This is where Anthropic redirects after auth
  // For local development, we use their callback which returns the code
  redirectUri: 'https://console.anthropic.com/oauth/code/callback',

  // Scopes
  scopes: ['org:create_api_key', 'user:profile', 'user:inference'],

  // Session
  sessionCookieName: 'orchestrator_session',
  sessionDuration: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',

  // PKCE
  codeVerifierLength: 64,
  codeChallengeMethod: 'S256' as const,

  // State
  stateLength: 32,
} as const

export type AuthConfig = typeof authConfig
