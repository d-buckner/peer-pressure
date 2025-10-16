/**
 * Test helpers for peer testing
 */

import type Peer from '../../src/peer'
import type { PeerOptions, PeerEvents } from '../../src/types'

interface CreateConnectedPeersOptions {
  peer1?: Partial<PeerOptions>
  peer2?: Partial<PeerOptions>
}

type EventData<K extends keyof PeerEvents> =
  Parameters<PeerEvents[K]> extends []
    ? void
    : Parameters<PeerEvents[K]>[0]

/**
 * Wait for a peer to emit a specific event with proper typing
 */
export function waitForEvent<K extends keyof PeerEvents>(
  peer: Peer,
  eventName: K,
  timeout = 10000
): Promise<EventData<K>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for ${eventName} event`))
    }, timeout)

    const handler = ((...args: unknown[]) => {
      clearTimeout(timer)
      resolve(args[0] as EventData<K>)
    }) as PeerEvents[K]
    peer.once(eventName as string, handler)
  })
}

/**
 * Wait for both peers to connect
 */
export async function waitForConnect(
  peer1: Peer,
  peer2: Peer,
  timeout = 10000
): Promise<void> {
  await Promise.all([
    waitForEvent(peer1, 'connect', timeout),
    waitForEvent(peer2, 'connect', timeout)
  ])
}

/**
 * Setup bidirectional signaling between two peers
 */
export function setupSignaling(peer1: Peer, peer2: Peer): void {
  peer1.on('signal', (data: any) => {
    if (!peer2.destroyed) peer2.signal(data)
  })
  peer2.on('signal', (data: any) => {
    if (!peer1.destroyed) peer1.signal(data)
  })
}

/**
 * Create and connect two peers
 */
export async function createConnectedPeers(
  PeerClass: typeof Peer,
  options: CreateConnectedPeersOptions = {}
): Promise<{ peer1: Peer; peer2: Peer }> {
  const peer1 = new PeerClass({ initiator: true, ...options.peer1 })
  const peer2 = new PeerClass({ ...options.peer2 })

  setupSignaling(peer1, peer2)
  await waitForConnect(peer1, peer2, 15000)

  return { peer1, peer2 }
}

/**
 * Cleanup peers
 */
export function destroyPeers(...peers: (Peer | undefined)[]): void {
  peers.forEach(peer => {
    if (peer && !peer.destroyed) {
      peer.destroy()
    }
  })
}

/**
 * Create a test MediaStream with two tracks
 */
let canvas: HTMLCanvasElement | undefined
export function getMediaStream(): MediaStream {
  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.width = canvas.height = 100
    canvas.getContext('2d') // initialize canvas
  }
  const stream = canvas.captureStream(30)
  stream.addTrack(stream.getTracks()[0]!.clone()) // should have 2 tracks
  return stream
}
