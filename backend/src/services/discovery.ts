import { SonosManager, SonosDevice } from '@svrooij/sonos'

export interface DiscoveredDevice {
  uuid: string
  name: string
  ip: string
  /** UUID of the zone group coordinator */
  coordinatorUuid: string
  /** Name of the zone group */
  groupName: string
  /** Raw SonosDevice reference for SOAP command routing */
  device: SonosDevice
}

/**
 * Discover Sonos speakers on the local network.
 *
 * Strategy:
 *   1. Attempt SSDP discovery (5-second timeout) via @svrooij/sonos SonosManager
 *   2. If SSDP finds zero speakers or throws, fall back to manually configured IPs
 *      (SONOS_SPEAKER_IPS env var — comma-separated list of IPs)
 *   3. If both strategies find nothing, log an error and return an empty array.
 *      The app starts in degraded mode instead of crashing.
 */
export async function discoverSpeakers(
  manualIps?: string,
): Promise<DiscoveredDevice[]> {
  // --- Strategy 1: SSDP discovery ---
  let devices = await trySsdpDiscovery()

  // --- Strategy 2: Manual IP fallback ---
  if (devices.length === 0) {
    const ips = parseManualIps(manualIps)
    if (ips.length > 0) {
      devices = await tryManualIpDiscovery(ips)
    }
  }

  if (devices.length === 0) {
    console.error(
      '[sonos] No Sonos speakers found. Check network or set SONOS_SPEAKER_IPS.',
    )
  }

  return devices
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function trySsdpDiscovery(): Promise<DiscoveredDevice[]> {
  try {
    console.info('[sonos] Starting SSDP discovery (5s timeout)…')
    const manager = new SonosManager()
    const found = await manager.InitializeWithDiscovery(5)
    if (!found) {
      console.warn('[sonos] SSDP discovery returned no devices')
      return []
    }

    const rawDevices = manager.Devices
    if (!rawDevices || rawDevices.length === 0) {
      console.warn('[sonos] SSDP discovery found zero devices')
      return []
    }

    console.info(`[sonos] SSDP discovered ${rawDevices.length} device(s)`)
    return mapDevices(rawDevices)
  } catch (err) {
    console.warn(
      '[sonos] SSDP discovery failed, will attempt manual IP fallback.',
      err instanceof Error ? err.message : String(err),
    )
    return []
  }
}

async function tryManualIpDiscovery(ips: string[]): Promise<DiscoveredDevice[]> {
  console.info(`[sonos] Manual IP fallback: initialising from ${ips[0]}`)
  try {
    const manager = new SonosManager()
    // InitializeFromDevice discovers all devices from a single seed IP
    const found = await manager.InitializeFromDevice(ips[0]!)
    if (!found) {
      console.warn('[sonos] Manual IP initialisation returned no devices')
      return []
    }

    const rawDevices = manager.Devices
    if (!rawDevices || rawDevices.length === 0) {
      console.warn('[sonos] Manual IP fallback found zero devices')
      return []
    }

    console.info(`[sonos] Manual IP fallback found ${rawDevices.length} device(s)`)
    return mapDevices(rawDevices)
  } catch (err) {
    console.warn(
      '[sonos] Manual IP fallback failed.',
      err instanceof Error ? err.message : String(err),
    )
    return []
  }
}

function mapDevices(rawDevices: SonosDevice[]): DiscoveredDevice[] {
  return rawDevices.map((d) => {
    const coordinator = d.Coordinator
    const coordinatorUuid = coordinator.Uuid
    const groupName = d.GroupName ?? coordinator.Name ?? 'Unknown Group'

    const info: DiscoveredDevice = {
      uuid: d.Uuid,
      name: d.Name,
      ip: d.Host,
      coordinatorUuid,
      groupName,
      device: d,
    }

    console.info(
      `[sonos] Found speaker: ${info.name} (${info.ip}) UUID=${info.uuid} group="${info.groupName}" coordinator=${coordinatorUuid}`,
    )

    return info
  })
}

function parseManualIps(raw?: string): string[] {
  if (!raw || raw.trim() === '') return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}
