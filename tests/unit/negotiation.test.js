import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { loadPeer } from '../helpers/loadPeer.js'
import { waitForEvent, setupSignaling, waitForConnect, destroyPeers } from '../helpers/peerHelpers.js'

let Peer
const peersToCleanup = []

beforeAll(async () => {
  Peer = await loadPeer()
})

afterEach(() => {
  destroyPeers(...peersToCleanup)
  peersToCleanup.length = 0
})

describe('Negotiation Tests', () => {
  it('should handle manual renegotiation', async () => {
    const peer1 = new Peer({ initiator: true })
    const peer2 = new Peer()
    peersToCleanup.push(peer1, peer2)

    setupSignaling(peer1, peer2)

    await waitForConnect(peer1, peer2)

    peer1.negotiate()

    await Promise.all([
      waitForEvent(peer1, 'negotiated'),
      waitForEvent(peer2, 'negotiated')
    ])
  }, 15000)

  it('should handle repeated manual renegotiation', async () => {
    const peer1 = new Peer({ initiator: true })
    const peer2 = new Peer()
    peersToCleanup.push(peer1, peer2)

    setupSignaling(peer1, peer2)

    await waitForConnect(peer1, peer2)

    // First negotiation
    peer1.negotiate()
    await Promise.all([
      waitForEvent(peer1, 'negotiated'),
      waitForEvent(peer2, 'negotiated')
    ])

    // Second negotiation
    peer1.negotiate()
    await Promise.all([
      waitForEvent(peer1, 'negotiated'),
      waitForEvent(peer2, 'negotiated')
    ])

    // Third negotiation
    peer1.negotiate()
    await Promise.all([
      waitForEvent(peer1, 'negotiated'),
      waitForEvent(peer2, 'negotiated')
    ])
  }, 20000)

  it('should support negotiated channels', async () => {
    const peer1 = new Peer({
      initiator: true,
      channelConfig: {
        id: 1,
        negotiated: true
      }
    })
    const peer2 = new Peer({
      channelConfig: {
        id: 1,
        negotiated: true
      }
    })
    peersToCleanup.push(peer1, peer2)

    setupSignaling(peer1, peer2)

    await waitForConnect(peer1, peer2)
  }, 15000)
})
