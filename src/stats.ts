/**
 * Stats module - handles WebRTC stats gathering and connection readiness
 */

import { debug } from './utils'
import type { PeerContext } from './peer-context'

type StatsReport = Record<string, unknown>
type GetStatsCallback = (err: Error | null, reports?: StatsReport[]) => void

export class StatsManager {
  constructor(private ctx: PeerContext) {}

  getStats(cb: GetStatsCallback): void {
    const flattenValues = (report: StatsReport): StatsReport => {
      if (Object.prototype.toString.call(report.values) === '[object Array]') {
        (report.values as StatsReport[]).forEach(value => {
          Object.assign(report, value)
        })
      }
      return report
    }

    // Promise-based getStats() (standard)
    if (this.ctx._pc.getStats.length === 0 || this.ctx._isReactNativeWebrtc) {
      this.ctx._pc.getStats()
        .then(res => {
          const reports: StatsReport[] = []
          res.forEach(report => {
            reports.push(flattenValues(report as StatsReport))
          })
          cb(null, reports)
        }, err => cb(err))
      return
    }

    // Single-parameter callback-based getStats() (non-standard)
    if (this.ctx._pc.getStats.length > 0) {
      type LegacyResult = {
        names: () => string[]
        stat: (name: string) => unknown
        id: string
        type: string
        timestamp: number
      }

      type LegacyResponse = {
        result: () => LegacyResult[]
      }

      const legacyGetStats = this.ctx._pc.getStats as unknown as (
        success: (res: LegacyResponse) => void,
        error: (err: Error) => void
      ) => void

      legacyGetStats(res => {
        // If we destroy connection in `connect` callback this code might happen to run when actual connection is already closed
        if (this.ctx.destroyed) return

        const reports: StatsReport[] = []
        res.result().forEach((result: LegacyResult) => {
          const report: StatsReport = {}
          result.names().forEach(name => {
            report[name] = result.stat(name)
          })
          report.id = result.id
          report.type = result.type
          report.timestamp = result.timestamp
          reports.push(flattenValues(report))
        })
        cb(null, reports)
      }, err => cb(err))
      return
    }

    // Unknown browser, skip getStats() since it's anyone's guess which style they implement
    cb(null, [])
  }

  maybeReady(): void {
    debug(this.ctx._id, 'maybeReady pc %s channel %s', this.ctx._pcReady, this.ctx._channelReady)

    if (this.ctx._connected) return
    if (this.ctx._connecting) return
    if (!this.ctx._pcReady) return
    if (!this.ctx._channelReady) return

    this.ctx._connecting = true

    // HACK: We can't rely on order here, for details see https://github.com/js-platform/node-webrtc/issues/339
    this.findCandidatePair()
  }

