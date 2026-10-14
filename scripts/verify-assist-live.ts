import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createAdminClient } from '../lib/supabase/admin'
import { POST as imagesPOST } from '../app/api/assist/images/route'
import { POST as queryPOST } from '../app/api/assist/query/route'

async function getTestUserToken(): Promise<{ token: string; userId: string; cleanup: () => Promise<void> }> {
  console.log('Obtaining authenticated test user JWT from Supabase...')
  const admin = createAdminClient()
  const testEmail = `test_assist_${Date.now()}@example.com`
  const testPassword = 'Password123!@#'

  const { data: userData, error: createError } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true
  })

  if (createError || !userData.user) {
    throw new Error(`Failed to create test user: ${createError?.message}`)
  }

  const { data: sessionData, error: loginError } = await admin.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  })

  if (loginError || !sessionData.session) {
    throw new Error(`Failed to sign in test user: ${loginError?.message}`)
  }

  const cleanup = async () => {
    await admin.auth.admin.deleteUser(userData.user.id)
  }

  return {
    token: sessionData.session.access_token,
    userId: userData.user.id,
    cleanup
  }
}

async function testLiveImagesEndpoint(token: string) {
  console.log('\n--- 1. Testing Live /api/assist/images Endpoint ---')
  const req = new Request('http://localhost:3000/api/assist/images', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ query: 'space telescope galaxy', maxResults: 3 })
  })

  const res = await imagesPOST(req)
  console.log('Status code:', res.status)
  const data = await res.json()
  console.log('Response payload:', {
    query: data.query,
    count: data.count,
    sampleImage: data.images?.[0]
  })

  if (res.status !== 200 || !data.images || data.images.length === 0) {
    throw new Error(`Images endpoint failed: ${JSON.stringify(data)}`)
  }
  console.log('✓ /api/assist/images returned live Tavily images successfully!')
}

async function testLiveAssistQueryEndpoint(token: string) {
  console.log('\n--- 2. Testing Live /api/assist/query SSE Stream ---')
  const req = new Request('http://localhost:3000/api/assist/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      query: 'What is the speed of light? Answer in one short sentence.',
      mode: 'ambient_companion'
    })
  })

  const res = await queryPOST(req)
  console.log('Status code:', res.status)
  console.log('Content-Type:', res.headers.get('Content-Type'))

  if (res.status !== 200) {
    const errText = await res.text()
    throw new Error(`Query endpoint returned HTTP ${res.status}: ${errText}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('No readable stream body')

  const decoder = new TextDecoder()
  let totalChunks = 0
  let eventsReceived: string[] = []
  let fullAnswer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    totalChunks++
    const text = decoder.decode(value, { stream: true })
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('event: ')) {
        const evt = lines[i].replace('event: ', '').trim()
        eventsReceived.push(evt)
        const nextLine = lines[i + 1]
        if (nextLine && nextLine.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(nextLine.replace('data: ', ''))
            if (evt === 'answer_chunk' && parsed.text) {
              fullAnswer += parsed.text
            }
          } catch {}
        }
      }
    }
  }

  console.log('Total stream chunks received:', totalChunks)
  console.log('Unique SSE events received:', Array.from(new Set(eventsReceived)))
  console.log('Streamed Answer:', fullAnswer.trim())

  if (eventsReceived.length === 0 || fullAnswer.length === 0) {
    throw new Error('SSE stream was empty or failed to emit answer_chunk')
  }

  console.log('✓ /api/assist/query SSE stream is 100% operational with Gemini + Tavily!')
}

async function main() {
  let cleanupFn: (() => Promise<void>) | null = null
  try {
    const { token, userId, cleanup } = await getTestUserToken()
    cleanupFn = cleanup
    console.log(`Authenticated as test user: ${userId}`)

    await testLiveImagesEndpoint(token)
    await testLiveAssistQueryEndpoint(token)

    console.log('\n======================================================')
    console.log('🎉 FULL END-TO-END MOBILE ASSISTANT PIPELINE VERIFIED!')
    console.log('   - Supabase Bearer Auth: ✔')
    console.log('   - Tavily Cloud Search & Images: ✔')
    console.log('   - Google Gemini 2.5 LLM Streaming: ✔')
    console.log('   - Upstash Serverless Redis: ✔')
    console.log('======================================================\n')
  } catch (err) {
    console.error('\n❌ Live Test Failed:', err)
    process.exit(1)
  } finally {
    if (cleanupFn) {
      await cleanupFn()
      console.log('Cleaned up temporary test user.')
    }
  }
}

main()
