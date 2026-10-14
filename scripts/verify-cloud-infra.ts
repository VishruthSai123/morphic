import dotenv from 'dotenv'
import path from 'path'
import { TavilySearchProvider } from '../lib/tools/search/providers/tavily'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function verifyUpstash() {
  console.log('\n--- 1. Testing Upstash Redis REST API ---')
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    throw new Error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN')
  }

  console.log(`Connecting to Upstash endpoint: ${url}`)
  
  // Test PING via REST
  const pingRes = await fetch(`${url}/ping`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const pingData = await pingRes.json()
  console.log('Upstash PING result:', pingData)
  if (pingData.result !== 'PONG') {
    throw new Error(`Unexpected PING response: ${JSON.stringify(pingData)}`)
  }

  // Test SET / GET / DEL
  const testKey = `morphic_test_${Date.now()}`
  const setRes = await fetch(`${url}/set/${testKey}/cloud_ready`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const setData = await setRes.json()
  console.log('Upstash SET result:', setData)

  const getRes = await fetch(`${url}/get/${testKey}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const getData = await getRes.json()
  console.log(`Upstash GET ${testKey}:`, getData)
  if (getData.result !== 'cloud_ready') {
    throw new Error(`GET value mismatch: expected 'cloud_ready', got '${getData.result}'`)
  }

  // Cleanup
  await fetch(`${url}/del/${testKey}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  console.log('✓ Upstash Serverless Redis is 100% operational!')
}

async function verifyTavily() {
  console.log('\n--- 2. Testing Tavily Search Engine API ---')
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    throw new Error('Missing TAVILY_API_KEY')
  }

  console.log(`Using Tavily API Key: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`)

  const provider = new TavilySearchProvider()
  const searchResults = await provider.search('quantum computing advances', 3, 'basic')

  console.log(`Search query executed: "${searchResults.query}"`)
  console.log(`Results returned: ${searchResults.results.length}`)
  console.log(`Images returned: ${searchResults.images.length}`)

  if (searchResults.results.length === 0) {
    throw new Error('Tavily returned 0 search results!')
  }

  console.log('Sample result title:', searchResults.results[0]?.title)
  console.log('Sample result url:', searchResults.results[0]?.url)
  if (searchResults.images.length > 0) {
    console.log('Sample image:', searchResults.images[0])
  }

  console.log('✓ Tavily Cloud Search API is 100% operational!')
}

async function main() {
  try {
    await verifyUpstash()
    await verifyTavily()
    console.log('\n======================================================')
    console.log('🎉 ALL CLOUD INFRASTRUCTURE (REDIS + SEARCH) VERIFIED!')
    console.log('======================================================\n')
  } catch (err) {
    console.error('\n❌ Verification Failed:', err)
    process.exit(1)
  }
}

main()
