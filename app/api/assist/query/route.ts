/**
 * Mobile Assistant Query Endpoint — `/api/assist/query`
 *
 * This is the primary backend entry point for the Morphic Android client
 * (both Mode 1 Native Hub and Mode 2 Floating Overlay).
 *
 * Unlike `/api/chat` which streams Vercel AI SDK protocol parts for the
 * React web frontend, this endpoint emits standard **Server-Sent Events**
 * (SSE) that any native HTTP client can consume directly:
 *
 *   event: status        → Research progress updates
 *   event: answer_chunk  → Streamed answer text fragments
 *   event: links         → Top canonical source links with metadata
 *   event: images        → Image results with thumbnail + full URLs
 *   event: done          → Session complete, includes sessionId + timing
 *   event: error         → Structured error payload
 *
 * Authentication:
 *   - Docker/self-hosted: X-Morphic-Anonymous-Id header (or defaults)
 *   - Cloud production:   Authorization: Bearer <supabase_jwt>
 *
 * @see /superior.md §7.2 for the full API contract specification.
 */

import { streamText } from 'ai'

import {
  corsErrorResponse,
  handleCorsPreflightRequest,
  mobileCorsHeaders,
  withCorsHeaders
} from '@/lib/api/mobile-cors'
import { resolveMobileAuth } from '@/lib/api/mobile-auth'
import { createSearchProvider } from '@/lib/tools/search/providers'
import { SearchResults, SearchResultItem } from '@/lib/types'
import { getModel, isProviderEnabled } from '@/lib/utils/registry'
import { DEFAULT_MODEL } from '@/lib/config/default-model'

export const maxDuration = 120

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AssistQueryMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AssistQueryPayload {
  query?: string
  messages?: AssistQueryMessage[]
  chatId?: string
  mode?: 'ambient_companion' | 'hub_research' | 'chat'
  targetContext?: {
    packageName?: string
    selectedText?: string | null
    inputFieldText?: string | null
  }
  options?: {
    includeLinks?: boolean
    includeImages?: boolean
    maxResults?: number
    searchDepth?: 'basic' | 'advanced'
    modelId?: string
  }
}

interface SSELink {
  title: string
  url: string
  domain: string
  favicon: string
}

