import { authConfig } from './config'
import { generateCodeVerifier, generateCodeChallenge, generateState } from './pkce'

/**
 * OAuth state stored in cookie during auth flow
 */
export interface OAuthState {
  state: string
  codeVerifier: string
  returnUrl: string
}

/**
 * Token response from Anthropic
 */
export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope: string
}

/**
 * User profile from Anthropic
 */
export interface UserProfile {
  id: string
  email: string
  name: string | null
}

/**
 * Generate OAuth authorization URL with PKCE
 */
export async function generateAuthUrl(returnUrl: string = '/'): Promise<{
  url: string
  state: OAuthState
}> {
  const state = generateState()
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  const params = new URLSearchParams({
    client_id: authConfig.clientId,
    redirect_uri: authConfig.redirectUri,
    response_type: 'code',
    scope: authConfig.scopes.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: authConfig.codeChallengeMethod,
  })

  return {
    url: `${authConfig.authUrl}?${params.toString()}`,
    state: {
      state,
      codeVerifier,
      returnUrl,
    },
  }
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<TokenResponse> {
  const response = await fetch(authConfig.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: authConfig.clientId,
      redirect_uri: authConfig.redirectUri,
      code,
      code_verifier: codeVerifier,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${response.status} ${error}`)
  }

  return response.json()
}

/**
 * Fetch user profile from Anthropic
 * Note: Anthropic may not have a profile endpoint, so we may need to
 * decode the access token or use another approach
 */
export async function fetchUserProfile(accessToken: string): Promise<UserProfile> {
  // For now, we'll extract info from the token or use placeholder
  // In production, this would call the Anthropic API

  // Try to decode JWT if the access token is a JWT
  try {
    const [, payloadBase64] = accessToken.split('.')
    if (payloadBase64) {
      const payload = JSON.parse(atob(payloadBase64))
      return {
        id: payload.sub || 'unknown',
        email: payload.email || 'unknown@example.com',
        name: payload.name || null,
      }
    }
  } catch {
    // Not a JWT or invalid
  }

  // Fallback - use a hash of the token as ID
  const encoder = new TextEncoder()
  const data = encoder.encode(accessToken)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hash))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

  return {
    id: hashHex.substring(0, 32),
    email: 'user@anthropic.com',
    name: 'Claude User',
  }
}

/**
 * Serialize OAuth state for cookie
 */
export function serializeOAuthState(state: OAuthState): string {
  return btoa(JSON.stringify(state))
}

/**
 * Deserialize OAuth state from cookie
 */
export function deserializeOAuthState(encoded: string): OAuthState | null {
  try {
    return JSON.parse(atob(encoded))
  } catch {
    return null
  }
}

/**
 * Create OAuth state cookie header
 */
export function createOAuthStateCookie(
  state: OAuthState,
  isProduction: boolean = process.env.NODE_ENV === 'production'
): string {
  const encoded = serializeOAuthState(state)
  // OAuth state should expire in 10 minutes
  return `oauth_state=${encodeURIComponent(encoded)}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax${isProduction ? '; Secure' : ''}`
}

/**
 * Clear OAuth state cookie header
 */
export function clearOAuthStateCookie(
  isProduction: boolean = process.env.NODE_ENV === 'production'
): string {
  return `oauth_state=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${isProduction ? '; Secure' : ''}`
}

/**
 * Get OAuth state from request cookies
 */
export function getOAuthStateFromRequest(request: Request): OAuthState | null {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null

  const cookies = cookieHeader.split(';').map((c) => c.trim())
  const stateCookie = cookies.find((c) => c.startsWith('oauth_state='))

  if (!stateCookie) return null

  const value = stateCookie.substring('oauth_state='.length)
  return deserializeOAuthState(decodeURIComponent(value))
}
