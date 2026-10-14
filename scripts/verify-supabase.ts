import dotenv from 'dotenv'
import postgres from 'postgres'

dotenv.config({ path: '.env.local' })
dotenv.config()

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is not set!')
  process.exit(1)
}

const sql = postgres(connectionString, {
  ssl: { rejectUnauthorized: false },
  prepare: false
})

async function run() {
  console.log('=== Step 1: Checking Existing Tables in Public Schema ===')
  const tables = await sql<
    { tablename: string; rowsecurity: boolean; forcerowsecurity: boolean }[]
  >`
    SELECT 
      c.relname as tablename,
      c.relrowsecurity as rowsecurity,
      c.relforcerowsecurity as forcerowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname;
  `

  console.log(`Found ${tables.length} tables in public schema:`)
  for (const t of tables) {
    console.log(
      `  - ${t.tablename.padEnd(28)} | RLS: ${t.rowsecurity} | Forced: ${t.forcerowsecurity}`
    )
  }

  const requiredTables = [
    'chats',
    'messages',
    'parts',
    'notes',
    'files',
    'feedback',
    'usage_grants',
    'usage_events',
    'additional_usage_interest'
  ]

  const existingNames = new Set(tables.map(t => t.tablename))
  for (const req of requiredTables) {
    if (!existingNames.has(req)) {
      throw new Error(`Missing expected table: ${req}`)
    }
  }
  console.log('✔ All 9 required application tables exist.')

  console.log(
    '\n=== Step 2: Applying RLS Hardening (FORCE ROW LEVEL SECURITY) ==='
  )
  const sensitiveTables = [
    'chats',
    'messages',
    'parts',
    'notes',
    'files',
    'usage_grants'
  ]
  for (const tbl of sensitiveTables) {
    await sql.unsafe(`ALTER TABLE "${tbl}" FORCE ROW LEVEL SECURITY;`)
    console.log(`  ✔ Forced RLS on "${tbl}"`)
  }

  console.log('\n=== Step 3: Verifying RLS Policies on Sensitive Tables ===')
  const policies = await sql<
    {
      tablename: string
      policyname: string
      permissive: string
      roles: string
      cmd: string
    }[]
  >`
    SELECT tablename, policyname, permissive, roles, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `
  console.log(`Found ${policies.length} active RLS policies:`)
  for (const p of policies) {
    console.log(`  - [${p.tablename}] ${p.policyname} (${p.cmd})`)
  }

  console.log('\n=== Step 4: Live Cross-Tenant Multi-User Isolation Test ===')
  const testChatId = `test_chat_${Date.now()}`
  const userAlpha = 'user_alpha_phase2_test'
  const userBeta = 'user_beta_phase2_test'

  // User Alpha creates a private chat
  await sql.begin(async tx => {
    await tx`SET LOCAL ROLE authenticated;`
    await tx`SELECT set_config('app.current_user_id', ${userAlpha}, true);`
    await tx`
      INSERT INTO chats (id, title, user_id, visibility)
      VALUES (${testChatId}, 'User Alpha Secret Chat', ${userAlpha}, 'private');
    `
  })
  console.log(`  ✔ User Alpha created private chat "${testChatId}"`)

  // User Beta tries to read User Alpha's chat
  const userBetaResults = await sql.begin(async tx => {
    await tx`SET LOCAL ROLE authenticated;`
    await tx`SELECT set_config('app.current_user_id', ${userBeta}, true);`
    return await tx`
      SELECT id, title FROM chats WHERE id = ${testChatId};
    `
  })

  if (userBetaResults.length === 0) {
    console.log(
      '  ✔ SUCCESS: User Beta received 0 rows! RLS blocked cross-user access.'
    )
  } else {
    throw new Error(
      'FAILED: User Beta was able to read User Alpha private chat! RLS breach detected.'
    )
  }

  // User Alpha reads their own chat
  const userAlphaResults = await sql.begin(async tx => {
    await tx`SET LOCAL ROLE authenticated;`
    await tx`SELECT set_config('app.current_user_id', ${userAlpha}, true);`
    return await tx`
      SELECT id, title FROM chats WHERE id = ${testChatId};
    `
  })

  if (userAlphaResults.length === 1 && userAlphaResults[0].id === testChatId) {
    console.log('  ✔ SUCCESS: User Alpha can read their own chat.')
  } else {
    throw new Error('FAILED: User Alpha could not read their own chat!')
  }

  // Clean up
  await sql.begin(async tx => {
    await tx`SELECT set_config('app.current_user_id', ${userAlpha}, true);`
    await tx`DELETE FROM chats WHERE id = ${testChatId};`
  })
  console.log('  ✔ Test fixture cleaned up successfully.')

  console.log('\n=== Step 5: Testing Supabase Auth API Endpoint ===')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  const serviceKey = process.env.SUPABASE_SECRET_KEY!

  // Ping Supabase Auth settings endpoint
  const authResponse = await fetch(`${supabaseUrl}/auth/v1/settings`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`
    }
  })

  if (authResponse.ok) {
    const authData = await authResponse.json()
    console.log('  ✔ Supabase Auth API is reachable and responding!')
    console.log(
      '  ✔ Auth providers supported:',
      Object.keys(authData.external || {}).join(', ') || 'email'
    )
  } else {
    console.warn(
      '  ⚠ Supabase Auth ping returned status:',
      authResponse.status
    )
  }

  console.log('\n======================================================')
  console.log('🎉 PHASE 2 DATABASE & RLS VERIFICATION COMPLETED 100%!')
  console.log('======================================================')

  await sql.end()
}

run().catch(err => {
  console.error('\n❌ Verification failed with error:', err)
  process.exit(1)
})
