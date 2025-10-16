/**
 * Test helpers for peer testing
 */

/**
 * Wait for a peer to emit a specific event
 */
export function waitForEvent(peer, eventName, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for ${eventName} event`))
    }, timeout)

    peer.once(eventName, (data) => {
      clearTimeout(timer)
      resolve(data)
    })
  })
}

/**
 * Wait for both peers to connect
 */
export async function waitForConnect(peer1, peer2, timeout = 10000) {
  await Promise.all([
    waitForEvent(peer1, 'connect', timeout),
    waitForEvent(peer2, 'connect', timeout)
  ])
}

/**
 * Setup bidirectional signaling between two peers
 */
export function setupSignaling(peer1, peer2) {
  peer1.on('signal', (data) => {
    if (!peer2.destroyed) peer2.signal(data)
  })
  peer2.on('signal', (data) => {
    if (!peer1.destroyed) peer1.signal(data)
  })
}

/**
 * Create and connect two peers
 */
export async function createConnectedPeers(Peer, options = {}) {
  const peer1 = new Peer({ initiator: true, ...options.peer1 })
  const peer2 = new Peer({ ...options.peer2 })

  setupSignaling(peer1, peer2)
  await waitForConnect(peer1, peer2)

  return { peer1, peer2 }
}

/**
 * Cleanup peers
 */
export function destroyPeers(...peers) {
  peers.forEach(peer => {
    if (peer && !peer.destroyed) {
      peer.destroy()
    }
  })
}

/**
 * Create a test MediaStream with two tracks
 */
let canvas
export function getMediaStream() {
  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.width = canvas.height = 100
    canvas.getContext('2d') // initialize canvas
  }
  const stream = canvas.captureStream(30)
  stream.addTrack(stream.getTracks()[0].clone()) // should have 2 tracks
  return stream
}
