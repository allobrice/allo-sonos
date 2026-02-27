/**
 * gena.ts
 *
 * Fastify plugin that wires GENA/UPnP event subscriptions from @svrooij/sonos
 * to the state cache and WebSocket broadcast.
 *
 * Responsibilities:
 * 1. Configure SonosEventListener host (Pitfall 1: wrong IP on multi-interface systems)
 * 2. Hydrate the state cache at startup via SOAP before GENA events begin
 * 3. Subscribe GENA events:
 *    - Transport (play state, track metadata, source URI) on coordinators only
 *    - Volume + Mute on every speaker (they emit per-speaker, not per-group)
 * 4. Heartbeat poll every 30s to detect offline speakers
 * 5. Clean up subscriptions and intervals on shutdown
 */

import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { SonosEvents, SonosEventListener } from '@svrooij/sonos'
import { readSpeakerState } from '../services/sonos-state.js'
import { parseSource } from '../services/state-cache.js'
import type { ZoneState } from '../services/state-cache.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HEARTBEAT_INTERVAL_MS = 30_000  // 30 seconds

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

const genaPlugin: FastifyPluginAsync = async (fastify) => {
  const { speakers, sonosDevices, stateCache } = fastify

  // Skip if no speakers discovered (degraded mode — Phase 1 decision)
  if (speakers.count === 0) {
    fastify.log.warn('[gena] No speakers discovered — skipping GENA subscriptions')
    return
  }

  // -------------------------------------------------------------------------
  // 1. Configure SonosEventListener host (Pitfall 1)
  // -------------------------------------------------------------------------
  // If SONOS_LISTENER_HOST is set, configure the event listener to use that IP
  // as the callback URL for GENA NOTIFY requests.
  // Critical in environments with multiple network interfaces (Windows Docker, VMs)
  // where auto-detection may pick the wrong IP.
  const listenerHost = fastify.config.SONOS_LISTENER_HOST
  if (listenerHost) {
    SonosEventListener.DefaultInstance.UpdateSettings({ host: listenerHost })
    fastify.log.info('[gena] SonosEventListener host set to %s', listenerHost)
  }

  // -------------------------------------------------------------------------
  // 2. Hydrate state cache with initial state for all speakers
  // -------------------------------------------------------------------------
  // Read current state via SOAP before GENA events begin, so the cache is
  // populated immediately (not empty until the first GENA event arrives).
  for (const speaker of speakers.getAll()) {
    const coordinator = speakers.getCoordinator(speaker.uuid)!
    const state = await readSpeakerState(speaker.ip, coordinator.ip).catch(() => null)
    const initial: ZoneState = {
      uuid: speaker.uuid,
      name: speaker.name,
      playState: state?.playState ?? 'UNKNOWN',
      volume: state?.volume ?? 0,
      muted: state?.muted ?? false,
      title: null,    // Track metadata only comes from GENA events
      artist: null,
      album: null,
      source: null,   // Source only comes from GENA EnqueuedTransportUri
      reachable: state !== null,
      lastSeen: Date.now(),
    }
    stateCache.initialize(speaker.uuid, initial)
    fastify.log.info(
      '[gena] Hydrated "%s" — %s, vol=%d, reachable=%s',
      speaker.name, initial.playState, initial.volume, initial.reachable,
    )
  }

  // -------------------------------------------------------------------------
  // 3. Subscribe GENA events
  // -------------------------------------------------------------------------
  // Two subscription types per research:
  // A) Coordinator devices: transport state + track metadata + source URI
  // B) Every speaker: volume + mute (per-speaker RenderingControl)

  // Track which coordinators we've already subscribed to (avoid duplicates
  // when multiple zone members share the same coordinator)
  const subscribedCoordinators = new Set<string>()

  for (const speaker of speakers.getAll()) {
    const device = sonosDevices.get(speaker.uuid)
    if (!device) {
      fastify.log.warn('[gena] No SonosDevice found for "%s" (%s) — skipping', speaker.name, speaker.uuid)
      continue
    }

    // --- Volume + Mute on EVERY speaker (Pitfall 3) ---
    // Volume events only fire on the specific speaker that received the
    // volume change command. Subscribe on every device, not just coordinators.
    device.Events.on(SonosEvents.Volume, (volume: number) => {
      stateCache.patch(speaker.uuid, { volume })
      stateCache.scheduleUpdate(speaker.uuid)
    })

    device.Events.on(SonosEvents.Mute, (muted: boolean) => {
      stateCache.patch(speaker.uuid, { muted })
      stateCache.scheduleUpdate(speaker.uuid)
    })

    // --- Transport + Track + Source on COORDINATORS only (Pitfall 2) ---
    // CurrentTransportState is only emitted on coordinators that are NOT
    // themselves a member of another group. Zone members only emit simplified
    // group state which would overwrite coordinator state incorrectly.
    if (speaker.isCoordinator && !subscribedCoordinators.has(speaker.uuid)) {
      subscribedCoordinators.add(speaker.uuid)

      device.Events.on(SonosEvents.CurrentTransportState, (transportState: string) => {
        // transportState: 'PLAYING' | 'PAUSED_PLAYBACK' | 'STOPPED' | 'TRANSITIONING'
        stateCache.patch(speaker.uuid, { playState: transportState })
        stateCache.scheduleUpdate(speaker.uuid)
      })

      device.Events.on(SonosEvents.CurrentTrackMetadata, (track) => {
        stateCache.patch(speaker.uuid, {
          title: track.Title ?? null,
          artist: track.Artist ?? null,
          album: track.Album ?? null,
        })
        stateCache.scheduleUpdate(speaker.uuid)
      })

      device.Events.on(SonosEvents.EnqueuedTransportUri, (uri: string) => {
        stateCache.patch(speaker.uuid, { source: parseSource(uri) })
        stateCache.scheduleUpdate(speaker.uuid)
      })

      fastify.log.info('[gena] Subscribed coordinator "%s" — transport + track + source', speaker.name)
    }

    // --- Subscription error handler ---
    device.Events.on(SonosEvents.SubscriptionError, (err) => {
      fastify.log.warn({ err }, '[gena] Subscription error for "%s"', speaker.name)
      // Early warning — heartbeat will confirm if speaker is truly offline
    })

    fastify.log.info('[gena] Subscribed "%s" — volume + mute', speaker.name)
  }

  // -------------------------------------------------------------------------
  // 4. Heartbeat — detect offline speakers
  // -------------------------------------------------------------------------
  // GENA subscriptions silently stop delivering events when a speaker goes
  // offline. A lightweight SOAP call every 30s per speaker detects this.
  // On failure: mark unreachable, broadcast speaker_offline.
  // On recovery: re-read full state, update cache, broadcast speaker_online.

  const heartbeatInterval = setInterval(async () => {
    for (const speaker of speakers.getAll()) {
      const coordinator = speakers.getCoordinator(speaker.uuid)!
      try {
        const state = await readSpeakerState(speaker.ip, coordinator.ip)
        if (state !== null) {
          // Speaker is alive
          if (!stateCache.isReachable(speaker.uuid)) {
            // Was offline, now back — recovery path
            stateCache.markReachable(speaker.uuid, true)
            stateCache.patch(speaker.uuid, {
              playState: state.playState,
              volume: state.volume,
              muted: state.muted,
            })
            fastify.broadcast('speaker_online', { uuid: speaker.uuid, name: speaker.name })
            fastify.log.info('[gena] Speaker "%s" back online', speaker.name)
          }
        } else {
          throw new Error('readSpeakerState returned null')
        }
      } catch {
        // Speaker is unreachable
        if (stateCache.isReachable(speaker.uuid)) {
          stateCache.markReachable(speaker.uuid, false)
          fastify.broadcast('speaker_offline', { uuid: speaker.uuid, name: speaker.name })
          fastify.log.warn('[gena] Speaker "%s" marked offline', speaker.name)
        }
      }
    }
  }, HEARTBEAT_INTERVAL_MS)

  // -------------------------------------------------------------------------
  // 5. Cleanup on shutdown (Pitfall 6)
  // -------------------------------------------------------------------------
  // Cancel GENA subscriptions (sends HTTP UNSUBSCRIBE to speakers) and
  // stop the heartbeat interval to prevent memory leaks.
  fastify.addHook('onClose', async () => {
    clearInterval(heartbeatInterval)
    fastify.log.info('[gena] Heartbeat stopped')

    for (const [uuid, device] of sonosDevices) {
      try {
        device.CancelEvents()
        fastify.log.info('[gena] Cancelled events for %s', uuid)
      } catch (err) {
        fastify.log.warn({ err }, '[gena] Failed to cancel events for %s', uuid)
      }
    }
    fastify.log.info('[gena] All GENA subscriptions cancelled')
  })

  fastify.log.info(
    '[gena] Real-time state sync active — %d speaker(s), %d coordinator(s), heartbeat every %ds',
    speakers.count,
    subscribedCoordinators.size,
    HEARTBEAT_INTERVAL_MS / 1000,
  )
}

export default fp(genaPlugin, {
  name: 'gena',
  dependencies: ['sonos', 'websocket-plugin'],
})
