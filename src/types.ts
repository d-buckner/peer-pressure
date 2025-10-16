/**
 * Type definitions for peer-pressure WebRTC library
 */

/**
 * Signal data types for WebRTC signaling
 */
export type SignalData =
  | OfferSignal
  | AnswerSignal
  | CandidateSignal
  | RenegotiateSignal
  | TransceiverRequestSignal

export interface OfferSignal {
  type: 'offer'
  sdp: string
}

export interface AnswerSignal {
  type: 'answer'
  sdp: string
}

export interface CandidateSignal {
  type: 'candidate'
  candidate: RTCIceCandidateInit
}

export interface RenegotiateSignal {
  type: 'renegotiate'
  renegotiate: true
}

export interface TransceiverRequestSignal {
  type: 'transceiverRequest'
  transceiverRequest: {
    kind: string
    init?: RTCRtpTransceiverInit
  }
}

/**
 * Options for creating a Peer instance
 */
export interface PeerOptions {
  /**
   * Set to true if this is the initiating peer
   */
  initiator?: boolean

  /**
   * Custom channel name (initiator only)
   */
  channelName?: string

  /**
   * Custom webrtc implementation, useful in Node.js
   */
  wrtc?: {
    RTCPeerConnection: typeof RTCPeerConnection
    RTCSessionDescription: typeof RTCSessionDescription
    RTCIceCandidate: typeof RTCIceCandidate
    MediaStream?: typeof MediaStream
  }

  /**
   * RTCPeerConnection configuration object
   */
  config?: RTCConfiguration

  /**
   * RTCDataChannel configuration object
   */
  channelConfig?: RTCDataChannelInit

  /**
   * Options for creating an offer
   */
  offerOptions?: RTCOfferOptions

  /**
   * Options for creating an answer
   */
  answerOptions?: RTCAnswerOptions

  /**
   * Function to transform SDP before signaling
   */
  sdpTransform?: (sdp: string) => string

  /**
   * MediaStream(s) to add to the connection
   */
  streams?: MediaStream[]

  /**
   * @deprecated Use streams instead
   */
  stream?: MediaStream

  /**
   * Enable trickle ICE
   * @default true
   */
  trickle?: boolean

  /**
   * Allow half trickle
   * @default false
   */
  allowHalfTrickle?: boolean

  /**
   * Timeout for ICE gathering in milliseconds
   * @default 5000
   */
  iceCompleteTimeout?: number

  /**
   * Allow half open connections
   * @default false
   */
  allowHalfOpen?: boolean

  /**
   * Object mode - don't automatically convert strings to Uint8Array
   * @default false
   */
  objectMode?: boolean
}

/**
 * Address information for the peer connection
 */
export interface AddressInfo {
  address: string | undefined
  family: string | undefined
  port: number | undefined
}

/**
 * Event handler types for Peer
 */
export interface PeerEvents {
  signal: (data: SignalData) => void
  connect: () => void
  data: (data: Uint8Array) => void
  stream: (stream: MediaStream) => void
  track: (track: MediaStreamTrack, stream: MediaStream) => void
  close: () => void
  error: (err: Error) => void
  iceStateChange: (iceConnectionState: RTCIceConnectionState, iceGatheringState: RTCIceGatheringState) => void
  iceTimeout: () => void
  signalingStateChange: (state: RTCSignalingState) => void
  negotiated: () => void
  finish: () => void // Internal event for cleanup
  [key: string]: (...args: any[]) => void // Allow dynamic event names
}

/**
 * Stats report from getStats
 */
export type StatsReport = Record<string, unknown>

/**
 * Callback for getStats
 */
export type GetStatsCallback = (err: Error | null, reports?: StatsReport[]) => void

/**
 * Main Peer class interface
 */
export interface IPeer {
  // Static properties
  readonly WEBRTC_SUPPORT: boolean

  // Instance properties
  readonly initiator: boolean
  readonly channelName: string | null
  readonly channelConfig: RTCDataChannelInit
  readonly config: RTCConfiguration
  readonly bufferSize: number
  readonly connected: boolean
  readonly destroyed: boolean
  readonly destroying: boolean

  readonly remoteAddress: string | undefined
  readonly remoteFamily: string | undefined
  readonly remotePort: number | undefined
  readonly localAddress: string | undefined
  readonly localFamily: string | undefined
  readonly localPort: number | undefined

  // Methods
  /**
   * Get address information for the connection
   */
  address(): AddressInfo

  /**
   * Signal peer with offer, answer, or ICE candidate
   */
  signal(data: SignalData | string): void

  /**
   * Send data to the remote peer
   */
  send(data: string | Uint8Array | ArrayBuffer | ArrayBufferView): void

  /**
   * Add a transceiver to the connection
   */
  addTransceiver(kind: string, init?: RTCRtpTransceiverInit): void

  /**
   * Add a MediaStream to the connection
   */
  addStream(stream: MediaStream): void

  /**
   * Add a MediaStreamTrack to the connection
   */
  addTrack(track: MediaStreamTrack, stream: MediaStream): void

  /**
   * Replace a MediaStreamTrack in the connection
   */
  replaceTrack(
    oldTrack: MediaStreamTrack,
    newTrack: MediaStreamTrack | null,
    stream: MediaStream
  ): void

  /**
   * Remove a MediaStreamTrack from the connection
   */
  removeTrack(track: MediaStreamTrack, stream: MediaStream): void

  /**
   * Remove a MediaStream from the connection
   */
  removeStream(stream: MediaStream): void

  /**
   * Trigger negotiation manually
   */
  negotiate(): void

  /**
   * Destroy the peer connection and cleanup
   */
  destroy(err?: Error): void

  /**
   * Get WebRTC statistics
   */
  getStats(callback: GetStatsCallback): void

  // Event emitter methods
  on<K extends keyof PeerEvents>(event: K, listener: PeerEvents[K]): this
  once<K extends keyof PeerEvents>(event: K, listener: PeerEvents[K]): this
  off<K extends keyof PeerEvents>(event: K, listener: PeerEvents[K]): this
  emit<K extends keyof PeerEvents>(event: K, ...args: Parameters<PeerEvents[K]>): boolean
  removeListener<K extends keyof PeerEvents>(event: K, listener: PeerEvents[K]): this
  removeAllListeners(event?: keyof PeerEvents): this
}
