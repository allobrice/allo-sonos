import { XMLParser } from 'fast-xml-parser'

// Single shared parser instance — removeNSPrefix strips namespace prefixes so keys
// are e.g. Envelope.Body.GetTransportInfoResponse rather than s:Envelope.s:Body.u:GetTransportInfoResponse
const parser = new XMLParser({ removeNSPrefix: true })

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SpeakerState {
  playState: string // Raw Sonos value: "PLAYING", "PAUSED_PLAYBACK", "STOPPED", "TRANSITIONING", "NO_MEDIA_PRESENT"
  volume: number   // 0-100
  muted: boolean   // true/false (coerced from Sonos 0/1)
}

// ---------------------------------------------------------------------------
// Internal SOAP read helpers
// ---------------------------------------------------------------------------

/** Read the current transport state from the zone group coordinator. */
async function soapGetTransportInfo(coordinatorIp: string): Promise<string> {
  const url = `http://${coordinatorIp}:1400/MediaRenderer/AVTransport/Control`
  const action = 'GetTransportInfo'
  const envelope = `<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
            s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:GetTransportInfo xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
    </u:GetTransportInfo>
  </s:Body>
</s:Envelope>`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset="utf-8"',
      SOAPAction: `"urn:schemas-upnp-org:service:AVTransport:1#${action}"`,
    },
    body: envelope,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`SOAP AVTransport ${action} failed: HTTP ${res.status} — ${text.slice(0, 200)}`)
  }

  const text = await res.text()
  const parsed = parser.parse(text)
  return parsed?.Envelope?.Body?.GetTransportInfoResponse?.CurrentTransportState ?? 'UNKNOWN'
}

/** Read the current volume level from the target speaker. */
async function soapGetVolume(targetIp: string): Promise<number> {
  const url = `http://${targetIp}:1400/MediaRenderer/RenderingControl/Control`
  const action = 'GetVolume'
  const envelope = `<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
            s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:GetVolume xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1">
      <InstanceID>0</InstanceID>
      <Channel>Master</Channel>
    </u:GetVolume>
  </s:Body>
</s:Envelope>`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset="utf-8"',
      SOAPAction: `"urn:schemas-upnp-org:service:RenderingControl:1#${action}"`,
    },
    body: envelope,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`SOAP RenderingControl ${action} failed: HTTP ${res.status} — ${text.slice(0, 200)}`)
  }

  const text = await res.text()
  const parsed = parser.parse(text)
  return Number(parsed?.Envelope?.Body?.GetVolumeResponse?.CurrentVolume ?? 0)
}

/** Read the current mute state from the target speaker. */
async function soapGetMute(targetIp: string): Promise<boolean> {
  const url = `http://${targetIp}:1400/MediaRenderer/RenderingControl/Control`
  const action = 'GetMute'
  const envelope = `<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
            s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:GetMute xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1">
      <InstanceID>0</InstanceID>
      <Channel>Master</Channel>
    </u:GetMute>
  </s:Body>
</s:Envelope>`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset="utf-8"',
      SOAPAction: `"urn:schemas-upnp-org:service:RenderingControl:1#${action}"`,
    },
    body: envelope,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`SOAP RenderingControl ${action} failed: HTTP ${res.status} — ${text.slice(0, 200)}`)
  }

  const text = await res.text()
  const parsed = parser.parse(text)
  const raw = parsed?.Envelope?.Body?.GetMuteResponse?.CurrentMute
  // Sonos returns integer 0/1 for mute state, not a boolean — coerce explicitly
  return raw === 1 || raw === '1'
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read the current state of a Sonos speaker by running three SOAP reads in parallel.
 *
 * Returns null on ANY error — state reading is best-effort. A command succeeding
 * but state reading failing should not cause the command endpoint to return an error.
 *
 * @param targetIp     IP of the target speaker (for volume and mute)
 * @param coordinatorIp IP of the zone group coordinator (for transport state)
 */
export async function readSpeakerState(
  targetIp: string,
  coordinatorIp: string,
): Promise<SpeakerState | null> {
  try {
    const [playState, volume, muted] = await Promise.all([
      soapGetTransportInfo(coordinatorIp),
      soapGetVolume(targetIp),
      soapGetMute(targetIp),
    ])
    return { playState, volume, muted }
  } catch {
    return null // Best-effort: user decision says state failure != command failure
  }
}
