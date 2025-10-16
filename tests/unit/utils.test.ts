import { describe, it, expect } from 'vitest'
import { randomBytes, toHex, filterTrickle } from '../../src/utils'

describe('Utils', () => {
  describe('randomBytes', () => {
    it('should generate bytes of requested length', () => {
      const bytes = randomBytes(16)
      expect(bytes).toBeInstanceOf(Uint8Array)
      expect(bytes.length).toBe(16)
    })

    it('should generate different values on each call', () => {
      const bytes1 = randomBytes(16)
      const bytes2 = randomBytes(16)
      expect(bytes1).not.toEqual(bytes2)
    })

    it('should handle zero length', () => {
      const bytes = randomBytes(0)
      expect(bytes.length).toBe(0)
    })

    it('should handle large lengths', () => {
      const bytes = randomBytes(1024)
      expect(bytes.length).toBe(1024)
    })
  })

  describe('toHex', () => {
    it('should convert bytes to hex string', () => {
      const bytes = new Uint8Array([0, 15, 255])
      const hex = toHex(bytes)
      expect(hex).toBe('000fff')
    })

    it('should handle empty array', () => {
      const bytes = new Uint8Array([])
      const hex = toHex(bytes)
      expect(hex).toBe('')
    })

    it('should pad single digit hex values', () => {
      const bytes = new Uint8Array([1, 2, 3])
      const hex = toHex(bytes)
      expect(hex).toBe('010203')
    })

    it('should handle all possible byte values', () => {
      const bytes = new Uint8Array([0, 127, 128, 255])
      const hex = toHex(bytes)
      expect(hex).toBe('007f80ff')
    })
  })

  describe('filterTrickle', () => {
    it('should remove trickle ICE line from SDP', () => {
      const sdp = 'v=0\na=ice-options:trickle \na=setup:actpass\n'
      const filtered = filterTrickle(sdp)
      expect(filtered).toBe('v=0\na=setup:actpass\n')
    })

    it('should handle SDP without trickle', () => {
      const sdp = 'v=0\na=setup:actpass\n'
      const filtered = filterTrickle(sdp)
      expect(filtered).toBe(sdp)
    })

    it('should handle multiple trickle lines', () => {
      const sdp = 'v=0\na=ice-options:trickle \na=setup:actpass\na=ice-options:trickle \n'
      const filtered = filterTrickle(sdp)
      expect(filtered).toBe('v=0\na=setup:actpass\n')
    })

    it('should handle empty string', () => {
      const filtered = filterTrickle('')
      expect(filtered).toBe('')
    })
  })
})
