import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  GET as imagesGET,
  OPTIONS as imagesOPTIONS,
  POST as imagesPOST
} from '@/app/api/assist/images/route'
import {
  OPTIONS as queryOPTIONS,
  POST as queryPOST
} from '@/app/api/assist/query/route'

describe('Mobile Assist API Endpoints', () => {
  const originalEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of [
      'ENABLE_AUTH',
      'ANONYMOUS_USER_ID',
      'MORPHIC_CLOUD_DEPLOYMENT'
    ]) {
      originalEnv[key] = process.env[key]
    }
    process.env.ENABLE_AUTH = 'false'
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

  describe('CORS Preflight (OPTIONS)', () => {
    it('/api/assist/images OPTIONS returns 204 with CORS headers', async () => {
      const res = await imagesOPTIONS()
      expect(res.status).toBe(204)
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET')
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
    })

    it('/api/assist/query OPTIONS returns 204 with CORS headers', async () => {
      const res = await queryOPTIONS()
      expect(res.status).toBe(204)
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(res.headers.get('Access-Control-Allow-Headers')).toContain(
        'Authorization'
      )
    })
  })

  describe('/api/assist/images validation', () => {
    it('returns 400 when GET query parameter is missing', async () => {
      const req = new Request('http://localhost:3000/api/assist/images')
      const res = await imagesGET(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad_request')
      expect(data.error).toContain('Missing required query parameter')
    })

    it('returns 400 when POST body is missing query', async () => {
      const req = new Request('http://localhost:3000/api/assist/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const res = await imagesPOST(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad_request')
      expect(data.error).toContain('Missing required "query" field')
    })
  })

  describe('/api/assist/query validation', () => {
    it('returns 400 when POST body is not valid JSON', async () => {
      const req = new Request('http://localhost:3000/api/assist/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json'
      })
      const res = await queryPOST(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad_request')
      expect(data.error).toBe('Invalid JSON body')
    })

    it('returns 400 when POST body has empty query', async () => {
      const req = new Request('http://localhost:3000/api/assist/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '   ' })
      })
      const res = await queryPOST(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad_request')
      expect(data.error).toContain('Missing or empty "query"')
    })

    it('returns 401 when ENABLE_AUTH=true and request is unauthenticated', async () => {
      process.env.ENABLE_AUTH = 'true'
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'fake-key'

      const req = new Request('http://localhost:3000/api/assist/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'hello' })
      })
      const res = await queryPOST(req)
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.code).toBe('unauthorized')
    })
  })

  describe('Auth enforcement on images endpoint', () => {
    it('returns 401 when ENABLE_AUTH=true and request is unauthenticated', async () => {
      process.env.ENABLE_AUTH = 'true'
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'fake-key'

      const req = new Request('http://localhost:3000/api/assist/images?q=test')
      const res = await imagesGET(req)
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.code).toBe('unauthorized')
    })
  })
})
