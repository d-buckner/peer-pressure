/**
 * Shared context interface for all managers
 * This ensures type-safe communication between Peer and its managers
 */

export interface PeerContext {
  // Identification
  _id: string

  // RTCPeerConnection and related
  _pc: RTCPeerConnection
  _wrtc: {
    RTCPeerConnection: typeof RTCPeerConnection
    RTCSessionDescription: typeof RTCSessionDescription
    RTCIceCandidate: typeof RTCIceCandidate
  }

  // State flags
  destroyed: boolean
  destroying: boolean
  initiator: boolean
  trickle: boolean
  allowHalfTrickle: boolean
  objectMode: boolean

  // Connection state
  _connected: boolean
  _connecting: boolean
  _pcReady: boolean
  _channelReady: boolean
  _iceComplete: boolean
  _isNegotiating: boolean
  _firstNegotiation: boolean
  _batchedNegotiation: boolean
  _queuedNegotiation: boolean
  _isReactNativeWebrtc: boolean

  // Configuration
  offerOptions: RTCOfferOptions
  answerOptions: RTCAnswerOptions
  sdpTransform: (sdp: string) => string
  iceCompleteTimeout: number
  channelName: string | null
  channelConfig: RTCDataChannelInit

  // Timers and intervals
  _iceCompleteTimer: NodeJS.Timeout | null
  _interval: NodeJS.Timeout | null
  _closingInterval: NodeJS.Timeout | null

  // Data channel
  _channel: RTCDataChannel | null
  _chunk: Uint8Array | null
  _cb: ((err: Error | null) => void) | null

  // Media
  _senderMap: Map<MediaStreamTrack, Map<MediaStream, RTCRtpSender>>
  _sendersAwaitingStable: RTCRtpSender[]
  _remoteTracks: Array<{ track: MediaStreamTrack; stream: MediaStream }>
  _remoteStreams: MediaStream[]

  // Address info
  localAddress: string | undefined
  localPort: number | undefined
  localFamily: string | undefined
  remoteAddress: string | undefined
  remotePort: number | undefined
  remoteFamily: string | undefined

  // Methods that managers can call
  emit(event: string, ...args: unknown[]): boolean
  once(event: string, listener: (...args: unknown[]) => void): void
  destroy(err?: Error): void
  send(chunk: string | Uint8Array | ArrayBuffer | ArrayBufferView): void

  // Internal methods
  _needsNegotiation(): void
  _requestMissingTransceivers(): void
  _maybeReady(): void
  _onInterval(): void
}