  private findCandidatePair(): void {
    if (this.ctx.destroyed) return

    this.getStats((err, items) => {
      if (this.ctx.destroyed) return

      // Treat getStats error as non-fatal. It's not essential.
      if (err) items = []

      const remoteCandidates: Record<string, StatsReport> = {}
      const localCandidates: Record<string, StatsReport> = {}
      const candidatePairs: Record<string, StatsReport> = {}
      let foundSelectedCandidatePair = false

      items!.forEach(item => {
        // TODO: Once all browsers support the hyphenated stats report types, remove the non-hypenated ones
        if (item.type === 'remotecandidate' || item.type === 'remote-candidate') {
          remoteCandidates[item.id as string] = item
        }
        if (item.type === 'localcandidate' || item.type === 'local-candidate') {
          localCandidates[item.id as string] = item
        }
        if (item.type === 'candidatepair' || item.type === 'candidate-pair') {
          candidatePairs[item.id as string] = item
        }
      })

      const setSelectedCandidatePair = (selectedCandidatePair: StatsReport) => {
        foundSelectedCandidatePair = true

        let local = localCandidates[selectedCandidatePair.localCandidateId as string]

        if (local?.ip || local?.address) {
          // Spec
          this.ctx.localAddress = (local.ip || local.address) as string
          this.ctx.localPort = Number(local.port)
        }

        if (local?.ipAddress) {
          // Firefox
          this.ctx.localAddress = local.ipAddress as string
          this.ctx.localPort = Number(local.portNumber)
        }

        if (typeof selectedCandidatePair.googLocalAddress === 'string') {
          // TODO: remove this once Chrome 58 is released
          const parts = selectedCandidatePair.googLocalAddress.split(':')
          this.ctx.localAddress = parts[0]
          this.ctx.localPort = Number(parts[1])
        }

        if (this.ctx.localAddress) {
          this.ctx.localFamily = this.ctx.localAddress.includes(':') ? 'IPv6' : 'IPv4'
        }

        let remote = remoteCandidates[selectedCandidatePair.remoteCandidateId as string]

        if (remote?.ip || remote?.address) {
          // Spec
          this.ctx.remoteAddress = (remote.ip || remote.address) as string
          this.ctx.remotePort = Number(remote.port)
        }

        if (remote?.ipAddress) {
          // Firefox
          this.ctx.remoteAddress = remote.ipAddress as string
          this.ctx.remotePort = Number(remote.portNumber)
        }

        if (typeof selectedCandidatePair.googRemoteAddress === 'string') {
          // TODO: remove this once Chrome 58 is released
          const parts = selectedCandidatePair.googRemoteAddress.split(':')
          this.ctx.remoteAddress = parts[0]
          this.ctx.remotePort = Number(parts[1])
        }

        if (this.ctx.remoteAddress) {
          this.ctx.remoteFamily = this.ctx.remoteAddress.includes(':') ? 'IPv6' : 'IPv4'
        }

        debug(
          this.ctx._id,
          'connect local: %s:%s remote: %s:%s',
          this.ctx.localAddress,
          this.ctx.localPort,
          this.ctx.remoteAddress,
          this.ctx.remotePort
        )
      }

      items!.forEach(item => {
        // Spec-compliant
        if (item.type === 'transport' && item.selectedCandidatePairId) {
          const pair = candidatePairs[item.selectedCandidatePairId as string]
          if (pair) {
            setSelectedCandidatePair(pair)
          }
        }

        // Old implementations
        if (
          (item.type === 'googCandidatePair' && item.googActiveConnection === 'true') ||
          ((item.type === 'candidatepair' || item.type === 'candidate-pair') && item.selected)
        ) {
          setSelectedCandidatePair(item)
        }
      })

      // Ignore candidate pair selection in browsers like Safari 11 that do not have any local or remote candidates
      // But wait until at least 1 candidate pair is available
      const shouldWait = !foundSelectedCandidatePair &&
        (!Object.keys(candidatePairs).length || Object.keys(localCandidates).length)

      if (shouldWait) {
        setTimeout(() => this.findCandidatePair(), 100)
        return
      }

      this.ctx._connecting = false
      this.ctx._connected = true

      this.handlePendingChunk()
      this.setupBackpressureInterval()

      debug(this.ctx._id, 'connect')
      this.ctx.emit('connect')
    })
  }

  private handlePendingChunk(): void {
    if (!this.ctx._chunk) return

    try {
      this.ctx.send(this.ctx._chunk)
    } catch (err) {
      this.ctx.destroy(err as Error)
      return
    }

    this.ctx._chunk = null
    debug(this.ctx._id, 'sent chunk from "write before connect"')

    const cb = this.ctx._cb
    this.ctx._cb = null
    cb?.(null)
  }

  private setupBackpressureInterval(): void {
    // If `bufferedAmountLowThreshold` and 'onbufferedamountlow' are unsupported,
    // fallback to using setInterval to implement backpressure.
    if (!this.ctx._channel) return
    if (typeof this.ctx._channel.bufferedAmountLowThreshold === 'number') return

    this.ctx._interval = setInterval(() => this.ctx._onInterval(), 150)

    if (this.ctx._interval.unref) {
      this.ctx._interval.unref()
    }
  }
}
