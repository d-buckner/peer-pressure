import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { loadPeer } from '../helpers/loadPeer.js'
import { setupSignaling, waitForConnect, destroyPeers } from '../helpers/peerHelpers.js'

let Peer
const peersToCleanup = []

beforeAll(async () => {
  Peer = await loadPeer()
})

afterEach(() => {
  destroyPeers(...peersToCleanup)
  peersToCleanup.length = 0
})

describe('Trickle ICE Tests', () => {
  it('should disable trickle on both peers', async () => {
    const peer1 = new Peer({ initiator: true, trickle: false })
    const peer2 = new Peer({ trickle: false })
    peersToCleanup.push(peer1, peer2)

    let numSignal1 = 0
    let numSignal2 = 0

    peer1.on('signal', (data) => {
      numSignal1++
      peer2.signal(data)
    })

    peer2.on('signal', (data) => {
      numSignal2++
      peer1.signal(data)
    })

    await waitForConnect(peer1, peer2)

    expect(numSignal1).toBe(1)
    expect(numSignal2).toBe(1)
    expect(peer1.initiator).toBe(true)
    expect(peer2.initiator).toBe(false)
  }, 15000)

  it('should disable trickle only on initiator', async () => {
    const peer1 = new Peer({ initiator: true, trickle: false })
    const peer2 = new Peer()
    peersToCleanup.push(peer1, peer2)

    let numSignal1 = 0
    let numSignal2 = 0

    peer1.on('signal', (data) => {
      numSignal1++
      peer2.signal(data)
    })

    peer2.on('signal', (data) => {
      numSignal2++
      peer1.signal(data)
    })

    await waitForConnect(peer1, peer2)

    expect(numSignal1).toBe(1)
    expect(numSignal2).toBeGreaterThanOrEqual(1)
  }, 15000)

  it('should disable trickle only on receiver', async () => {
    const peer1 = new Peer({ initiator: true })
    const peer2 = new Peer({ trickle: false })
    peersToCleanup.push(peer1, peer2)

    let numSignal1 = 0
    let numSignal2 = 0

    peer1.on('signal', (data) => {
      numSignal1++
      peer2.signal(data)
    })

    peer2.on('signal', (data) => {
      numSignal2++
      peer1.signal(data)
    })

    await waitForConnect(peer1, peer2)

    expect(numSignal1).toBeGreaterThanOrEqual(1)
    expect(numSignal2).toBe(1)
  }, 15000)

  it('should handle null end candidate without throwing', async () => {
    const peer1 = new Peer({ trickle: true, initiator: true })
    const peer2 = new Peer({ trickle: true })
    peersToCleanup.push(peer1, peer2)

    let endCandidateSent = false
    function endToNull(data) {
      if (data.candidate && !data.candidate.candidate) {
        data.candidate.candidate = null
        endCandidateSent = true
      }
      return data
    }

    let errorThrown = false
    peer1.on('error', () => { errorThrown = true })
    peer2.on('error', () => { errorThrown = true })

    peer1.on('signal', (data) => peer2.signal(endToNull(data)))
    peer2.on('signal', (data) => peer1.signal(endToNull(data)))

    await waitForConnect(peer1, peer2)

    if (!endCandidateSent) {
      peer1.signal({ candidate: { candidate: null, sdpMLineIndex: 0, sdpMid: '0' } })
      peer2.signal({ candidate: { candidate: null, sdpMLineIndex: 0, sdpMid: '0' } })
    }

    expect(errorThrown).toBe(false)
  }, 15000)

  it('should handle empty-string end candidate without throwing', async () => {
    const peer1 = new Peer({ trickle: true, initiator: true })
    const peer2 = new Peer({ trickle: true })
    peersToCleanup.push(peer1, peer2)

    let endCandidateSent = false
    function endToEmptyString(data) {
      if (data.candidate && !data.candidate.candidate) {
        data.candidate.candidate = ''
        endCandidateSent = true
      }
      return data
    }

    let errorThrown = false
    peer1.on('error', () => { errorThrown = true })
    peer2.on('error', () => { errorThrown = true })

    peer1.on('signal', (data) => peer2.signal(endToEmptyString(data)))
    peer2.on('signal', (data) => peer1.signal(endToEmptyString(data)))

    await waitForConnect(peer1, peer2)

    if (!endCandidateSent) {
      peer1.signal({ candidate: { candidate: '', sdpMLineIndex: 0, sdpMid: '0' } })
      peer2.signal({ candidate: { candidate: '', sdpMLineIndex: 0, sdpMid: '0' } })
    }

    expect(errorThrown).toBe(false)
  }, 15000)

  it('should handle mDNS candidate without throwing', async () => {
    const peer1 = new Peer({ trickle: true, initiator: true })
    const peer2 = new Peer({ trickle: true })
    peersToCleanup.push(peer1, peer2)

    let errorThrown = false
    peer1.on('error', () => { errorThrown = true })
    peer2.on('error', () => { errorThrown = true })

    setupSignaling(peer1, peer2)

    await waitForConnect(peer1, peer2)

    // Force an mDNS candidate
    const candidate = 'candidate:2053030672 1 udp 2113937151 ede93942-fbc5-4323-9b73-169de626e467.local 55741 typ host generation 0 ufrag HNmH network-cost 999'
    peer1.signal({ candidate: { candidate, sdpMLineIndex: 0, sdpMid: '0' } })
    peer2.signal({ candidate: { candidate, sdpMLineIndex: 0, sdpMid: '0' } })

    await new Promise(resolve => setTimeout(resolve, 100))

    expect(errorThrown).toBe(false)
  }, 15000)

  it('should handle ice candidates received before description', async () => {
    const peer1 = new Peer({ initiator: true })
    const peer2 = new Peer()
    peersToCleanup.push(peer1, peer2)

    const signalQueue1 = []
    peer1.on('signal', (data) => {
      signalQueue1.push(data)
      if (data.candidate) {
        while (signalQueue1[0]) peer2.signal(signalQueue1.pop())
      }
    })

    const signalQueue2 = []
    peer2.on('signal', (data) => {
      signalQueue2.push(data)
      if (data.candidate) {
        while (signalQueue2[0]) peer1.signal(signalQueue2.pop())
      }
    })

    await waitForConnect(peer1, peer2)
  }, 15000)
})
