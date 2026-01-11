/**
 * PKCE (Proof Key for Code Exchange) utilities
 * Used for OAuth 2.0 security
 */

/**
 * Generate a random code verifier for PKCE
 */
export function generateCodeVerifier(length: number = 64): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const randomValues = crypto.getRandomValues(new Uint8Array(length))
  let result = ''
  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i]! % charset.length]
  }
  return result
}

/**
 * Generate code challenge from verifier using SHA-256
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(hash)
}

/**
 * Generate a random state token for CSRF protection
 */
export function generateState(length: number = 32): string {
  const randomValues = crypto.getRandomValues(new Uint8Array(length))
  return base64UrlEncode(randomValues.buffer)
}

/**
 * Base64 URL encode (RFC 4648)
 */
export function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Base64 URL decode
 */
export function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const paddedBase64 = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(paddedBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
