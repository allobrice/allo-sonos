import type { DiscoveredDevice } from './discovery.js'

export interface SpeakerInfo {
  uuid: string
  name: string
  ip: string
  groupName: string
  isCoordinator: boolean
  coordinatorUuid: string
}

/**
 * In-memory registry of discovered Sonos speakers.
 *
 * Key: speaker UUID (e.g. RINCON_macaddress01400)
 * Value: SpeakerInfo
 *
 * All command routing must use getCoordinator() to ensure transport commands
 * (play, pause, stop, next, previous) are sent to the zone group coordinator.
 */
export class SpeakerRegistry {
  private readonly map: Map<string, SpeakerInfo> = new Map()

  /**
   * Populate the registry from an array of discovered devices.
   * Previous entries are cleared before populating.
   */
  populate(devices: DiscoveredDevice[]): void {
    this.map.clear()
    for (const d of devices) {
      const info: SpeakerInfo = {
        uuid: d.uuid,
        name: d.name,
        ip: d.ip,
        groupName: d.groupName,
        isCoordinator: d.uuid === d.coordinatorUuid,
        coordinatorUuid: d.coordinatorUuid,
      }
      this.map.set(d.uuid, info)
    }
  }

  /** Return all speakers as an array. */
  getAll(): SpeakerInfo[] {
    return Array.from(this.map.values())
  }

  /** Return a single speaker by UUID, or undefined if not found. */
  getById(uuid: string): SpeakerInfo | undefined {
    return this.map.get(uuid)
  }

  /**
   * Given any speaker UUID, return the SpeakerInfo for its zone group coordinator.
   *
   * This is critical: transport commands (play/pause/stop/next/previous) MUST be
   * sent to the coordinator, not to individual zone members. Sending to the wrong
   * speaker silently fails on real hardware.
   *
   * Falls back to the speaker itself if the coordinator is not in the registry.
   */
  getCoordinator(uuid: string): SpeakerInfo | undefined {
    const speaker = this.map.get(uuid)
    if (!speaker) return undefined
    return this.map.get(speaker.coordinatorUuid) ?? speaker
  }

  /** Remove all entries from the registry. */
  clear(): void {
    this.map.clear()
  }

  /** Number of speakers currently in the registry. */
  get count(): number {
    return this.map.size
  }
}
