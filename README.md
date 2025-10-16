# peer-pressure

Simple WebRTC video/voice and data channels for the browser.

Forked from [simple-peer](https://github.com/feross/simple-peer) and rewritten in TypeScript with zero runtime dependencies and modern tooling.

## Features

- **80% smaller bundle** - 5.6 KB gzipped vs 28.4 KB for simple-peer
- **Zero runtime dependencies** - uses browser-native APIs
- **Full TypeScript support** - complete type definitions included
- **Modular architecture** - signaling, ICE, data-channel, media, stats modules
- **API compatible** - drop-in replacement for simple-peer
- **Modern ES2020+ output** - optimized for current browsers

## Install

```
npm install peer-pressure
```

## Usage

```js
import Peer from 'peer-pressure'

const peer1 = new Peer({ initiator: true })
const peer2 = new Peer()

peer1.on('signal', data => peer2.signal(data))
peer2.on('signal', data => peer1.signal(data))

peer1.on('connect', () => {
  peer1.send('hello from peer1')
})

peer2.on('data', data => {
  console.log('received:', data)
})
```

## API

### `peer = new Peer([opts])`

Create a new WebRTC peer connection.

A "data channel" for text/binary communication is always established, because it's cheap and often useful. For video/voice communication, pass the `stream` option.

If `opts` is specified, then the default options (shown below) will be overridden.

```
{
  initiator: false,
  channelConfig: {},
  channelName: '<random string>',
  config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478?transport=udp' }] },
  offerOptions: {},
  answerOptions: {},
  sdpTransform: function (sdp) { return sdp },
  stream: false,
  streams: [],
  trickle: true,
  allowHalfTrickle: false,
  wrtc: {}, // RTCPeerConnection/RTCSessionDescription/RTCIceCandidate
  objectMode: false
}
```

The options do the following:

- `initiator` - set to `true` if this is the initiating peer
- `channelConfig` - custom webrtc data channel configuration (used by [`createDataChannel`](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createDataChannel))
- `channelName` - custom webrtc data channel name
- `config` - custom webrtc configuration (used by [`RTCPeerConnection`](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection) constructor)
- `offerOptions` - custom offer options (used by [`createOffer`](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createOffer) method)
- `answerOptions` - custom answer options (used by [`createAnswer`](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createAnswer) method)
- `sdpTransform` - function to transform the generated SDP signaling data (for advanced users)
- `stream` - if video/voice is desired, pass stream returned from [`getUserMedia`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- `streams` - an array of MediaStreams returned from [`getUserMedia`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- `trickle` - set to `false` to disable [trickle ICE](http://webrtchacks.com/trickle-ice/) and get a single 'signal' event (slower)
- `wrtc` - custom webrtc implementation, mainly useful in node to specify in the [wrtc](https://npmjs.com/package/wrtc) package. Contains an object with the properties:
  - [`RTCPeerConnection`](https://www.w3.org/TR/webrtc/#dom-rtcpeerconnection)
  - [`RTCSessionDescription`](https://www.w3.org/TR/webrtc/#dom-rtcsessiondescription)
  - [`RTCIceCandidate`](https://www.w3.org/TR/webrtc/#dom-rtcicecandidate)

- `objectMode` - set to `true` to create the stream in [Object Mode](https://nodejs.org/api/stream.html#stream_object_mode). In this mode, incoming string data is not automatically converted to `Buffer` objects.

### `peer.signal(data)`

Call this method whenever the remote peer emits a `peer.on('signal')` event.

The `data` will encapsulate a webrtc offer, answer, or ice candidate. These messages help
the peers to eventually establish a direct connection to each other. The contents of these
strings are an implementation detail that can be ignored by the user of this module;
simply pass the data from 'signal' events to the remote peer and call `peer.signal(data)`
to get connected.

### `peer.send(data)`

Send text/binary data to the remote peer. `data` can be any of several types: `String`,
`Buffer` (see [buffer](https://github.com/feross/buffer)), `ArrayBufferView` (`Uint8Array`,
etc.), `ArrayBuffer`, or `Blob` (in browsers that support it).

Note: If this method is called before the `peer.on('connect')` event has fired, then an exception will be thrown. Use `peer.write(data)` (which is inherited from the node.js [duplex stream](http://nodejs.org/api/stream.html) interface) if you want this data to be buffered instead.

### `peer.addStream(stream)`

Add a `MediaStream` to the connection.

### `peer.removeStream(stream)`

Remove a `MediaStream` from the connection.

### `peer.addTrack(track, stream)`

Add a `MediaStreamTrack` to the connection. Must also pass the `MediaStream` you want to attach it to.

### `peer.removeTrack(track, stream)`

Remove a `MediaStreamTrack` from the connection. Must also pass the `MediaStream` that it was attached to.

### `peer.replaceTrack(oldTrack, newTrack, stream)`

Replace a `MediaStreamTrack` with another track. Must also pass the `MediaStream` that the old track was attached to.

### `peer.addTransceiver(kind, init)`

Add a `RTCRtpTransceiver` to the connection. Can be used to add transceivers before adding tracks. Automatically called as neccesary by `addTrack`.

### `peer.destroy([err])`

Destroy and cleanup this peer connection.

If the optional `err` parameter is passed, then it will be emitted as an `'error'`
event on the stream.

### `Peer.WEBRTC_SUPPORT`

Detect native WebRTC support in the javascript environment.

```js
import Peer from 'peer-pressure'

if (Peer.WEBRTC_SUPPORT) {
  // webrtc support!
} else {
  // fallback
}
```

## Events

### `peer.on('signal', data => {})`

Fired when the peer has signaling data. You must send this to the remote peer via your signaling channel (e.g., WebSocket server).

### `peer.on('connect', () => {})`

Fired when the peer connection and data channel are ready to use.

### `peer.on('data', data => {})`

Received data from the remote peer. `data` is a `Uint8Array` (or `String` in objectMode).

### `peer.on('stream', stream => {})`

Received a remote media stream.

### `peer.on('track', (track, stream) => {})`

Received a remote media track.

### `peer.on('close', () => {})`

Peer connection closed.

### `peer.on('error', (err) => {})`

Fatal error occurred.

## License

MIT. Copyright (c) [Daniel Buckner](https://d-buckner.org).

Forked from [simple-peer](https://github.com/feross/simple-peer) by Feross Aboukhadijeh.
