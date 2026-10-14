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

function parseCookieHeader(
  cookieHeader: string | null
): Record<string, string> {
  if (!cookieHeader) return {}
  const cookies: Record<string, string> = {}
  cookieHeader.split(';').forEach(pair => {
    const idx = pair.indexOf('=')
    if (idx > -1) {
      const key = pair.substring(0, idx).trim()
      const val = pair.substring(idx + 1).trim()
      cookies[key] = val
    }
  })
  return cookies
}

const TOKEN_COOKIE_REGEX = /^sb-[a-zA-Z0-9_-]+-auth-token(?:\.\d+)?$/

/**
 * Extracts a Supabase JWT from cookie chunks (e.g. sb-*-auth-token or sb-*-auth-token.0, .1).
 */
function extractTokenFromCookieMap(
  cookieMap: Record<string, string>
): string | null {
  // Strictly find auth token keys, excluding -code-verifier
  const tokenKeys = Object.keys(cookieMap).filter(
    k => TOKEN_COOKIE_REGEX.test(k) && !k.endsWith('-code-verifier')
  )

  if (tokenKeys.length === 0) return null

  // If unchunked cookie is present, use it directly
  const unchunkedKey = tokenKeys.find(k => !k.includes('.'))
  let rawValue: string

  if (unchunkedKey) {
    rawValue = cookieMap[unchunkedKey]
  } else {
    // Sort chunked keys by index (.0, .1, etc.)
    tokenKeys.sort((a, b) => {
      const aIdx = parseInt(a.slice(a.lastIndexOf('.') + 1), 10) || 0
      const bIdx = parseInt(b.slice(b.lastIndexOf('.') + 1), 10) || 0
      return aIdx - bIdx
    })
    rawValue = tokenKeys.map(k => cookieMap[k]).join('')
  }

  try {
    const raw = decodeURIComponent(rawValue)
    const jsonStr = raw.startsWith('base64-')
      ? Buffer.from(raw.slice(7), 'base64').toString('utf8')
      : raw
    const parsed = JSON.parse(jsonStr)
    if (parsed.access_token) return parsed.access_token
    if (Array.isArray(parsed) && typeof parsed[0] === 'string') return parsed[0]
  } catch {
    const jwtMatch = rawValue.match(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/
    )
    if (jwtMatch) return jwtMatch[0]
  }

  return null
}

/**
 * Resolves the user identity from an incoming mobile request.
 *
 * Priority:
 * 1. If anonymous mode is active, use `X-Morphic-Anonymous-Id` header
 *    or fall back to `ANONYMOUS_USER_ID` env var / default.
 * 2. If auth is enabled, validate `Authorization: Bearer <jwt>` or
 *    Supabase session cookies from the client against Supabase.
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

  if (!hasSupabasePublicConfig()) {
    return {
      authenticated: false,
      method: 'none',
      error:
        'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and keys.'
    }
  }

  const { createServerClient } = await import('@supabase/ssr')
  const { getSupabasePublishableKey } = await import('@/lib/supabase/keys')
  const supabaseKey = getSupabasePublishableKey()!

  // 1. Try resolving via request cookies using official @supabase/ssr client
  const cookieHeader = request.headers.get('cookie')
  const cookieMap = parseCookieHeader(cookieHeader)

  if (Object.keys(cookieMap).length > 0) {
    try {
      const ssrClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseKey,
        {
          cookies: {
            getAll() {
              return Object.entries(cookieMap).map(([name, value]) => ({
                name,
                value
              }))
            },
            setAll() {}
          }
        }
      )
      const {
        data: { user },
        error
      } = await ssrClient.auth.getUser()

      if (user && !error) {
        return {
          authenticated: true,
          userId: user.id,
          method: 'supabase_jwt'
        }
      }
    } catch (e) {
      console.warn('[MobileAuth] SSR cookie auth attempt failed:', e)
    }
  }

  // 2. Try resolving via Bearer token in Authorization header or extracted cookie JWT
  const authHeader = request.headers.get('authorization')
  let token: string | null = null

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice('Bearer '.length).trim()
  } else {
    token = extractTokenFromCookieMap(cookieMap)
  }

  if (!token) {
    return {
      authenticated: false,
      method: 'none',
      error:
        'Missing or invalid Authorization header or Supabase session cookie.'
    }
  }

  try {
    let supabase
    if (process.env.SUPABASE_SECRET_KEY) {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      supabase = createAdminClient()
    } else {
      const { createClient } = await import('@supabase/supabase-js')
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseKey,
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
    console.error('[MobileAuth] Supabase JWT validation error:', err)
    return {
      authenticated: false,
      method: 'supabase_jwt',
      error: 'Internal authentication error'
    }
  }
}
