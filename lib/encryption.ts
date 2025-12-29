import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { Client } from 'pg'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }
  // Key should be 32 bytes (64 hex characters) for AES-256
  const keyBuffer = Buffer.from(key, 'hex')
  if (keyBuffer.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)')
  }
  return keyBuffer
}

export interface EncryptedData {
  encrypted: string // Base64 encoded ciphertext + auth tag
  iv: string // Base64 encoded IV
}

/**
 * Encrypt a string using AES-256-GCM
 */
export function encrypt(plaintext: string): EncryptedData {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  const authTag = cipher.getAuthTag()

  // Combine ciphertext and auth tag
  const combined = Buffer.concat([
    Buffer.from(encrypted, 'base64'),
    authTag
  ])

  return {
    encrypted: combined.toString('base64'),
    iv: iv.toString('base64')
  }
}

/**
 * Decrypt a string that was encrypted with AES-256-GCM
 */
export function decrypt(encryptedData: EncryptedData): string {
  const key = getEncryptionKey()
  const iv = Buffer.from(encryptedData.iv, 'base64')
  const combined = Buffer.from(encryptedData.encrypted, 'base64')

  // Split ciphertext and auth tag
  const ciphertext = combined.subarray(0, combined.length - AUTH_TAG_LENGTH)
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(ciphertext)
  decrypted = Buffer.concat([decrypted, decipher.final()])

  return decrypted.toString('utf8')
}

/**
 * Safely encrypt a value, returning null if input is null/undefined
 */
export function safeEncrypt(value: string | null | undefined): EncryptedData | null {
  if (!value) return null
  return encrypt(value)
}

/**
 * Safely decrypt a value, returning null if input is null/undefined
 */
export function safeDecrypt(
  encrypted: string | null | undefined,
  iv: string | null | undefined
): string | null {
  if (!encrypted || !iv) return null
  return decrypt({ encrypted, iv })
}

/**
 * Validate that a PostgreSQL connection string is read-only
 * Returns an error message if invalid, or null if valid
 */
export function validatePostgresConnectionString(connectionString: string): string | null {
  // Check it's a PostgreSQL connection string
  if (!connectionString.startsWith('postgresql://') && !connectionString.startsWith('postgres://')) {
    return 'Connection string must be a PostgreSQL URL (postgresql:// or postgres://)'
  }

  // Parse the URL to check for obvious issues
  try {
    const url = new URL(connectionString)

    // Check for required components
    if (!url.hostname) {
      return 'Connection string must include a hostname'
    }
    if (!url.pathname || url.pathname === '/') {
      return 'Connection string must include a database name'
    }
  } catch {
    return 'Invalid connection string format'
  }

  return null // Valid
}

/**
 * Mask a connection string for display (hide password)
 */
export function maskConnectionString(connectionString: string): string {
  try {
    const url = new URL(connectionString)
    if (url.password) {
      url.password = '****'
    }
    return url.toString()
  } catch {
    return connectionString.replace(/:[^:@]+@/, ':****@')
  }
}

/**
 * Test a PostgreSQL connection by attempting to connect and run a simple query
 * Returns null if successful, or an error message if failed
 */
export async function testPostgresConnection(connectionString: string): Promise<string | null> {
  let client: Client | null = null

  try {
    client = new Client({
      connectionString,
      connectionTimeoutMillis: 10000, // 10 second timeout
    })

    await client.connect()

    // Run a simple query to verify the connection works
    await client.query('SELECT 1')

    return null // Success
  } catch (error) {
    // Provide user-friendly error messages
    if (error instanceof Error) {
      const message = error.message.toLowerCase()

      if (message.includes('timeout') || message.includes('timed out')) {
        return 'Connection timed out. Please check the hostname and port are correct and accessible.'
      }
      if (message.includes('password authentication failed') || message.includes('authentication failed')) {
        return 'Authentication failed. Please check your username and password.'
      }
      if (message.includes('does not exist') && message.includes('database')) {
        return 'Database does not exist. Please check the database name.'
      }
      if (message.includes('enotfound') || message.includes('getaddrinfo')) {
        return 'Hostname not found. Please check the hostname is correct.'
      }
      if (message.includes('econnrefused') || message.includes('connection refused')) {
        return 'Connection refused. Please check the hostname and port, and ensure the database server is running.'
      }
      if (message.includes('ssl') || message.includes('certificate')) {
        return 'SSL/TLS error. You may need to add ?sslmode=require or ?sslmode=no-verify to your connection string.'
      }
      if (message.includes('permission denied')) {
        return 'Permission denied. Please check your user has access to the database.'
      }

      // Return a generic but informative message
      return `Connection failed: ${error.message}`
    }

    return 'Connection failed. Please check your connection string.'
  } finally {
    if (client) {
      try {
        await client.end()
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