interface SSEImage {
  id: string
  thumb: string
  thumbnailUrl: string
  full: string
  fullUrl: string
  title: string
  domain?: string
  sourceDomain?: string
  sourceUrl?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function buildFaviconUrl(url: string): string {
  const domain = extractDomain(url)
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
}

function mapResultsToLinks(
  results: SearchResultItem[],
  max: number
): SSELink[] {
  return results.slice(0, max).map(r => ({
    title: r.title,
    url: r.url,
    domain: extractDomain(r.url),
    favicon: buildFaviconUrl(r.url)
  }))
}

function mapImagesToSSE(
  images: SearchResults['images'],
  max: number
): SSEImage[] {
  return images
    .slice(0, max)
    .map((img, idx) => {
      const url = typeof img === 'string' ? img : img.url
      const title =
        typeof img === 'string' ? '' : img.description || img.title || ''
      const sourceUrl = typeof img === 'string' ? undefined : img.sourceUrl
      const domain = extractDomain(sourceUrl || url)
      return {
        id: `img_${idx + 1}`,
        thumb: url,
        thumbnailUrl: url,
        full: url,
        fullUrl: url,
        title,
        domain,
        sourceDomain: domain,
        sourceUrl
      }
    })
    .filter(img => img.full.startsWith('http'))
}

function resolveModelId(requestedModelId?: string): string {
  if (requestedModelId) {
    // If it already contains a provider prefix (e.g. "google:gemini-2.5-flash"),
    // use it directly. Otherwise, assume it's a raw model id and try to match
    // against an enabled provider.
    if (requestedModelId.includes(':')) {
      return requestedModelId
    }
    if (isProviderEnabled(DEFAULT_MODEL.providerId)) {
      return `${DEFAULT_MODEL.providerId}:${requestedModelId}`
    }
    if (isProviderEnabled('google')) {
      return `google:${requestedModelId}`
    }
  }

  // 1. If the default provider (OpenAI) is enabled, use DEFAULT_MODEL
  if (isProviderEnabled(DEFAULT_MODEL.providerId)) {
    return `${DEFAULT_MODEL.providerId}:${DEFAULT_MODEL.id}`
  }

  // 2. Otherwise fall back to available enabled providers
  if (isProviderEnabled('google')) {
    return 'google:gemini-2.5-flash'
  }
  if (isProviderEnabled('anthropic')) {
    return 'anthropic:claude-3-5-sonnet-latest'
  }
  if (isProviderEnabled('openai-compatible')) {
    return 'openai-compatible:default'
  }

  return `${DEFAULT_MODEL.providerId}:${DEFAULT_MODEL.id}`
}

// ─── Mobile-Optimized System Prompt ──────────────────────────────────────────

function buildMobileSystemPrompt(
  mode: AssistQueryPayload['mode'],
  targetContext?: AssistQueryPayload['targetContext']
): string {
  const currentDate = new Date().toLocaleDateString()
  const contextBlock = targetContext?.selectedText
    ? `\nThe user has selected the following text in ${targetContext.packageName || 'an app'}:\n"${targetContext.selectedText}"\n`
    : targetContext?.inputFieldText
      ? `\nThe user is typing in ${targetContext.packageName || 'an app'}: "${targetContext.inputFieldText}"\n`
      : ''

  const modeInstruction =
    mode === 'ambient_companion'
      ? `You are an ambient mobile companion. Be extremely concise and direct. Format for a small mobile overlay:
- Lead with a 1-2 sentence summary capsule
- Use bullet points for key facts
- Keep total response under 150 words
- Prioritize actionable, insertable text the user can paste into their current app`
      : mode === 'hub_research'
        ? `You are a thorough research assistant in a full-screen mobile app. Provide comprehensive, well-structured answers with clear section headings and supporting evidence.`
        : `You are a helpful conversational assistant on mobile. Be clear, concise, and friendly.`

  return `${modeInstruction}
${contextBlock}
Current date: ${currentDate}

Instructions:
- ALWAYS respond in the user's language.
- When citing information, mention the source naturally in your text.
- Never reveal your model name or provider. You are Morphic.`
}

// ─── CORS Pre-flight ─────────────────────────────────────────────────────────

export async function OPTIONS() {
  return handleCorsPreflightRequest()
}

// ─── Main POST Handler ──────────────────────────────────────────────────────

export async function POST(req: Request) {
  const startTime = performance.now()

  // 1. Authenticate
  const auth = await resolveMobileAuth(req)
  if (!auth.authenticated) {
    return corsErrorResponse(auth.error || 'Unauthorized', 401, 'unauthorized')
  }

  // 2. Parse & validate body
  let body: AssistQueryPayload
  try {
    body = await req.json()
  } catch {
    return corsErrorResponse('Invalid JSON body', 400, 'bad_request')
  }

  const {
    query: inputQuery,
    messages,
    chatId,
    mode = 'ambient_companion',
    targetContext,
    options
  } = body

  const rawQuery = inputQuery?.trim()
  const lastUserMsg = messages
    ?.filter(m => m.role === 'user')
    .slice(-1)[0]
    ?.content?.trim()

  const query = rawQuery || lastUserMsg

  if (!query || query.length === 0) {
    return corsErrorResponse(
      'Missing or empty "query" field',
      400,
      'bad_request'
    )
  }

  const includeLinks = options?.includeLinks !== false
  const includeImages = options?.includeImages !== false
  const maxResults = Math.min(options?.maxResults ?? 5, 10)
  const searchDepth = options?.searchDepth ?? 'basic'

  // 3. Resolve model
  const modelId = resolveModelId(options?.modelId)
  const providerId = modelId.split(':')[0]

  if (!isProviderEnabled(providerId)) {
    return corsErrorResponse(
      `AI provider "${providerId}" is not configured. Check your API keys.`,
      503,
      'provider_unavailable'
    )
  }

  let languageModel
  try {
    languageModel = getModel(modelId)
  } catch (err) {
    console.error('[AssistQuery] Failed to resolve model:', err)
    return corsErrorResponse(
      `Model "${modelId}" is not available`,
      503,
      'model_unavailable'
    )
  }

  // 4. Build SSE response stream
  const encoder = new TextEncoder()
  const abortSignal = req.signal

  const stream = new ReadableStream({
    async start(controller) {
      // Send immediate keep-alive comment so cellular and mobile proxies do not time out
      controller.enqueue(encoder.encode(': ping\n\n'))

      const emit = (event: string, data: unknown) => {
        if (abortSignal.aborted) return
        controller.enqueue(encoder.encode(sseEvent(event, data)))
      }

      try {
        // ── Step A: Search ──────────────────────────────────────────────
        emit('status', {
          step: 'searching',
          message: 'Searching the web...'
        })

        const searchProvider = createSearchProvider()
        let searchResults: SearchResults

        try {
          searchResults = await searchProvider.search(
            query,
            maxResults,
            searchDepth,
            [], // includeDomains
            [], // excludeDomains
            { type: 'general', content_types: ['web', 'image'] }
          )
        } catch (searchErr) {
          console.error('[AssistQuery] Search failed:', searchErr)
          // Continue without search results — the LLM will answer from memory
          searchResults = { results: [], images: [], query }
        }

        // Emit links immediately if available
        if (includeLinks && searchResults.results.length > 0) {
          emit('links', {
            links: mapResultsToLinks(searchResults.results, maxResults)
          })
        }

        // Emit images immediately if available
        if (includeImages && searchResults.images.length > 0) {
          emit('images', {
            images: mapImagesToSSE(searchResults.images, maxResults)
          })
        }

        // ── Step B: LLM Synthesis ───────────────────────────────────────
        emit('status', {
          step: 'synthesizing',
          message: 'Generating answer...'
        })

        // Build context from search results for the LLM
        const searchContext =
          searchResults.results.length > 0
            ? searchResults.results
                .map(
                  (r, i) =>
                    `[Source ${i + 1}: ${r.title}](${r.url})\n${r.content}`
                )
                .join('\n\n')
            : ''

        const userMessage = searchContext
          ? `Based on the following search results, answer the user's question.\n\nSearch Results:\n${searchContext}\n\nUser Question: ${query}`
          : query

        const systemPrompt = buildMobileSystemPrompt(mode, targetContext)

        // Support multi-turn history when messages are passed
        const hasHistory = Array.isArray(messages) && messages.length > 1
        const streamOptions = hasHistory
          ? {
              model: languageModel,
              system: systemPrompt,
              messages: [
                ...messages.slice(0, -1).map(m => ({
                  role: m.role as 'user' | 'assistant',
                  content: m.content
                })),
                { role: 'user' as const, content: userMessage }
              ],
              abortSignal
            }
          : {
              model: languageModel,
              system: systemPrompt,
              prompt: userMessage,
              abortSignal
            }

        const result = streamText(streamOptions)

        // Stream answer chunks as they arrive
        for await (const textPart of result.textStream) {
          if (abortSignal.aborted) break
          if (textPart) {
            emit('answer_chunk', { text: textPart })
          }
        }

        // ── Step C: Done ────────────────────────────────────────────────
        const durationMs = Math.round(performance.now() - startTime)
        const finalSessionId = chatId || `sess_${Date.now()}`
        emit('done', {
          sessionId: finalSessionId,
          chatId: finalSessionId,
          durationMs,
          userId: auth.userId,
          resultCount: searchResults.results.length,
          imageCount: searchResults.images.length
        })
      } catch (err) {
        if (!abortSignal.aborted) {
          console.error('[AssistQuery] Stream error:', err)
          emit('error', {
            message:
              err instanceof Error ? err.message : 'Internal server error',
            code: 'stream_error'
          })
        }
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
      ...mobileCorsHeaders
    }
  })
}
