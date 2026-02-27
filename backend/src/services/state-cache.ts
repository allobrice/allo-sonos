/**
 * state-cache.ts
 *
 * In-memory ZoneState cache for all Sonos zones.
 * Provides per-UUID debounced broadcast so rapid GENA events
 * (e.g., volume + mute in one batch) result in a single WS push.
 */

// ---------------------------------------------------------------------------
// ZoneState interface — locked by user decision
// ---------------------------------------------------------------------------

export interface ZoneState {
  uuid: string
  name: string
  playState: string        // 'PLAYING' | 'PAUSED_PLAYBACK' | 'STOPPED' | 'TRANSITIONING' | 'UNKNOWN'
  volume: number           // 0-100
  muted: boolean
  title: string | null     // Current track title
  artist: string | null    // Current track artist
  album: string | null     // Current track album
  source: string | null    // 'spotify' | 'deezer' | 'tunein' | 'library' | null
  reachable: boolean       // false = speaker offline (last state preserved)
  lastSeen: number         // Date.now() timestamp
}

// ---------------------------------------------------------------------------
// parseSource — map EnqueuedTransportURI to a readable source label
// ---------------------------------------------------------------------------

/**
 * Identify the streaming source from a Sonos EnqueuedTransportURI string.
 *
 * Note on Deezer: x-deezer-user: prefix is MEDIUM confidence (community docs).
 * The uri.includes('deezer') fallback is a safety net.
 * Log the raw URI during development to validate on real hardware.
 */
export function parseSource(uri: string | undefined | null): string | null {
  if (!uri) return null

  if (uri.startsWith('x-sonos-spotify:'))                  return 'spotify'

  if (uri.startsWith('x-deezer-user:') ||
      uri.includes('deezer'))                               return 'deezer'

  if (uri.startsWith('x-sonosapi-radio:') ||
      uri.startsWith('x-sonosapi-stream:') ||
      uri.startsWith('x-rincon-mp3radio:') ||
      uri.startsWith('hls-radio:'))                         return 'tunein'

  if (uri.startsWith('x-file-cifs:') ||
      uri.startsWith('x-rincon-playlist:'))                 return 'library'

  return null  // Unknown source — do not guess
}

// ---------------------------------------------------------------------------
// StateCache class
// ---------------------------------------------------------------------------

export class StateCache {
  private readonly zones: Map<string, ZoneState> = new Map()
  private readonly debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private readonly broadcastFn: (event: string, data: unknown) => void

  /**
   * Debounce window in milliseconds.
   * Multiple rapid patches for the same UUID (e.g., volume + mute in a single
   * GENA event batch) result in a single broadcast after 300ms of quiet.
   * User decision — 300ms.
   */
  private static readonly DEBOUNCE_MS = 300

  constructor(broadcastFn: (event: string, data: unknown) => void) {
    this.broadcastFn = broadcastFn
  }

  // -------------------------------------------------------------------------
  // Read operations
  // -------------------------------------------------------------------------

  /** Return all zone states as an array (used for snapshot on WS connect). */
  getAll(): ZoneState[] {
    return Array.from(this.zones.values())
  }

  /** Return a single zone state by UUID. */
  get(uuid: string): ZoneState | undefined {
    return this.zones.get(uuid)
  }

  /** Check if a speaker is currently reachable. */
  isReachable(uuid: string): boolean {
    return this.zones.get(uuid)?.reachable ?? false
  }

  // -------------------------------------------------------------------------
  // Write operations
  // -------------------------------------------------------------------------

  /**
   * Set initial state for a speaker.
   * Called at startup before GENA events begin flowing.
   */
  initialize(uuid: string, state: ZoneState): void {
    this.zones.set(uuid, state)
  }

  /**
   * Synchronously merge partial state into the existing zone state.
   *
   * CRITICAL: This is synchronous — no async.
   * The cache write and scheduleUpdate call must be in the same synchronous
   * block to prevent debounce race conditions (Pitfall 4 in research notes).
   *
   * uuid and name are excluded from the partial type to prevent accidentally
   * overwriting identity fields.
   */
  patch(uuid: string, partial: Partial<Omit<ZoneState, 'uuid' | 'name'>>): void {
    const existing = this.zones.get(uuid)
    if (!existing) return  // Ignore patches for unknown speakers
    Object.assign(existing, partial, { lastSeen: Date.now() })
  }

  /**
   * Mark a speaker as reachable or unreachable.
   * When marking reachable, lastSeen is refreshed.
   * Last known state is preserved when marking unreachable.
   */
  markReachable(uuid: string, reachable: boolean): void {
    const existing = this.zones.get(uuid)
    if (!existing) return
    existing.reachable = reachable
    if (reachable) existing.lastSeen = Date.now()
  }

  // -------------------------------------------------------------------------
  // Debounce / broadcast
  // -------------------------------------------------------------------------

  /**
   * Schedule a debounced broadcast of the zone's current state.
   *
   * Multiple rapid calls for the same UUID (e.g., volume + mute in one GENA
   * batch) result in a single broadcast after DEBOUNCE_MS of quiet.
   * Each new call resets the timer for that UUID.
   */
  scheduleUpdate(uuid: string): void {
    const existing = this.debounceTimers.get(uuid)
    if (existing) clearTimeout(existing)

    this.debounceTimers.set(uuid, setTimeout(() => {
      this.debounceTimers.delete(uuid)
      const state = this.zones.get(uuid)
      if (state) {
        this.broadcastFn('state_changed', state)
      }
    }, StateCache.DEBOUNCE_MS))
  }

  /**
   * Cancel all pending debounce timers.
   * Call on fastify.close() to prevent memory leaks and dangling timers
   * after server shutdown.
   */
  clearTimers(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    this.debounceTimers.clear()
  }
}
