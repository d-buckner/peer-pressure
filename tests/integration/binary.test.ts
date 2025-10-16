import { describe, it, expect, afterEach } from 'vitest'
import Peer from '../../dist/peer-pressure.js'
import { waitForEvent, createConnectedPeers, destroyPeers } from '../helpers/peerHelpers'

const peersToCleanup: Peer[] = []

afterEach(() => {
  destroyPeers(...peersToCleanup)
  peersToCleanup.length = 0
})

describe('Binary Data Tests', () => {
  it('should send and receive Uint8Array', async () => {
    const { peer1, peer2 } = await createConnectedPeers(Peer)
    peersToCleanup.push(peer1, peer2)

    peer1.send(new Uint8Array([0, 1, 2]))
    const data1 = await waitForEvent(peer2, 'data')
    expect(data1 instanceof Uint8Array).toBe(true)
    expect(Array.from(data1)).toEqual([0, 1, 2])

    peer2.send(new Uint8Array([0, 2, 4]))
    const data2 = await waitForEvent(peer1, 'data')
    expect(data2 instanceof Uint8Array).toBe(true)
    expect(Array.from(data2)).toEqual([0, 2, 4])
  }, 15000)

  it('should send and receive ArrayBuffer', async () => {
    const { peer1, peer2 } = await createConnectedPeers(Peer)
    peersToCleanup.push(peer1, peer2)

    peer1.send(new Uint8Array([0, 1, 2]).buffer)
    const data1 = await waitForEvent(peer2, 'data')
    expect(data1 instanceof Uint8Array).toBe(true)
    expect(Array.from(data1)).toEqual([0, 1, 2])

    peer2.send(new Uint8Array([0, 2, 4]).buffer)
    const data2 = await waitForEvent(peer1, 'data')
    expect(data2 instanceof Uint8Array).toBe(true)
    expect(Array.from(data2)).toEqual([0, 2, 4])
  }, 15000)

  it('should send and receive typed arrays (Uint16Array, Uint32Array)', async () => {
    const { peer1, peer2 } = await createConnectedPeers(Peer)
    peersToCleanup.push(peer1, peer2)

    // Uint16Array
    const arr16 = new Uint16Array([256, 512, 1024])
    peer1.send(arr16)
    const data1 = await waitForEvent(peer2, 'data')
    expect(data1 instanceof Uint8Array).toBe(true)
    // Verify the bytes are correct
    const received16 = new Uint16Array(data1.buffer, data1.byteOffset, data1.byteLength / 2)
    expect(Array.from(received16)).toEqual([256, 512, 1024])
  }, 15000)
})
