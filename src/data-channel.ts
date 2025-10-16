/**
 * Data channel module - handles WebRTC data channel setup and messaging
 */

import { debug } from './utils'
import type { PeerContext } from './peer-context'

const MAX_BUFFERED_AMOUNT = 64 * 1024
const CHANNEL_CLOSING_TIMEOUT = 5 * 1000

export class DataChannelManager {
  constructor(private ctx: PeerContext) {}

  setupData(event: RTCDataChannelEvent | { channel: RTCDataChannel }): void {
    if (!event.channel) {
      // In some situations `pc.createDataChannel()` returns `undefined` (in wrtc),
      // which is invalid behavior. Handle it gracefully.
      this.ctx.destroy(new Error('Data channel event is missing `channel` property'))
      return
    }

    this.ctx._channel = event.channel
    this.ctx._channel.binaryType = 'arraybuffer'

    if (typeof this.ctx._channel.bufferedAmountLowThreshold === 'number') {
      this.ctx._channel.bufferedAmountLowThreshold = MAX_BUFFERED_AMOUNT
    }

    this.ctx.channelName = this.ctx._channel.label

    this.ctx._channel.onmessage = (event) => {
      this.onChannelMessage(event)
    }
    this.ctx._channel.onbufferedamountlow = () => {
      this.onChannelBufferedAmountLow()
    }
    this.ctx._channel.onopen = () => {
      this.onChannelOpen()
    }
    this.ctx._channel.onclose = () => {
      this.onChannelClose()
    }
    this.ctx._channel.onerror = (event) => {
      const errorEvent = event as ErrorEvent
      const err = errorEvent.error instanceof Error
        ? errorEvent.error
        : new Error(`Datachannel error: ${errorEvent.message}`)
      this.ctx.destroy(err)
    }

    // HACK: Chrome will sometimes get stuck in readyState "closing", let's check for this condition
    // https://bugs.chromium.org/p/chromium/issues/detail?id=882743
    let isClosing = false
    this.ctx._closingInterval = setInterval(() => {
      if (!this.ctx._channel) return

      if (this.ctx._channel.readyState === 'closing') {
        if (isClosing) {
          // closing timed out: equivalent to onclose firing
          this.onChannelClose()
        }
        isClosing = true
        return
      }

      isClosing = false
    }, CHANNEL_CLOSING_TIMEOUT)
  }

  onChannelMessage(event: MessageEvent): void {
    if (this.ctx.destroyed) return

    let data: string | Uint8Array = event.data

    // Convert ArrayBuffer to Uint8Array for consistent binary data handling
    if (data instanceof ArrayBuffer) {
      data = new Uint8Array(data)
    }

    // In non-objectMode, convert strings to Uint8Array for consistent API
    if (typeof data === 'string' && !this.ctx.objectMode) {
      const encoder = new TextEncoder()
      data = encoder.encode(data)
    }

    this.ctx.emit('data', data)
  }

  onChannelBufferedAmountLow(): void {
    if (this.ctx.destroyed) return
    if (!this.ctx._cb) return

    debug(this.ctx._id, 'ending backpressure: bufferedAmount %d', this.ctx._channel?.bufferedAmount)

    const cb = this.ctx._cb
    this.ctx._cb = null
    cb(null)
  }

  onChannelOpen(): void {
    if (this.ctx._connected) return
    if (this.ctx.destroyed) return

    debug(this.ctx._id, 'on channel open')
    this.ctx._channelReady = true
    this.ctx._maybeReady()
  }

  onChannelClose(): void {
    if (this.ctx.destroyed) return

    debug(this.ctx._id, 'on channel close')
    this.ctx.destroy()
  }

  write(chunk: Uint8Array, cb: (err: Error | null) => void): void {
    if (this.ctx.destroyed) {
      cb(new Error('cannot write after peer is destroyed'))
      return
    }

    if (!this.ctx._connected) {
      debug(this.ctx._id, 'write before connect')
      this.ctx._chunk = chunk
      this.ctx._cb = cb
      return
    }

    try {
      this.ctx.send(chunk)
    } catch (err) {
      this.ctx.destroy(err as Error)
      return
    }

    if (!this.ctx._channel) {
      cb(new Error('channel not ready'))
      return
    }

    if (this.ctx._channel.bufferedAmount > MAX_BUFFERED_AMOUNT) {
      debug(this.ctx._id, 'start backpressure: bufferedAmount %d', this.ctx._channel.bufferedAmount)
      this.ctx._cb = cb
      return
    }

    cb(null)
  }

  cleanup(): void {
    if (this.ctx._closingInterval) {
      clearInterval(this.ctx._closingInterval)
      this.ctx._closingInterval = null
    }

    if (this.ctx._interval) {
      clearInterval(this.ctx._interval)
      this.ctx._interval = null
    }

    if (!this.ctx._channel) return

    try {
      this.ctx._channel.close()
    } catch (err) {
      // Ignore errors during cleanup
    }

    // Allow events concurrent with destruction to be handled
    this.ctx._channel.onmessage = null
    this.ctx._channel.onopen = null
    this.ctx._channel.onclose = null
    this.ctx._channel.onerror = null
  }
}
