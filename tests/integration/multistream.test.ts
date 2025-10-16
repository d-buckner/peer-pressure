import { describe, it, expect, afterEach } from 'vitest'
import Peer from '../../dist/peer-pressure.js'
import { waitForEvent, setupSignaling, waitForConnect, destroyPeers, getMediaStream } from '../helpers/peerHelpers'

const peersToCleanup: Peer[] = []


afterEach(() => {
  destroyPeers(...peersToCleanup)
  peersToCleanup.length = 0
})

describe('Multistream Tests', () => {
  it('should handle multiple streams at once', async () => {
    const streams1 = Array.from({ length: 10 }, () => getMediaStream())
    const streams2 = Array.from({ length: 10 }, () => getMediaStream())

    const peer1 = new Peer({ initiator: true, streams: streams1 })
    const peer2 = new Peer({ streams: streams2 })
    peersToCleanup.push(peer1, peer2)

    setupSignaling(peer1, peer2)

    const receivedIds: Record<string, boolean> = {}
    let peer1StreamCount = 0
    let peer2StreamCount = 0

    const streamPromise = new Promise<void>((resolve) => {
      peer1.on('stream', (stream: MediaStream) => {
        expect(receivedIds[stream.id]).toBeUndefined()
        receivedIds[stream.id] = true
        peer1StreamCount++
        if (peer1StreamCount === 10 && peer2StreamCount === 10) resolve()
      })

      peer2.on('stream', (stream: MediaStream) => {
        expect(receivedIds[stream.id]).toBeUndefined()
        receivedIds[stream.id] = true
        peer2StreamCount++
        if (peer1StreamCount === 10 && peer2StreamCount === 10) resolve()
      })
    })

    await streamPromise
    expect(peer1StreamCount).toBe(10)
    expect(peer2StreamCount).toBe(10)
  }, 20000)

  it('should handle multiple streams with track events', async () => {
    const streams1 = Array.from({ length: 5 }, () => getMediaStream())
    const streams2 = Array.from({ length: 5 }, () => getMediaStream())

    const peer1 = new Peer({ initiator: true, streams: streams1 })
    const peer2 = new Peer({ streams: streams2 })
    peersToCleanup.push(peer1, peer2)

    setupSignaling(peer1, peer2)

    const receivedIds: Record<string, boolean> = {}
    let peer1TrackCount = 0
    let peer2TrackCount = 0

    const trackPromise = new Promise<void>((resolve) => {
      peer1.on('track', (track: MediaStreamTrack) => {
        expect(receivedIds[track.id]).toBeUndefined()
        receivedIds[track.id] = true
        peer1TrackCount++
        if (peer1TrackCount === 10 && peer2TrackCount === 10) resolve()
      })

      peer2.on('track', (track: MediaStreamTrack) => {
        expect(receivedIds[track.id]).toBeUndefined()
        receivedIds[track.id] = true
        peer2TrackCount++
        if (peer1TrackCount === 10 && peer2TrackCount === 10) resolve()
      })
    })

    await trackPromise
    expect(peer1TrackCount).toBe(10)
    expect(peer2TrackCount).toBe(10)
  }, 20000)

  it('should handle multiple streams on non-initiator only', async () => {
    const streams = Array.from({ length: 10 }, () => getMediaStream())

    const peer1 = new Peer({ initiator: true, streams: [] })
    const peer2 = new Peer({ streams })
    peersToCleanup.push(peer1, peer2)

    let transceiverRequestCount = 0
    const receivedIds: Record<string, boolean> = {}
    let streamCount = 0

    const streamPromise = new Promise<void>((resolve) => {
      peer1.on('signal', (data: any) => {
        if (data.transceiverRequest) transceiverRequestCount++
        if (!peer2.destroyed) peer2.signal(data)
      })

      peer2.on('signal', (data: any) => {
        if (data.transceiverRequest) transceiverRequestCount++
        if (!peer1.destroyed) peer1.signal(data)
      })

      peer1.on('stream', (stream: MediaStream) => {
        expect(receivedIds[stream.id]).toBeUndefined()
        receivedIds[stream.id] = true
        streamCount++
        if (streamCount === 10) resolve()
      })
    })

    await streamPromise
    expect(streamCount).toBe(10)
    expect(transceiverRequestCount).toBeGreaterThan(0)
  }, 20000)

  it('should handle delayed stream on non-initiator', async () => {
    const stream1 = getMediaStream()

    const peer1 = new Peer({ initiator: true, trickle: true, streams: [stream1] })
    const peer2 = new Peer({ trickle: true, streams: [] })
    peersToCleanup.push(peer1, peer2)

    setupSignaling(peer1, peer2)
    await waitForConnect(peer1, peer2)

    const streamPromise = waitForEvent(peer1, 'stream')

    setTimeout(() => {
      peer2.addStream(getMediaStream())
    }, 1000)

    await streamPromise
  }, 20000)

  it('should handle incremental multistream', async () => {
    const peer1 = new Peer({ initiator: true, streams: [] })
    const peer2 = new Peer({ streams: [] })
    peersToCleanup.push(peer1, peer2)

    setupSignaling(peer1, peer2)

    const receivedIds: Record<string, boolean> = {}
    let peer1StreamCount = 0
    let peer2StreamCount = 0

    const streamPromise = new Promise<void>((resolve) => {
      peer1.on('connect', () => {
        peer1.addStream(getMediaStream())
      })

      peer2.on('connect', () => {
        peer2.addStream(getMediaStream())
      })

      peer1.on('stream', (stream: MediaStream) => {
        expect(receivedIds[stream.id]).toBeUndefined()
        receivedIds[stream.id] = true
        peer1StreamCount++
        if (peer1StreamCount < 5) {
          peer1.addStream(getMediaStream())
        }
        if (peer1StreamCount === 5 && peer2StreamCount === 5) resolve()
      })

      peer2.on('stream', (stream: MediaStream) => {
        expect(receivedIds[stream.id]).toBeUndefined()
        receivedIds[stream.id] = true
        peer2StreamCount++
        if (peer2StreamCount < 5) {
          peer2.addStream(getMediaStream())
        }
        if (peer1StreamCount === 5 && peer2StreamCount === 5) resolve()
      })
    })

    await streamPromise
    expect(peer1StreamCount).toBe(5)
    expect(peer2StreamCount).toBe(5)
  }, 20000)

  it('should handle incremental multistream with track events', async () => {
    const peer1 = new Peer({ initiator: true, streams: [] })
    const peer2 = new Peer({ streams: [] })
    peersToCleanup.push(peer1, peer2)

    setupSignaling(peer1, peer2)

    const receivedIds: Record<string, boolean> = {}
    let peer1TrackCount = 0
    let peer2TrackCount = 0

    const trackPromise = new Promise<void>((resolve) => {
      peer1.on('connect', () => {
        peer1.addStream(getMediaStream())
      })

      peer2.on('connect', () => {
        peer2.addStream(getMediaStream())
      })

      peer1.on('track', (track: MediaStreamTrack) => {
        expect(receivedIds[track.id]).toBeUndefined()
        receivedIds[track.id] = true
        peer1TrackCount++
        if (peer1TrackCount % 2 === 0 && peer1TrackCount < 10) {
          peer1.addStream(getMediaStream())
        }
        if (peer1TrackCount === 10 && peer2TrackCount === 10) resolve()
      })

      peer2.on('track', (track: MediaStreamTrack) => {
        expect(receivedIds[track.id]).toBeUndefined()
        receivedIds[track.id] = true
        peer2TrackCount++
        if (peer2TrackCount % 2 === 0 && peer2TrackCount < 10) {
          peer2.addStream(getMediaStream())
        }
        if (peer1TrackCount === 10 && peer2TrackCount === 10) resolve()
      })
    })

    await trackPromise
    expect(peer1TrackCount).toBe(10)
    expect(peer2TrackCount).toBe(10)
  }, 20000)

  it('should handle incremental multistream on non-initiator only', async () => {
    const peer1 = new Peer({ initiator: true, streams: [] })
    const peer2 = new Peer({ streams: [] })
    peersToCleanup.push(peer1, peer2)

    setupSignaling(peer1, peer2)

    const receivedIds: Record<string, boolean> = {}
    let streamCount = 0
    let connected = false

    const streamPromise = new Promise<void>((resolve) => {
      peer2.on('connect', () => {
        connected = true
        peer2.addStream(getMediaStream())
      })

      peer1.on('stream', (stream: MediaStream) => {
        expect(receivedIds[stream.id]).toBeUndefined()
        receivedIds[stream.id] = true
        streamCount++
        if (streamCount < 5) {
          peer2.addStream(getMediaStream())
        } else {
          resolve()
        }
      })
    })

    await streamPromise
    expect(connected).toBe(true)
    expect(streamCount).toBe(5)
  }, 20000)

  it('should handle incremental multistream on non-initiator only with track events', async () => {
    const peer1 = new Peer({ initiator: true, streams: [] })
    const peer2 = new Peer({ streams: [] })
    peersToCleanup.push(peer1, peer2)

    setupSignaling(peer1, peer2)

    const receivedIds: Record<string, boolean> = {}
    let trackCount = 0
    let connected = false

    const trackPromise = new Promise<void>((resolve) => {
      peer2.on('connect', () => {
        connected = true
        peer2.addStream(getMediaStream())
      })

      peer1.on('track', (track: MediaStreamTrack) => {
        expect(receivedIds[track.id]).toBeUndefined()
        receivedIds[track.id] = true
        trackCount++
        if (trackCount % 2 === 0 && trackCount < 10) {
          peer2.addStream(getMediaStream())
        }
        if (trackCount === 10) resolve()
      })
    })

    await trackPromise
    expect(connected).toBe(true)
    expect(trackCount).toBe(10)
  }, 20000)

  it('should handle addStream after removeStream', async () => {
    const stream1 = getMediaStream()
    const stream2 = getMediaStream()

    const peer1 = new Peer({ initiator: true })
    const peer2 = new Peer({ streams: [stream1] })
    peersToCleanup.push(peer1, peer2)

    setupSignaling(peer1, peer2)

    let streamReceivedCount = 0

    const streamPromise = new Promise<void>((resolve) => {
      peer1.on('stream', () => {
        streamReceivedCount++
        if (streamReceivedCount === 1) {
          peer2.removeStream(stream1)
          setTimeout(() => {
            peer2.addStream(stream2)
          }, 1000)
        } else if (streamReceivedCount === 2) {
          resolve()
        }
      })
    })

    await streamPromise
    expect(streamReceivedCount).toBe(2)
  }, 20000)

  it('should handle removeTrack immediately', async () => {
    const peer1 = new Peer({ initiator: true })
    const peer2 = new Peer()
    peersToCleanup.push(peer1, peer2)

    setupSignaling(peer1, peer2)

    const stream1 = getMediaStream()
    const stream2 = getMediaStream()

    peer1.addTrack(stream1.getTracks()[0], stream1)
    peer2.addTrack(stream2.getTracks()[0], stream2)

    peer1.removeTrack(stream1.getTracks()[0], stream1)
    peer2.removeTrack(stream2.getTracks()[0], stream2)

    let trackReceived = false
    peer1.on('track', () => { trackReceived = true })
    peer2.on('track', () => { trackReceived = true })

    await waitForConnect(peer1, peer2)

    expect(trackReceived).toBe(false)
  }, 15000)

  it('should handle replaceTrack', async () => {
    const peer1 = new Peer({ initiator: true })
    const peer2 = new Peer()
    peersToCleanup.push(peer1, peer2)

    setupSignaling(peer1, peer2)

    const stream1 = getMediaStream()
    const stream2 = getMediaStream()

    peer1.addTrack(stream1.getTracks()[0], stream1)
    peer2.addTrack(stream2.getTracks()[0], stream2)

    peer1.replaceTrack(stream1.getTracks()[0], stream2.getTracks()[0], stream1)
    peer2.replaceTrack(stream2.getTracks()[0], stream1.getTracks()[0], stream2)

    let peer1TrackReceived = false
    let peer2TrackReceived = false

    peer1.on('track', (_track: MediaStreamTrack, _stream: MediaStream) => {
      peer1TrackReceived = true
      peer2.replaceTrack(stream2.getTracks()[0], null, stream2)
    })

    peer2.on('track', (_track: MediaStreamTrack, _stream: MediaStream) => {
      peer2TrackReceived = true
      peer1.replaceTrack(stream1.getTracks()[0], null, stream1)
    })

    await waitForConnect(peer1, peer2)

    expect(peer1TrackReceived).toBe(true)
    expect(peer2TrackReceived).toBe(true)
  }, 15000)
})
