import { describe, it, expect, afterEach } from 'vitest'
import Peer from '../../dist/peer-pressure.js'
import { waitForEvent, createConnectedPeers, destroyPeers } from '../helpers/peerHelpers'

const peersToCleanup: Peer[] = []

afterEach(() => {
  destroyPeers(...peersToCleanup)
  peersToCleanup.length = 0
})

describe('Object Mode Tests', () => {
  it('should send and receive strings in object mode', async () => {
    const { peer1, peer2 } = await createConnectedPeers(Peer, {
      peer1: { objectMode: true },
      peer2: { objectMode: true }
    })
    peersToCleanup.push(peer1, peer2)

    peer1.send('this is a string')
    const data1 = await waitForEvent(peer2, 'data')
    expect(typeof data1).toBe('string')
    expect(data1).toBe('this is a string')

    peer2.send('this is another string')
    const data2 = await waitForEvent(peer1, 'data')
    expect(typeof data2).toBe('string')
    expect(data2).toBe('this is another string')
  }, 15000)

  it('should send and receive Uint8Array in object mode', async () => {
    const { peer1, peer2 } = await createConnectedPeers(Peer, {
      peer1: { objectMode: true },
      peer2: { objectMode: true }
    })
    peersToCleanup.push(peer1, peer2)

    peer1.send(new Uint8Array([0, 1, 2]))
    const data1 = await waitForEvent(peer2, 'data')
    expect(data1 instanceof Uint8Array).toBe(true)
    expect(Array.from(data1)).toEqual([0, 1, 2])

    peer2.send(new Uint8Array([1, 2, 3]))
    const data2 = await waitForEvent(peer1, 'data')
    expect(data2 instanceof Uint8Array).toBe(true)
    expect(Array.from(data2)).toEqual([1, 2, 3])
  }, 15000)

  it('should send and receive ArrayBuffer in object mode', async () => {
    const { peer1, peer2 } = await createConnectedPeers(Peer, {
      peer1: { objectMode: true },
      peer2: { objectMode: true }
    })
    peersToCleanup.push(peer1, peer2)

    peer1.send(new Uint8Array([0, 1, 2]).buffer)
    const data = await waitForEvent(peer2, 'data')
    expect(data instanceof Uint8Array).toBe(true)
    expect(Array.from(data)).toEqual([0, 1, 2])
  }, 15000)
})
