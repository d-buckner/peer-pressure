/**
 * Simple EventEmitter implementation for browser
 */

type EventListener = (...args: unknown[]) => void

export class EventEmitter {
  private events: Map<string, EventListener[]> = new Map()

  on(event: string, listener: EventListener): this {
    if (!this.events.has(event)) {
      this.events.set(event, [])
    }
    this.events.get(event)!.push(listener)
    return this
  }

  once(event: string, listener: EventListener): this {
    const onceWrapper = (...args: unknown[]) => {
      this.off(event, onceWrapper)
      listener(...args)
    }
    return this.on(event, onceWrapper)
  }

  off(event: string, listener: EventListener): this {
    const listeners = this.events.get(event)
    if (!listeners) return this

    const index = listeners.indexOf(listener)
    if (index !== -1) {
      listeners.splice(index, 1)
    }

    if (listeners.length === 0) {
      this.events.delete(event)
    }

    return this
  }

  emit(event: string, ...args: unknown[]): boolean {
    const listeners = this.events.get(event)
    if (!listeners || listeners.length === 0) return false

    // Clone the array to avoid issues if listeners are removed during emit
    const listenersCopy = [...listeners]
    for (const listener of listenersCopy) {
      listener(...args)
    }

    return true
  }

  removeListener(event: string, listener: EventListener): this {
    return this.off(event, listener)
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this.events.delete(event)
    } else {
      this.events.clear()
    }
    return this
  }
}
