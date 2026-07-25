import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Prisma client with environment-aware query logging.
 *
 * - NODE_ENV=development: log all queries (useful for debugging).
 * - NODE_ENV=production:  no query logging (avoids PII/secret leakage
 *   into logs and reduces I/O overhead).
 * - test:                 only errors.
 */
const logConfig: ('query' | 'error' | 'warn' | 'info')[] =
  process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : process.env.NODE_ENV === 'test'
      ? ['error']
      : ['error', 'warn']

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: logConfig,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
