/**
 * Test helper to load SimplePeer from the TypeScript build
 * Returns the SimplePeer constructor (Peer class)
 */
export async function loadPeer() {
  if (typeof window === 'undefined') {
    throw new Error('loadPeer() can only be used in browser environment')
  }

  // Check if already loaded
  if (window.SimplePeer) {
    return window.SimplePeer.Peer
  }

  // Load the new TypeScript build (UMD bundle)
  const script = document.createElement('script')
  script.src = '/dist/peer-pressure.umd.js'
  document.head.appendChild(script)

  await new Promise((resolve, reject) => {
    script.onload = resolve
    script.onerror = () => reject(new Error('Failed to load peer-pressure.umd.js'))
  })

  return window.SimplePeer.Peer
}
