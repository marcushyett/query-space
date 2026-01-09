import { customAlphabet } from 'nanoid'

// Use a URL-safe alphabet without ambiguous characters (no 0/O, 1/l/I)
// This gives us 57 characters: a-z (26) + A-Z without I (25) + 2-9 (8) - 2 = 57
const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'

// 4 characters = 57^4 = ~10.5 million combinations
// 5 characters = 57^5 = ~601 million combinations
const SHORT_ID_LENGTH = 4

// Create the nanoid generator with custom alphabet
const generateShortId = customAlphabet(ALPHABET, SHORT_ID_LENGTH)

export { generateShortId }

// Public link domain configuration
// Uses http:// for shortest possible QR codes
export const PUBLIC_LINK_DOMAIN = 'mvng.app'
export const PUBLIC_LINK_PROTOCOL = 'http://'
export const PUBLIC_LINK_PATH = '/m/' // "m" for "move" namespace

/**
 * Generate a full public URL for a short ID
 * Example: http://mvng.app/m/abc4
 */
export function getPublicUrl(shortId: string): string {
  return `${PUBLIC_LINK_PROTOCOL}${PUBLIC_LINK_DOMAIN}${PUBLIC_LINK_PATH}${shortId}`
}

/**
 * Generate a display URL without protocol (for cleaner display)
 * Example: mvng.app/m/abc4
 */
export function getPublicUrlDisplay(shortId: string): string {
  return `${PUBLIC_LINK_DOMAIN}${PUBLIC_LINK_PATH}${shortId}`
}
