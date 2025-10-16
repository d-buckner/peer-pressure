/**
 * Utility functions for peer-pressure
 */

/**
 * Generate random bytes using browser crypto API
 */
export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

/**
 * Convert Uint8Array to hex string
 */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Filter trickle ICE lines from SDP
 */
export function filterTrickle(sdp: string): string {
  return sdp.replace(/a=ice-options:trickle\s\n/g, '')
}

/**
 * Debug helper - only logs if DEBUG environment variable is set
 * In browser, check localStorage.debug
 */
const debugEnabled = typeof localStorage !== 'undefined' && localStorage.getItem('debug') === 'peer-pressure'

export function debug(id: string, ...args: unknown[]): void {
  if (!debugEnabled) return
  console.log(`[${id}]`, ...args)
}
