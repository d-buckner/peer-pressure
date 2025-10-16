/**
 * Main Peer class - WebRTC peer connection with data channels
 */

import { EventEmitter } from './event-emitter'
import { SignalingManager } from './signaling'
import { ICEManager } from './ice'
import { DataChannelManager } from './data-channel'
import { MediaManager } from './media'
import { StatsManager } from './stats'
import { randomBytes, toHex, debug } from './utils'
import type { PeerOptions, SignalData, AddressInfo, GetStatsCallback, PeerEvents } from './types'
import type { PeerContext } from './peer-context'

const ICECOMPLETE_TIMEOUT = 5 * 1000

function getBrowserRTC() {
  if (typeof globalThis === 'undefined') return null

  return {
    RTCPeerConnection: globalThis.RTCPeerConnection,
    RTCSessionDescription: globalThis.RTCSessionDescription,
    RTCIceCandidate: globalThis.RTCIceCandidate
  }
}

export default class Peer extends EventEmitter<PeerEvents> implements PeerContext {
  // Static properties
  static WEBRTC_SUPPORT = !!getBrowserRTC()
  static config: RTCConfiguration = {
    iceServers: [
      {
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:global.stun.twilio.com:3478'
        ]
      }
    ]
  }
  static channelConfig: RTCDataChannelInit = {}

  // Public properties
  readonly initiator: boolean
  channelName: string | null
  readonly channelConfig: RTCDataChannelInit
  readonly channelNegotiated: boolean
  readonly config: RTCConfiguration
  readonly offerOptions: RTCOfferOptions
  readonly answerOptions: RTCAnswerOptions
  readonly sdpTransform: (sdp: string) => string
  readonly streams: MediaStream[]
  readonly trickle: boolean
  readonly allowHalfTrickle: boolean
  readonly iceCompleteTimeout: number
  readonly objectMode: boolean

  destroyed = false
  destroying = false

  remoteAddress: string | undefined
  remoteFamily: string | undefined
  remotePort: number | undefined
  localAddress: string | undefined
  localFamily: string | undefined
  localPort: number | undefined

  // Internal properties
  _id: string
  _pc!: RTCPeerConnection
  _wrtc: {
    RTCPeerConnection: typeof RTCPeerConnection
    RTCSessionDescription: typeof RTCSessionDescription
    RTCIceCandidate: typeof RTCIceCandidate
  }
  _channel: RTCDataChannel | null = null
  _pendingCandidates: RTCIceCandidateInit[] = []

  _connected = false
  _connecting = false
  _pcReady = false
  _channelReady = false
  _iceComplete = false
  _iceCompleteTimer: NodeJS.Timeout | null = null
  _isNegotiating = false
  _firstNegotiation = true
  _batchedNegotiation = false
  _queuedNegotiation = false
  _isReactNativeWebrtc = false

  _senderMap = new Map<MediaStreamTrack, Map<MediaStream, RTCRtpSender>>()
  _sendersAwaitingStable: RTCRtpSender[] = []
  _remoteTracks: Array<{ track: MediaStreamTrack; stream: MediaStream }> = []
  _remoteStreams: MediaStream[] = []

  _chunk: Uint8Array | null = null
  _cb: ((err: Error | null) => void) | null = null
  _interval: NodeJS.Timeout | null = null
  _closingInterval: NodeJS.Timeout | null = null

  _onFinishBound: (() => void) | null = null

  // Managers
  private signaling: SignalingManager
  private ice: ICEManager
  private dataChannel: DataChannelManager
  private media: MediaManager
  private stats: StatsManager

  constructor(opts: PeerOptions = {}) {
    super()

    this._id = toHex(randomBytes(4)).slice(0, 7)
    debug(this._id, 'new peer %o', opts)

    this.channelName = opts.initiator
      ? opts.channelName || toHex(randomBytes(20))
      : null

    this.initiator = opts.initiator || false
    this.channelConfig = opts.channelConfig || Peer.channelConfig
    this.channelNegotiated = !!this.channelConfig.negotiated
    this.config = { ...Peer.config, ...opts.config }
    this.offerOptions = opts.offerOptions || {}
    this.answerOptions = opts.answerOptions || {}
    this.sdpTransform = opts.sdpTransform || ((sdp: string) => sdp)
    this.streams = opts.streams || (opts.stream ? [opts.stream] : [])
    this.trickle = opts.trickle !== undefined ? opts.trickle : true
    this.allowHalfTrickle = opts.allowHalfTrickle !== undefined ? opts.allowHalfTrickle : false
    this.iceCompleteTimeout = opts.iceCompleteTimeout || ICECOMPLETE_TIMEOUT
    this.objectMode = opts.objectMode || false

    this._wrtc = opts.wrtc || getBrowserRTC()!

    if (!this._wrtc) {
      if (typeof window === 'undefined') {
        throw new Error('No WebRTC support: Specify `opts.wrtc` option in this environment')
      }
      throw new Error('No WebRTC support: Not a supported browser')
    }

    // Initialize modules - Peer implements PeerContext so this is type-safe
    this.signaling = new SignalingManager(this)
    this.ice = new ICEManager(this)
    this.dataChannel = new DataChannelManager(this)
    this.media = new MediaManager(this)
    this.stats = new StatsManager(this)

    // Initialize RTCPeerConnection
    try {
      this._pc = new this._wrtc.RTCPeerConnection(this.config)
    } catch (err) {
      this.destroy(err as Error)
      return
    }

    // Feature detection for React Native WebRTC
    this._isReactNativeWebrtc = typeof (this._pc as {_peerConnectionId?: number})._peerConnectionId === 'number'

    // Setup event handlers
    this._pc.oniceconnectionstatechange = () => {
      this.ice.onIceStateChange()
    }
    this._pc.onicegatheringstatechange = () => {
      this.ice.onIceStateChange()
    }
    this._pc.onconnectionstatechange = () => {
      this._onConnectionStateChange()
    }
    this._pc.onsignalingstatechange = () => {
      this._onSignalingStateChange()
    }
    this._pc.onicecandidate = (event) => {
      this.ice.onIceCandidate(event)
    }

    // HACK: Fix for odd Firefox behavior
    // See: https://github.com/feross/simple-peer/pull/783
    const pcWithPeerIdentity = this._pc as RTCPeerConnection & { peerIdentity?: Promise<unknown> }
    if (typeof pcWithPeerIdentity.peerIdentity === 'object') {
      pcWithPeerIdentity.peerIdentity.catch((err: Error) => {
        this.destroy(err)
      })
    }

    // Setup data channel
    if (this.initiator || this.channelNegotiated) {
      const channel = this._pc.createDataChannel(this.channelName!, this.channelConfig)
      this.dataChannel.setupData({ channel })
    } else {
      this._pc.ondatachannel = (event) => {
        this.dataChannel.setupData(event)
      }
    }

    // Add initial streams
    if (this.streams) {
      this.streams.forEach(stream => {
        this.addStream(stream)
      })
    }

    this._pc.ontrack = (event) => {
      this.media.onTrack(event)
    }

    debug(this._id, 'initial negotiation')
    this._needsNegotiation()

    this._onFinishBound = () => {
      this._onFinish()
    }
    this.once('finish', this._onFinishBound)
  }

  get bufferSize(): number {
    return (this._channel?.bufferedAmount) || 0
  }

  // HACK: it's possible channel.readyState is "closing" before peer.destroy() fires
  // https://bugs.chromium.org/p/chromium/issues/detail?id=882743
  get connected(): boolean {
    return this._connected && this._channel?.readyState === 'open'
  }

  address(): AddressInfo {
    return {
      port: this.localPort,
      family: this.localFamily,
      address: this.localAddress
    }
  }

  signal(data: SignalData | string): void {
    if (this.destroying) return

    if (this.destroyed) {
      throw new Error('cannot signal after peer is destroyed')
    }

    let parsedData: {
      renegotiate?: boolean
      transceiverRequest?: { kind: string; init?: RTCRtpTransceiverInit }
      candidate?: RTCIceCandidateInit
      sdp?: string
      type?: string
    }

    if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data)
      } catch (err) {
        parsedData = {}
      }
    } else {
      parsedData = data as typeof parsedData
    }

    debug(this._id, 'signal()')

    if (parsedData.renegotiate && this.initiator) {
      debug(this._id, 'got request to renegotiate')
      this._needsNegotiation()
    }

    if (parsedData.transceiverRequest && this.initiator) {
      debug(this._id, 'got request for transceiver')
      this.addTransceiver(
        parsedData.transceiverRequest.kind,
        parsedData.transceiverRequest.init
      )
    }

    if (parsedData.candidate) {
      if (this._pc.remoteDescription?.type) {
        this.ice.addIceCandidate(parsedData.candidate)
      } else {
        this._pendingCandidates.push(parsedData.candidate)
      }
    }

    if (parsedData.sdp) {
      this._handleRemoteDescription(parsedData as RTCSessionDescriptionInit)
    }

    const hasValidSignalData = parsedData.sdp ||
      parsedData.candidate ||
      parsedData.renegotiate ||
      parsedData.transceiverRequest

    if (!hasValidSignalData) {
      this.destroy(new Error('signal() called with invalid signal data'))
    }
  }

  private async _handleRemoteDescription(data: RTCSessionDescriptionInit): Promise<void> {
    try {
      await this._pc.setRemoteDescription(new this._wrtc.RTCSessionDescription(data))

      if (this.destroyed) return

      this._pendingCandidates.forEach(candidate => {
        this.ice.addIceCandidate(candidate)
      })
      this._pendingCandidates = []

      if (this._pc.remoteDescription?.type === 'offer') {
        this.signaling.createAnswer()
      }
    } catch (err) {
      this.destroy(err as Error)
    }
  }

  send(chunk: string | Uint8Array | ArrayBuffer | ArrayBufferView): void {
    if (this.destroying) return

    if (this.destroyed) {
      throw new Error('cannot send after peer is destroyed')
    }

    this._channel!.send(chunk as never)
  }

  addTransceiver(kind: string, init?: RTCRtpTransceiverInit): void {
    this.media.addTransceiver(kind, init)
  }

  addStream(stream: MediaStream): void {
    this.media.addStream(stream)
  }

  addTrack(track: MediaStreamTrack, stream: MediaStream): void {
    this.media.addTrack(track, stream)
  }

  replaceTrack(
    oldTrack: MediaStreamTrack,
    newTrack: MediaStreamTrack | null,
    stream: MediaStream
  ): void {
    this.media.replaceTrack(oldTrack, newTrack, stream)
  }

  removeTrack(track: MediaStreamTrack, stream: MediaStream): void {
    this.media.removeTrack(track, stream)
  }

  removeStream(stream: MediaStream): void {
    this.media.removeStream(stream)
  }

  negotiate(): void {
    this.signaling.negotiate()
  }

  destroy(err?: Error): void {
    this._destroy(err)
  }

  getStats(callback: GetStatsCallback): void {
    this.stats.getStats(callback)
  }

  // Internal methods

  _needsNegotiation(): void {
    this.signaling.needsNegotiation()
  }

  _requestMissingTransceivers(): void {
    this.media.requestMissingTransceivers()
  }

  _maybeReady(): void {
    this.stats.maybeReady()
  }

  _onInterval(): void {
    if (!this._cb) return
    if (!this._channel) return
    if (this._channel.bufferedAmount > 64 * 1024) return

    this.dataChannel.onChannelBufferedAmountLow()
  }

  private _onConnectionStateChange(): void {
    if (this.destroyed) return

    if (this._pc.connectionState === 'failed') {
      this.destroy(new Error('Connection failed.'))
    }
  }

  private _onSignalingStateChange(): void {
    if (this.destroyed) return

    if (this._pc.signalingState !== 'stable') {
      debug(this._id, 'signalingStateChange %s', this._pc.signalingState)
      this.emit('signalingStateChange', this._pc.signalingState)
      return
    }

    this._isNegotiating = false

    // HACK: Firefox doesn't yet support removing tracks when signalingState !== 'stable'
    this.media.flushSendersAwaitingStable()

    if (this._queuedNegotiation) {
      debug(this._id, 'flushing negotiation queue')
      this._queuedNegotiation = false
      this._needsNegotiation()
    } else {
      debug(this._id, 'negotiated')
      this.emit('negotiated')
    }

    debug(this._id, 'signalingStateChange %s', this._pc.signalingState)
    this.emit('signalingStateChange', this._pc.signalingState)
  }

  private _onFinish(): void {
    if (this.destroyed) return

    // Wait a bit before destroying so the socket flushes.
    // TODO: is there a more reliable way to accomplish this?
    const destroySoon = () => {
      setTimeout(() => this.destroy(), 1000)
    }

    if (this._connected) {
      destroySoon()
      return
    }

    this.once('connect', destroySoon)
  }

  private _destroy(err?: Error): void {
    if (this.destroyed || this.destroying) return

    this.destroying = true

    debug(this._id, 'destroying (error: %s)', err?.message || err)

    queueMicrotask(() => {
      this.destroyed = true
      this.destroying = false

      debug(this._id, 'destroy (error: %s)', err?.message || err)

      this._connected = false
      this._pcReady = false
      this._channelReady = false

      this._chunk = null
      this._cb = null

      if (this._onFinishBound) {
        this.removeListener('finish', this._onFinishBound)
      }
      this._onFinishBound = null

      // Cleanup managers
      this.ice.cleanup()
      this.dataChannel.cleanup()

      // Cleanup RTCPeerConnection
      if (this._pc) {
        try {
          this._pc.close()
        } catch (err) {
          // Ignore errors during cleanup
        }

        this._pc.oniceconnectionstatechange = null
        this._pc.onicegatheringstatechange = null
        this._pc.onsignalingstatechange = null
        this._pc.onicecandidate = null
        this._pc.ontrack = null
        this._pc.ondatachannel = null
      }

      this._channel = null

      if (err) {
        this.emit('error', err)
      }

      this.emit('close')
    })
  }
}
