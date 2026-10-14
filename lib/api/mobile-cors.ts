/**
 * CORS utility for mobile assistant endpoints (`/api/assist/*`).
 *
 * Native Android clients (OkHttp / Ktor) send cross-origin requests
 * that do not carry browser cookies. This module provides:
 *  1. A standard CORS headers object added to every response.
 *  2. An OPTIONS pre-flight handler that returns 204 No Content immediately.
 *
 * The wildcard origin (`*`) is intentional for development and self-hosted
 * Docker deployments. In production cloud deployments this can be locked
 * down to the app's custom scheme or a specific domain.
 */

const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Morphic-Anonymous-Id',
  'X-Morphic-Client-Version',
  'Accept'
].join(', ')

const ALLOWED_METHODS = 'GET, POST, OPTIONS'

/**
 * Standard CORS response headers for mobile assistant API routes.
 */
export const mobileCorsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': ALLOWED_METHODS,
  'Access-Control-Allow-Headers': ALLOWED_HEADERS,
  'Access-Control-Max-Age': '86400' // 24h preflight cache
}

/**
 * Handles CORS preflight (OPTIONS) requests.
 * Returns a 204 No Content response with appropriate CORS headers.
 */
export function handleCorsPreflightRequest(): Response {
  return new Response(null, {
    status: 204,
    headers: mobileCorsHeaders
  })
}

/**
 * Wraps a Response with CORS headers for mobile clients.
 * If the response is already constructed, appends CORS headers.
 */
export function withCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(mobileCorsHeaders)) {
    headers.set(key, value)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

/**
 * Creates a JSON success response with CORS headers.
 */
export function corsJsonResponse(
  data: unknown,
  status = 200,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...mobileCorsHeaders,
      ...extraHeaders
    }
  })
}

/**
 * Creates a JSON error response with CORS headers.
 */
export function corsErrorResponse(
  message: string,
  status: number,
  code?: string
): Response {
  return new Response(
    JSON.stringify({
      error: message,
      code: code ?? 'error',
      status,
      retryable: status >= 500
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...mobileCorsHeaders
      }
    }
  )
}
