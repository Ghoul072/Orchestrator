import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:secret@127.0.0.1:5433/orchestrator'

// Create postgres client
const client = postgres(connectionString, {
  prepare: false, // Required for serverless/edge environments
})

// Create drizzle instance with schema
export const db = drizzle(client, { schema })

// Export schema for convenience
export * from './schema'

// Export types
export type Database = typeof db
