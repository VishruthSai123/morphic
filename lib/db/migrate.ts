import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()

// This script is used to run migrations on the database
// Run it with: bun run lib/db/migrate.ts

const runMigrations = async () => {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not defined in environment variables')
    process.exit(1)
  }

  const connectionString = process.env.DATABASE_URL

  // Respect DATABASE_SSL_DISABLED flag (used in Docker/local)
  // For cloud databases (Supabase, Neon, etc.), enable SSL whenever DATABASE_SSL_DISABLED is not 'true'
  const sslDisabled = process.env.DATABASE_SSL_DISABLED === 'true'
  const isCloud =
    connectionString.includes('supabase.co') ||
    connectionString.includes('supabase.com') ||
    connectionString.includes('neon.tech') ||
    connectionString.includes('sslmode=require')

  const ssl = sslDisabled
    ? false
    : isCloud || process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false

  const sql = postgres(connectionString, {
    ssl,
    prepare: false
  })

  const db = drizzle(sql)

  console.log('Running migrations...')

  try {
    await migrate(db, { migrationsFolder: 'drizzle' })
    console.log('Migrations completed successfully')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }

  await sql.end()
  process.exit(0)
}

runMigrations()
