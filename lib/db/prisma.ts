import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

// PrismaClient is dynamically generated - use require to avoid build-time errors
// when the Prisma client hasn't been generated yet
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const { PrismaClient } = require('@prisma/client') as { PrismaClient: new (options?: { adapter?: unknown }) => any }

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)

  return new PrismaClient({ adapter })
}

// Lazy-initialize Prisma client to avoid build-time errors
// The client is only created when first accessed, not at module load time
function getPrismaClient() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }
  return globalForPrisma.prisma
}

// Use a Proxy to lazily initialize the Prisma client on first access
// This prevents build-time errors when DATABASE_URL is not set
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const prisma: any = new Proxy({}, {
  get(_target, prop) {
    const client = getPrismaClient()
    const value = client[prop]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  },
})

export default prisma
