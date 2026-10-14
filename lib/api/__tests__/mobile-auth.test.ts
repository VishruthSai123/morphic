import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_ANONYMOUS_USER_ID,
  resolveMobileAuth
} from '@/lib/api/mobile-auth'

describe('mobile-auth resolver', () => {
  const originalEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of [
      'ENABLE_AUTH',
      'ANONYMOUS_USER_ID',
      'MORPHIC_CLOUD_DEPLOYMENT'
    ]) {
      originalEnv[key] = process.env[key]
    }
  })

  afterEach(() => {
    for (const [key, val] of Object.entries(originalEnv)) {
      if (val === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = val
      }
    }
    vi.restoreAllMocks()
  })

  it('resolves anonymous user when auth is disabled and header is present', async () => {
    process.env.ENABLE_AUTH = 'false'
    const req = new Request('http://localhost:3000/api/assist/query', {
      headers: {
        'x-morphic-anonymous-id': 'device_pixel_9_abc123'
      }
    })

    const auth = await resolveMobileAuth(req)
    expect(auth.authenticated).toBe(true)
    expect(auth.userId).toBe('device_pixel_9_abc123')
    expect(auth.method).toBe('anonymous')
  })

  it('falls back to default anonymous ID when header is omitted in anonymous mode', async () => {
    process.env.ENABLE_AUTH = 'false'
    delete process.env.ANONYMOUS_USER_ID
    const req = new Request('http://localhost:3000/api/assist/query')

    const auth = await resolveMobileAuth(req)
    expect(auth.authenticated).toBe(true)
    expect(auth.userId).toBe(DEFAULT_ANONYMOUS_USER_ID)
    expect(auth.method).toBe('anonymous')
  })

  it('rejects unauthenticated request when auth is enabled and no token is passed', async () => {
    process.env.ENABLE_AUTH = 'true'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake-supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'fake-key'

    const req = new Request('http://localhost:3000/api/assist/query')
    const auth = await resolveMobileAuth(req)

    expect(auth.authenticated).toBe(false)
    expect(auth.error).toContain('Missing or invalid Authorization header')
  })

  it('rejects malformed authorization header when auth is enabled', async () => {
    process.env.ENABLE_AUTH = 'true'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake-supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'fake-key'

    const req = new Request('http://localhost:3000/api/assist/query', {
      headers: {
        Authorization: 'Basic not-a-bearer-token'
      }
    })
    const auth = await resolveMobileAuth(req)

    expect(auth.authenticated).toBe(false)
    expect(auth.error).toContain('Missing or invalid Authorization header')
  })

  it('validates a bearer token with admin client when SUPABASE_SECRET_KEY is present', async () => {
    process.env.ENABLE_AUTH = 'true'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake-supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'fake-key'
    process.env.SUPABASE_SECRET_KEY = 'fake-secret'

    const adminModule = await import('@/lib/supabase/admin')
    vi.spyOn(adminModule, 'createAdminClient').mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr_supabase_admin_123' } },
          error: null
        })
      }
    } as any)

    const req = new Request('http://localhost:3000/api/assist/query', {
      headers: {
        Authorization: 'Bearer valid_test_token'
      }
    })
    const auth = await resolveMobileAuth(req)

    expect(auth.authenticated).toBe(true)
    expect(auth.userId).toBe('usr_supabase_admin_123')
    expect(auth.method).toBe('supabase_jwt')
  })

  it('falls back to publishable key client when SUPABASE_SECRET_KEY is absent', async () => {
    process.env.ENABLE_AUTH = 'true'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake-supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'fake-key'
    delete process.env.SUPABASE_SECRET_KEY

    const supabaseJs = await import('@supabase/supabase-js')
    vi.spyOn(supabaseJs, 'createClient').mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr_supabase_public_456' } },
          error: null
        })
      }
    } as any)

    const req = new Request('http://localhost:3000/api/assist/query', {
      headers: {
        Authorization: 'Bearer valid_public_test_token'
      }
    })
    const auth = await resolveMobileAuth(req)

    expect(auth.authenticated).toBe(true)
    expect(auth.userId).toBe('usr_supabase_public_456')
    expect(auth.method).toBe('supabase_jwt')
  })
})
