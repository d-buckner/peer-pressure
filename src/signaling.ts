/**
 * Signaling module - handles WebRTC offer/answer negotiation
 */

import { filterTrickle, debug } from './utils'
import type { PeerContext } from './peer-context'

export class SignalingManager {
  constructor(private ctx: PeerContext) {}

  needsNegotiation(): void {
    debug(this.ctx._id, '_needsNegotiation')

    if (this.ctx._batchedNegotiation) return

    this.ctx._batchedNegotiation = true
    queueMicrotask(() => {
      this.ctx._batchedNegotiation = false

      const shouldNegotiate = this.ctx.initiator || !this.ctx._firstNegotiation

      if (!shouldNegotiate) {
        debug(this.ctx._id, 'non-initiator initial negotiation request discarded')
        this.ctx._firstNegotiation = false
        return
      }

      debug(this.ctx._id, 'starting batched negotiation')
      this.negotiate()
      this.ctx._firstNegotiation = false
    })
  }

  negotiate(): void {
    if (this.ctx.destroying) return

    if (this.ctx.destroyed) {
      throw new Error('cannot negotiate after peer is destroyed')
    }

    if (this.ctx.initiator) {
      if (this.ctx._isNegotiating) {
        this.ctx._queuedNegotiation = true
        debug(this.ctx._id, 'already negotiating, queueing')
        return
      }

      debug(this.ctx._id, 'start negotiation')
      // HACK: Chrome crashes if we immediately call createOffer
      // This setTimeout is still needed (as of 2025) to prevent race conditions
      // during renegotiation, especially when streams are added incrementally
      setTimeout(() => {
        this.createOffer()
      }, 0)
    } else {
      if (this.ctx._isNegotiating) {
        this.ctx._queuedNegotiation = true
        debug(this.ctx._id, 'already negotiating, queueing')
        return
      }

      debug(this.ctx._id, 'requesting negotiation from initiator')
      this.ctx.emit('signal', {
        type: 'renegotiate',
        renegotiate: true
      })
    }

    this.ctx._isNegotiating = true
  }

  async createOffer(): Promise<void> {
    if (this.ctx.destroyed) return

    try {
      const offer = await this.ctx._pc.createOffer(this.ctx.offerOptions)
      if (this.ctx.destroyed) return

      if (!this.ctx.trickle && !this.ctx.allowHalfTrickle) {
        offer.sdp = filterTrickle(offer.sdp!)
      }
      offer.sdp = this.ctx.sdpTransform(offer.sdp!)

      await this.setLocalDescriptionAndSignal(offer, 'createOffer success')
    } catch (err) {
      this.ctx.destroy(err as Error)
    }
  }

  async createAnswer(): Promise<void> {
    if (this.ctx.destroyed) return

    try {
      const answer = await this.ctx._pc.createAnswer(this.ctx.answerOptions)
      if (this.ctx.destroyed) return

      if (!this.ctx.trickle && !this.ctx.allowHalfTrickle) {
        answer.sdp = filterTrickle(answer.sdp!)
      }
      answer.sdp = this.ctx.sdpTransform(answer.sdp!)

      await this.setLocalDescriptionAndSignal(answer, 'createAnswer success', () => {
        if (!this.ctx.initiator) {
          this.ctx._requestMissingTransceivers()
        }
      })
    } catch (err) {
      this.ctx.destroy(err as Error)
    }
  }

  private async setLocalDescriptionAndSignal(
    description: RTCSessionDescriptionInit,
    successMessage: string,
    afterSignal?: () => void
  ): Promise<void> {
    try {
      await this.ctx._pc.setLocalDescription(description)
      debug(this.ctx._id, successMessage)
      if (this.ctx.destroyed) return

      const sendSignal = () => {
        if (this.ctx.destroyed) return

        const signal = this.ctx._pc.localDescription || description
        debug(this.ctx._id, 'signal')
        this.ctx.emit('signal', {
          type: signal.type,
          sdp: signal.sdp
        })

        afterSignal?.()
      }

      if (this.ctx.trickle || this.ctx._iceComplete) {
        sendSignal()
        return
      }

      this.ctx.once('_iceComplete', sendSignal)
    } catch (err) {
      this.ctx.destroy(err as Error)
    }
  }
}
