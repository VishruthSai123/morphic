import { describe, expect, it } from 'vitest'

import {
  corsErrorResponse,
  corsJsonResponse,
  handleCorsPreflightRequest,
  mobileCorsHeaders,
  withCorsHeaders
} from '@/lib/api/mobile-cors'

describe('mobile-cors utility', () => {
  it('defines standard mobile CORS headers', () => {
    expect(mobileCorsHeaders['Access-Control-Allow-Origin']).toBe('*')
    expect(mobileCorsHeaders['Access-Control-Allow-Methods']).toContain('GET')
    expect(mobileCorsHeaders['Access-Control-Allow-Methods']).toContain('POST')
    expect(mobileCorsHeaders['Access-Control-Allow-Methods']).toContain(
      'OPTIONS'
    )
    expect(mobileCorsHeaders['Access-Control-Allow-Headers']).toContain(
      'Authorization'
    )
    expect(mobileCorsHeaders['Access-Control-Allow-Headers']).toContain(
      'X-Morphic-Anonymous-Id'
    )
  })

  it('handles CORS preflight requests with 204 No Content', () => {
    const res = handleCorsPreflightRequest()
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('OPTIONS')
  })

  it('attaches CORS headers to an existing Response', () => {
    const original = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    const wrapped = withCorsHeaders(original)

    expect(wrapped.status).toBe(200)
    expect(wrapped.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(wrapped.headers.get('Content-Type')).toBe('application/json')
  })

  it('builds a JSON CORS response', async () => {
    const res = corsJsonResponse({ test: 123 }, 201)
    expect(res.status).toBe(201)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Content-Type')).toContain('application/json')
    const body = await res.json()
    expect(body).toEqual({ test: 123 })
  })

  it('builds a standard error CORS response', async () => {
    const res = corsErrorResponse('Invalid token', 401, 'unauthorized')
    expect(res.status).toBe(401)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    const body = await res.json()
    expect(body.error).toBe('Invalid token')
    expect(body.code).toBe('unauthorized')
    expect(body.status).toBe(401)
  })
})
