import { authConfig } from './config'

/**
 * Session data stored in the cookie
 */
export interface SessionData {
  userId: string
  email: string
  name: string | null
  accessToken: string
  expiresAt: number
  createdAt: number
}

/**
 * Sign session data using HMAC-SHA256
 */
export async function signSession(data: SessionData): Promise<string> {
  const payload = JSON.stringify(data)
  const payloadBase64 = btoa(payload)

  const encoder = new TextEncoder()
  const keyData = encoder.encode(authConfig.sessionSecret)
  const messageData = encoder.encode(payloadBase64)

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, messageData)
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  return `${payloadBase64}.${signatureBase64}`
}

/**
 * Verify and parse signed session
 */
export async function verifySession(signedSession: string): Promise<SessionData | null> {
  try {
    const [payloadBase64, signatureBase64] = signedSession.split('.')
    if (!payloadBase64 || !signatureBase64) {
      return null
    }

    // Verify signature
    const encoder = new TextEncoder()
    const keyData = encoder.encode(authConfig.sessionSecret)
    const messageData = encoder.encode(payloadBase64)

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    // Reconstruct signature bytes
    const signatureStr = signatureBase64
      .replace(/-/g, '+')
      .replace(/_/g, '/')
    const paddedSignature = signatureStr + '='.repeat((4 - (signatureStr.length % 4)) % 4)
    const signatureBytes = Uint8Array.from(atob(paddedSignature), (c) => c.charCodeAt(0))

    const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, messageData)
    if (!isValid) {
      return null
    }

    // Parse payload
    const payload = JSON.parse(atob(payloadBase64)) as SessionData

    // Check expiration
    if (payload.expiresAt < Date.now()) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

/**
 * Create session cookie header value
 */
export function createSessionCookieHeader(
  signedSession: string,
  maxAge: number,
  isProduction: boolean = process.env.NODE_ENV === 'production'
): string {
  return `${authConfig.sessionCookieName}=${encodeURIComponent(signedSession)}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${isProduction ? '; Secure' : ''}`
}

/**
 * Create logout cookie header (clears the session)
 */
export function createLogoutCookieHeader(
  isProduction: boolean = process.env.NODE_ENV === 'production'
): string {
  return `${authConfig.sessionCookieName}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${isProduction ? '; Secure' : ''}`
}

/**
 * Parse session from request cookies
 */
export function getSessionFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null

  const cookies = cookieHeader.split(';').map((c) => c.trim())
  const sessionCookie = cookies.find((c) =>
    c.startsWith(`${authConfig.sessionCookieName}=`)
  )

  if (!sessionCookie) return null

  const value = sessionCookie.substring(authConfig.sessionCookieName.length + 1)
  return decodeURIComponent(value)
}
