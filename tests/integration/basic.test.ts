import { describe, it, expect, afterEach } from 'vitest'
import Peer from '../../dist/peer-pressure.js'
import { waitForEvent, setupSignaling, waitForConnect, createConnectedPeers, destroyPeers } from '../helpers/peerHelpers'

const peersToCleanup: Peer[] = []

afterEach(() => {
  destroyPeers(...peersToCleanup)
  peersToCleanup.length = 0
})

describe('Basic Peer Tests', () => {
  it('should detect WebRTC support in browser', () => {
    expect(Peer.WEBRTC_SUPPORT).toBe(true)
  })

  it('should create peer without options in browser', () => {
    const peer = new Peer()
    expect(peer).toBeDefined()
    peer.destroy()
  })

  it('should detect error when RTCPeerConnection throws', async () => {
    const peer = new Peer({
      wrtc: {
        RTCPeerConnection: null as unknown as typeof RTCPeerConnection,
        RTCSessionDescription,
        RTCIceCandidate
      }
    })
    peersToCleanup.push(peer)

    await waitForEvent(peer, 'error')
  })

  it('should emit signal event for initiator', async () => {
    const peer = new Peer({ initiator: true })
    peersToCleanup.push(peer)

    await waitForEvent(peer, 'signal')
  })

  it('should NOT emit signal event for non-initiator', async () => {
    const peer = new Peer({ initiator: false })
    peersToCleanup.push(peer)

    let signalReceived = false
    peer.once('signal', () => { signalReceived = true })

    await new Promise(resolve => setTimeout(resolve, 1000))

    expect(signalReceived).toBe(false)
  })

  it('should send and receive text data between peers', async () => {
    const { peer1, peer2 } = await createConnectedPeers(Peer)
    peersToCleanup.push(peer1, peer2)

    expect(peer1.initiator).toBe(true)
    expect(peer2.initiator).toBe(false)

    peer1.send('sup peer2')
    const data1 = await waitForEvent(peer2, 'data')
    expect(data1 instanceof Uint8Array).toBe(true)
    expect(new TextDecoder().decode(data1)).toBe('sup peer2')

    peer2.send('sup peer1')
    const data2 = await waitForEvent(peer1, 'data')
    expect(data2 instanceof Uint8Array).toBe(true)
    expect(new TextDecoder().decode(data2)).toBe('sup peer1')
  }, 15000)

  it('should call sdpTransform function', async () => {
    let transformCalled = false
    const sdpTransform = (sdp: string): string => {
      expect(typeof sdp).toBe('string')
      transformCalled = true
      return sdp
    }

    const peer1 = new Peer({ initiator: true })
    const peer2 = new Peer({ sdpTransform })
    peersToCleanup.push(peer1, peer2)

    setupSignaling(peer1, peer2)

    await new Promise(resolve => setTimeout(resolve, 1000))

    expect(transformCalled).toBe(true)
  })

  it('should use old constraint formats', async () => {
    const constraints: RTCOfferOptions = {
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    }

    const peer1 = new Peer({ initiator: true, offerOptions: constraints })
    const peer2 = new Peer({ answerOptions: constraints })
    peersToCleanup.push(peer1, peer2)

    setupSignaling(peer1, peer2)

    await waitForConnect(peer1, peer2)
  }, 15000)

  it('should use new constraint formats', async () => {
    const constraints: RTCOfferOptions = {
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    }

    const peer1 = new Peer({ initiator: true, offerOptions: constraints })
    const peer2 = new Peer({ answerOptions: constraints })
    peersToCleanup.push(peer1, peer2)

    setupSignaling(peer1, peer2)

    await waitForConnect(peer1, peer2)
  }, 15000)

  it('should emit iceStateChange events', async () => {
    const peer = new Peer({ initiator: true })
    peersToCleanup.push(peer)

    const iceState = await waitForEvent(peer, 'iceStateChange')
    expect(iceState).toBeDefined()
  })
})
