/**
 * Media module - handles MediaStreams and MediaStreamTracks
 */

import { debug } from './utils'
import type { PeerContext } from './peer-context'

export class MediaManager {
  constructor(private ctx: PeerContext) {}

  addStream(stream: MediaStream): void {
    if (this.ctx.destroying) return

    if (this.ctx.destroyed) {
      throw new Error('cannot addStream after peer is destroyed')
    }

    debug(this.ctx._id, 'addStream()')

    stream.getTracks().forEach(track => {
      this.addTrack(track, stream)
    })
  }

  addTrack(track: MediaStreamTrack, stream: MediaStream): void {
    if (this.ctx.destroying) return

    if (this.ctx.destroyed) {
      throw new Error('cannot addTrack after peer is destroyed')
    }

    debug(this.ctx._id, 'addTrack()')

    const submap = this.ctx._senderMap.get(track) || new Map()
    const sender = submap.get(stream)

    if (sender?.removed) {
      throw new Error('Track has been removed. You should enable/disable tracks that you want to re-add.')
    }

    if (sender) {
      throw new Error('Track has already been added to that stream.')
    }

    const newSender = this.ctx._pc.addTrack(track, stream)
    submap.set(stream, newSender)
    this.ctx._senderMap.set(track, submap)
    this.ctx._needsNegotiation()
  }

  replaceTrack(
    oldTrack: MediaStreamTrack,
    newTrack: MediaStreamTrack | null,
    stream: MediaStream
  ): void {
    if (this.ctx.destroying) return

    if (this.ctx.destroyed) {
      throw new Error('cannot replaceTrack after peer is destroyed')
    }

    debug(this.ctx._id, 'replaceTrack()')

    const submap = this.ctx._senderMap.get(oldTrack)
    const sender = submap?.get(stream)

    if (!sender) {
      throw new Error('Cannot replace track that was never added.')
    }

    if (newTrack && submap) {
      this.ctx._senderMap.set(newTrack, submap)
    }

    if (!sender.replaceTrack) {
      this.ctx.destroy(new Error('replaceTrack is not supported in this browser'))
      return
    }

    sender.replaceTrack(newTrack)
  }

  removeTrack(track: MediaStreamTrack, stream: MediaStream): void {
    if (this.ctx.destroying) return

    if (this.ctx.destroyed) {
      throw new Error('cannot removeTrack after peer is destroyed')
    }

    debug(this.ctx._id, 'removeSender()')

    const submap = this.ctx._senderMap.get(track)
    const sender = submap?.get(stream)

    if (!sender) {
      throw new Error('Cannot remove track that was never added.')
    }

    try {
      (sender as RTCRtpSender & { removed?: boolean }).removed = true
      this.ctx._pc.removeTrack(sender)
    } catch (err) {
      const error = err as Error
      // HACK: Firefox must wait until (signalingState === stable)
      // https://bugzilla.mozilla.org/show_bug.cgi?id=1133874
      if (error.name === 'NS_ERROR_UNEXPECTED') {
        this.ctx._sendersAwaitingStable.push(sender)
      } else {
        this.ctx.destroy(error)
        return
      }
    }

    this.ctx._needsNegotiation()
  }

  removeStream(stream: MediaStream): void {
    if (this.ctx.destroying) return

    if (this.ctx.destroyed) {
      throw new Error('cannot removeStream after peer is destroyed')
    }

    debug(this.ctx._id, 'removeSenders()')

    stream.getTracks().forEach(track => {
      this.removeTrack(track, stream)
    })
  }

  addTransceiver(kind: string, init?: RTCRtpTransceiverInit): void {
    if (this.ctx.destroying) return

    if (this.ctx.destroyed) {
      throw new Error('cannot addTransceiver after peer is destroyed')
    }

    debug(this.ctx._id, 'addTransceiver()')

    if (this.ctx.initiator) {
      try {
        this.ctx._pc.addTransceiver(kind, init)
        this.ctx._needsNegotiation()
      } catch (err) {
        this.ctx.destroy(err as Error)
      }
      return
    }

    // Request initiator to renegotiate
    this.ctx.emit('signal', {
      type: 'transceiverRequest',
      transceiverRequest: { kind, init }
    })
  }

  onTrack(event: RTCTrackEvent): void {
    if (this.ctx.destroyed) return

    event.streams.forEach(eventStream => {
      debug(this.ctx._id, 'on track')
      this.ctx.emit('track', event.track, eventStream)

      this.ctx._remoteTracks.push({
        track: event.track,
        stream: eventStream
      })

      const streamExists = this.ctx._remoteStreams.some(remoteStream => {
        return remoteStream.id === eventStream.id
      })

      // Only fire one 'stream' event, even though there may be multiple tracks per stream
      if (streamExists) return

      this.ctx._remoteStreams.push(eventStream)
      queueMicrotask(() => {
        debug(this.ctx._id, 'on stream')
        this.ctx.emit('stream', eventStream) // ensure all tracks have been added
      })
    })
  }

  requestMissingTransceivers(): void {
    if (!this.ctx._pc.getTransceivers) return

    this.ctx._pc.getTransceivers().forEach(transceiver => {
      const hasNoMid = !transceiver.mid
      const hasSenderTrack = transceiver.sender.track
      const notRequested = !(transceiver as RTCRtpTransceiver & { requested?: boolean }).requested

      if (!hasNoMid || !hasSenderTrack || !notRequested) return

      // HACK: Safari returns negotiated transceivers with a null mid
      (transceiver as RTCRtpTransceiver & { requested?: boolean }).requested = true
      this.addTransceiver(transceiver.sender.track.kind)
    })
  }

  flushSendersAwaitingStable(): void {
    debug(this.ctx._id, 'flushing sender queue', this.ctx._sendersAwaitingStable)

    this.ctx._sendersAwaitingStable.forEach(sender => {
      this.ctx._pc.removeTrack(sender)
    })

    this.ctx._sendersAwaitingStable = []
  }
}
