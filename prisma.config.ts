import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Use process.env directly to allow prisma generate to run without DATABASE_URL
    // The URL is only required for migrations and runtime, not for client generation
    url: process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  },
})
