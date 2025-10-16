/**
 * Simple EventEmitter implementation for browser
 */

type EventListener = (...args: any[]) => void

// Generic event map type for type-safe events
type EventMap = Record<string, EventListener>

// Extract event names from the event map
type EventKey<T extends EventMap> = string & keyof T

export class EventEmitter<Events extends EventMap = EventMap> {
  private events: Map<string, EventListener[]> = new Map()

  on<K extends EventKey<Events>>(event: K, listener: Events[K]): this {
    if (!this.events.has(event)) {
      this.events.set(event, [])
    }
    this.events.get(event)!.push(listener as EventListener)
    return this
  }

  once<K extends EventKey<Events>>(event: K, listener: Events[K]): this {
    const onceWrapper = ((...args: unknown[]) => {
      this.off(event, onceWrapper as Events[K])
      ;(listener as EventListener)(...args)
    }) as Events[K]
    return this.on(event, onceWrapper)
  }

  off<K extends EventKey<Events>>(event: K, listener: Events[K]): this {
    const listeners = this.events.get(event)
    if (!listeners) return this

    const index = listeners.indexOf(listener as EventListener)
    if (index !== -1) {
      listeners.splice(index, 1)
    }

    if (listeners.length === 0) {
      this.events.delete(event)
    }

    return this
  }

  emit<K extends EventKey<Events>>(event: K, ...args: Parameters<Events[K]>): boolean {
    const listeners = this.events.get(event)
    if (!listeners || listeners.length === 0) return false

    // Clone the array to avoid issues if listeners are removed during emit
    const listenersCopy = [...listeners]
    for (const listener of listenersCopy) {
      listener(...args)
    }

    return true
  }

  removeListener<K extends EventKey<Events>>(event: K, listener: Events[K]): this {
    return this.off(event, listener)
  }

  removeAllListeners(event?: EventKey<Events>): this {
    if (event) {
      this.events.delete(event)
    } else {
      this.events.clear()
    }
    return this
  }
}
