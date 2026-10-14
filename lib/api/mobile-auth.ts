/**
 * Dual-mode authentication resolver for mobile assistant endpoints.
 *
 * Mobile clients authenticate via one of two mechanisms:
 *
 * 1. **Self-Hosted / Docker (`ENABLE_AUTH=false`):**
 *    The client sends `X-Morphic-Anonymous-Id: <device-id>` (or omits it
 *    entirely, falling back to the configured `ANONYMOUS_USER_ID`).
 *
 * 2. **Production Cloud (`ENABLE_AUTH=true`):**
 *    The client sends `Authorization: Bearer <supabase_jwt>`.
 *    The JWT is validated against Supabase to resolve the real userId.
 *
 * This module is intentionally decoupled from Next.js cookie-based auth
 * (`lib/auth/get-current-user.ts`) because native Android HTTP clients
 * do not carry browser cookies.
 */

import { hasSupabasePublicConfig } from '@/lib/supabase/keys'

export const DEFAULT_ANONYMOUS_USER_ID = 'anonymous-user'

/**
 * Checks whether the server is running in anonymous mode.
 * Enforces the MORPHIC_CLOUD_DEPLOYMENT guard identically to web auth.
 */
export function isMobileAnonymousMode(): boolean {
  const configured = process.env.AUTH_PROVIDER?.trim()
  const isAnon = configured
    ? configured === 'none'
    : process.env.ENABLE_AUTH === 'false'

  if (isAnon && process.env.MORPHIC_CLOUD_DEPLOYMENT === 'true') {
    throw new Error(
      'ENABLE_AUTH=false is not allowed in MORPHIC_CLOUD_DEPLOYMENT'
    )
  }

  return isAnon
}

export interface MobileAuthResult {
  /** Whether authentication succeeded. */
  authenticated: boolean
  /** The resolved user ID (anonymous device id or Supabase uid). */
  userId?: string
  /** The authentication method used. */
  method: 'anonymous' | 'supabase_jwt' | 'none'
  /** Error message if authentication failed. */
  error?: string
}

/**
 * Resolves the user identity from an incoming mobile request.
 *
 * Priority:
 * 1. If anonymous mode is active, use `X-Morphic-Anonymous-Id` header
 *    or fall back to `ANONYMOUS_USER_ID` env var / default.
 * 2. If auth is enabled, validate `Authorization: Bearer <jwt>` against
 *    Supabase and resolve the uid.
 * 3. If neither is satisfied, return unauthenticated.
 */
export async function resolveMobileAuth(
  request: Request
): Promise<MobileAuthResult> {
  // ----- Anonymous / Self-Hosted Mode -----
  if (isMobileAnonymousMode()) {
    const deviceId =
      request.headers.get('x-morphic-anonymous-id') ||
      process.env.ANONYMOUS_USER_ID ||
      DEFAULT_ANONYMOUS_USER_ID

    return {
      authenticated: true,
      userId: deviceId,
      method: 'anonymous'
    }
  }

  // ----- Supabase JWT Mode (Production Cloud) -----
  const authHeader = request.headers.get('authorization')
  let token: string | null = null

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice('Bearer '.length).trim()
  } else {
    // Attempt cookie-based session extraction for web-to-mobile bridge requests
    const cookieHeader = request.headers.get('cookie')
    if (cookieHeader) {
      const match = cookieHeader.match(/sb-[^=]+-auth-token(?:%2E\d+)?=([^;]+)/)
      if (match && match[1]) {
        try {
          const raw = decodeURIComponent(match[1])
          const jsonStr = raw.startsWith('base64-')
            ? Buffer.from(raw.slice(7), 'base64').toString('utf8')
            : raw
          const parsed = JSON.parse(jsonStr)
          token = parsed.access_token || (Array.isArray(parsed) ? parsed[0] : null)
        } catch {
          const jwtMatch = match[1].match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)
          if (jwtMatch) token = jwtMatch[0]
        }
      }
    }
  }

  if (!token) {
    return {
      authenticated: false,
      method: 'none',
      error: 'Missing or invalid Authorization header. Expected: Bearer <jwt>'
    }
  }

  if (!hasSupabasePublicConfig()) {
    return {
      authenticated: false,
      method: 'none',
      error:
        'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and keys.'
    }
  }

  try {
    // If SUPABASE_SECRET_KEY is configured, prefer admin client;
    // otherwise fall back to standard Supabase client with publishable key.
    let supabase
    if (process.env.SUPABASE_SECRET_KEY) {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      supabase = createAdminClient()
    } else {
      const { createClient } = await import('@supabase/supabase-js')
      const { getSupabasePublishableKey } = await import('@/lib/supabase/keys')
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        getSupabasePublishableKey()!,
        {
          auth: { autoRefreshToken: false, persistSession: false }
        }
      )
    }

    const {
      data: { user },
      error
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      return {
        authenticated: false,
        method: 'supabase_jwt',
        error: error?.message ?? 'Invalid or expired JWT token'
      }
    }

    return {
      authenticated: true,
      userId: user.id,
      method: 'supabase_jwt'
    }
  } catch (err) {
    console.error('[MobileAuth] Supabase JWT validation failed:', err)
    return {
      authenticated: false,
      method: 'supabase_jwt',
      error: 'Internal authentication error'
    }
  }
}
