/**
 * ICE module - handles ICE candidate gathering and connection state
 */

import { debug } from './utils'
import type { PeerContext } from './peer-context'

export class ICEManager {
  constructor(private ctx: PeerContext) {}

  onIceCandidate(event: RTCPeerConnectionIceEvent): void {
    if (this.ctx.destroyed) return

    if (event.candidate && this.ctx.trickle) {
      this.ctx.emit('signal', {
        type: 'candidate',
        candidate: {
          candidate: event.candidate.candidate,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          sdpMid: event.candidate.sdpMid
        }
      })
    }

    if (!event.candidate && !this.ctx._iceComplete) {
      this.ctx._iceComplete = true
      this.ctx.emit('_iceComplete')
    }

    // Start timeout as soon as we've received one valid candidate
    if (event.candidate) {
      this.startIceCompleteTimeout()
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    const iceCandidateObj = new this.ctx._wrtc.RTCIceCandidate(candidate)

    try {
      await this.ctx._pc.addIceCandidate(iceCandidateObj)
    } catch (err) {
      const address = iceCandidateObj.address
      if (!address || address.endsWith('.local')) {
        console.warn('Ignoring unsupported ICE candidate.')
        return
      }

      this.ctx.destroy(err as Error)
    }
  }

  onIceStateChange(): void {
    if (this.ctx.destroyed) return

    const { iceConnectionState, iceGatheringState } = this.ctx._pc;

    debug(
      this.ctx._id,
      `iceStateChange (connection: ${iceConnectionState}) (gathering: ${iceGatheringState})`,
    )
    this.ctx.emit('iceStateChange', iceConnectionState, iceGatheringState)

    if (iceConnectionState === 'connected' || iceConnectionState === 'completed') {
      this.ctx._pcReady = true
      this.ctx._maybeReady()
      return
    }

    if (iceConnectionState === 'failed') {
      this.ctx.destroy(new Error('Ice connection failed.'))
      return
    }

    if (iceConnectionState === 'closed') {
      this.ctx.destroy(new Error('Ice connection closed.'))
    }
  }

  startIceCompleteTimeout(): void {
    if (this.ctx.destroyed) return
    if (this.ctx._iceCompleteTimer) return

    debug(this.ctx._id, 'started iceComplete timeout')
    this.ctx._iceCompleteTimer = setTimeout(() => {
      if (this.ctx._iceComplete) return

      this.ctx._iceComplete = true
      debug(this.ctx._id, 'iceComplete timeout completed')
      this.ctx.emit('iceTimeout')
      this.ctx.emit('_iceComplete')
    }, this.ctx.iceCompleteTimeout)
  }

  cleanup(): void {
    if (this.ctx._iceCompleteTimer) {
      clearTimeout(this.ctx._iceCompleteTimer)
      this.ctx._iceCompleteTimer = null
    }
  }
}
