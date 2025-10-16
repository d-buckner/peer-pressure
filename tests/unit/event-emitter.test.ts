import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from '../../src/event-emitter'

describe('EventEmitter', () => {
  describe('on', () => {
    it('should register event listener', () => {
      const emitter = new EventEmitter()
      const listener = vi.fn()

      emitter.on('test', listener)
      emitter.emit('test')

      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('should support multiple listeners for same event', () => {
      const emitter = new EventEmitter()
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      emitter.on('test', listener1)
      emitter.on('test', listener2)
      emitter.emit('test')

      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(1)
    })

    it('should pass arguments to listeners', () => {
      const emitter = new EventEmitter()
      const listener = vi.fn()

      emitter.on('test', listener)
      emitter.emit('test', 'arg1', 42, { key: 'value' })

      expect(listener).toHaveBeenCalledWith('arg1', 42, { key: 'value' })
    })

    it('should return this for chaining', () => {
      const emitter = new EventEmitter()
      const result = emitter.on('test', vi.fn())

      expect(result).toBe(emitter)
    })
  })

  describe('once', () => {
    it('should call listener only once', () => {
      const emitter = new EventEmitter()
      const listener = vi.fn()

      emitter.once('test', listener)
      emitter.emit('test')
      emitter.emit('test')

      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('should pass arguments to listener', () => {
      const emitter = new EventEmitter()
      const listener = vi.fn()

      emitter.once('test', listener)
      emitter.emit('test', 'arg1', 42)

      expect(listener).toHaveBeenCalledWith('arg1', 42)
    })

    it('should return this for chaining', () => {
      const emitter = new EventEmitter()
      const result = emitter.once('test', vi.fn())

      expect(result).toBe(emitter)
    })
  })

  describe('off', () => {
    it('should remove specific listener', () => {
      const emitter = new EventEmitter()
      const listener = vi.fn()

      emitter.on('test', listener)
      emitter.off('test', listener)
      emitter.emit('test')

      expect(listener).not.toHaveBeenCalled()
    })

    it('should only remove specified listener', () => {
      const emitter = new EventEmitter()
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      emitter.on('test', listener1)
      emitter.on('test', listener2)
      emitter.off('test', listener1)
      emitter.emit('test')

      expect(listener1).not.toHaveBeenCalled()
      expect(listener2).toHaveBeenCalledTimes(1)
    })

    it('should handle removing non-existent listener', () => {
      const emitter = new EventEmitter()
      const listener = vi.fn()

      expect(() => emitter.off('test', listener)).not.toThrow()
    })

    it('should return this for chaining', () => {
      const emitter = new EventEmitter()
      const result = emitter.off('test', vi.fn())

      expect(result).toBe(emitter)
    })
  })

  describe('emit', () => {
    it('should return false when no listeners', () => {
      const emitter = new EventEmitter()
      const result = emitter.emit('test')

      expect(result).toBe(false)
    })

    it('should return true when listeners exist', () => {
      const emitter = new EventEmitter()
      emitter.on('test', vi.fn())
      const result = emitter.emit('test')

      expect(result).toBe(true)
    })

    it('should handle listener removing itself during emit', () => {
      const emitter = new EventEmitter()
      const listener1 = vi.fn()
      const listener2 = vi.fn(() => {
        emitter.off('test', listener2)
      })
      const listener3 = vi.fn()

      emitter.on('test', listener1)
      emitter.on('test', listener2)
      emitter.on('test', listener3)
      emitter.emit('test')

      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(1)
      expect(listener3).toHaveBeenCalledTimes(1)
    })

    it('should handle listener adding new listener during emit', () => {
      const emitter = new EventEmitter()
      const newListener = vi.fn()
      const listener = vi.fn(() => {
        emitter.on('test', newListener)
      })

      emitter.on('test', listener)
      emitter.emit('test')
      emitter.emit('test')

      expect(listener).toHaveBeenCalledTimes(2)
      expect(newListener).toHaveBeenCalledTimes(1)
    })
  })

  describe('removeListener', () => {
    it('should be alias for off', () => {
      const emitter = new EventEmitter()
      const listener = vi.fn()

      emitter.on('test', listener)
      emitter.removeListener('test', listener)
      emitter.emit('test')

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('removeAllListeners', () => {
    it('should remove all listeners for specific event', () => {
      const emitter = new EventEmitter()
      const listener1 = vi.fn()
      const listener2 = vi.fn()
      const listener3 = vi.fn()

      emitter.on('test', listener1)
      emitter.on('test', listener2)
      emitter.on('other', listener3)
      emitter.removeAllListeners('test')
      emitter.emit('test')
      emitter.emit('other')

      expect(listener1).not.toHaveBeenCalled()
      expect(listener2).not.toHaveBeenCalled()
      expect(listener3).toHaveBeenCalledTimes(1)
    })

    it('should remove all listeners for all events when no event specified', () => {
      const emitter = new EventEmitter()
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      emitter.on('test', listener1)
      emitter.on('other', listener2)
      emitter.removeAllListeners()
      emitter.emit('test')
      emitter.emit('other')

      expect(listener1).not.toHaveBeenCalled()
      expect(listener2).not.toHaveBeenCalled()
    })

    it('should return this for chaining', () => {
      const emitter = new EventEmitter()
      const result = emitter.removeAllListeners()

      expect(result).toBe(emitter)
    })
  })
})
