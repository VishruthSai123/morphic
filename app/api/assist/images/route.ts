/**
 * Mobile Image Search Endpoint — `/api/assist/images`
 *
 * Lightweight, fast image retrieval for the Morphic Android client.
 * Designed specifically for Journey 2 (voice-to-image insertion):
 *
 *   User speaks: "Find diagram of plant cell structure"
 *   → Morphic queries images directly (no LLM synthesis)
 *   → Returns image candidates in <300ms
 *   → User taps to insert via Android InputContentInfoCompat
 *
 * Supports both GET (query params) and POST (JSON body).
 * Always returns JSON (not SSE) for simple consumption.
 *
 * Authentication: Same dual-mode as `/api/assist/query`.
 *
 * @see /ANDROID_FEATURES_SPEC.md for IME image insertion specs.
 */

import {
  corsErrorResponse,
  handleCorsPreflightRequest,
  mobileCorsHeaders
} from '@/lib/api/mobile-cors'
import { resolveMobileAuth } from '@/lib/api/mobile-auth'
import { createSearchProvider } from '@/lib/tools/search/providers'

export const maxDuration = 30

// ─── Types ───────────────────────────────────────────────────────────────────

interface ImageResult {
  id: string
  thumb: string
  thumbnailUrl: string
  full: string
  fullUrl: string
  title: string
  sourceUrl?: string
  domain?: string
  sourceDomain?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

// ─── CORS Pre-flight ─────────────────────────────────────────────────────────

export async function OPTIONS() {
  return handleCorsPreflightRequest()
}

// ─── Shared handler for GET and POST ─────────────────────────────────────────

async function handleImageSearch(
  query: string,
  limit: number
): Promise<Response> {
  const startTime = performance.now()

  const provider = createSearchProvider()

  try {
    const results = await provider.search(
      query,
      limit,
      'basic',
      [], // includeDomains
      [], // excludeDomains
      { content_types: ['image'] }
    )

    const images: ImageResult[] = results.images
      .slice(0, limit)
      .map((img, idx) => {
        if (typeof img === 'string') {
          const domain = extractDomain(img)
          return {
            id: `img_${idx + 1}`,
            thumb: img,
            thumbnailUrl: img,
            full: img,
            fullUrl: img,
            title: '',
            domain,
            sourceDomain: domain
          }
        }
        const imgUrl = img.url
        const domain = extractDomain(img.sourceUrl || imgUrl)
        return {
          id: `img_${idx + 1}`,
          thumb: imgUrl,
          thumbnailUrl: imgUrl,
          full: imgUrl,
          fullUrl: imgUrl,
          title: img.description || img.title || '',
          sourceUrl: img.sourceUrl,
          domain,
          sourceDomain: domain
        }
      })
      .filter(img => img.full.startsWith('http'))

    const durationMs = Math.round(performance.now() - startTime)

    return new Response(
      JSON.stringify({
        query,
        images,
        total: images.length,
        durationMs
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300', // 5 min cache for images
          ...mobileCorsHeaders
        }
      }
    )
  } catch (err) {
    console.error('[AssistImages] Search failed:', err)
    return corsErrorResponse(
      'Image search failed. Please try again.',
      502,
      'search_error'
    )
  }
}

// ─── GET Handler ─────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  // Authenticate
  const auth = await resolveMobileAuth(req)
  if (!auth.authenticated) {
    return corsErrorResponse(auth.error || 'Unauthorized', 401, 'unauthorized')
  }

  // Parse query params
  const url = new URL(req.url)
  const query = url.searchParams.get('q')?.trim()
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '6', 10), 20)

  if (!query) {
    return corsErrorResponse(
      'Missing required query parameter "q"',
      400,
      'bad_request'
    )
  }

  return handleImageSearch(query, limit)
}

// ─── POST Handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // Authenticate
  const auth = await resolveMobileAuth(req)
  if (!auth.authenticated) {
    return corsErrorResponse(auth.error || 'Unauthorized', 401, 'unauthorized')
  }

  // Parse body
  let body: { query?: string; limit?: number }
  try {
    body = await req.json()
  } catch {
    return corsErrorResponse('Invalid JSON body', 400, 'bad_request')
  }

  const query = body.query?.trim()
  const limit = Math.min(body.limit ?? 6, 20)

  if (!query) {
    return corsErrorResponse(
      'Missing required "query" field',
      400,
      'bad_request'
    )
  }

  return handleImageSearch(query, limit)
}
