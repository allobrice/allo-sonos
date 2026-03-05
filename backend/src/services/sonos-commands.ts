/**
 * Extract the UPnP error code from a SOAP fault response body.
 *
 * Sonos returns HTTP 500 with a SOAP fault envelope when a command cannot be
 * executed. The fault body includes a UPnP-specific error code that identifies
 * the reason for rejection. Common codes:
 *   701 — Transition not available (NO_MEDIA_PRESENT or wrong transport state)
 *   714 — Illegal seek target
 *   718 — Illegal MIME-type (wrong URI scheme)
 *   802 — Command sent to group member instead of coordinator
 *
 * This function extracts the errorCode from the XML, or returns null if the
 * body is not a recognisable UPnP fault.
 */
function extractUpnpErrorCode(body: string): string | null {
  const match = body.match(/<errorCode>(\d+)<\/errorCode>/)
  return match ? match[1] : null
}

/** Send a SOAP action to the AVTransport service (play, pause, stop, next, previous) */
export async function soapAvTransport(ip: string, action: string, bodyXml: string): Promise<void> {
  const url = `http://${ip}:1400/MediaRenderer/AVTransport/Control`
  const envelope = `<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
            s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:${action} xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
      ${bodyXml}
    </u:${action}>
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
    const upnpCode = extractUpnpErrorCode(text)
    const detail = upnpCode ? `UPnP error ${upnpCode}` : text.slice(0, 200)
    throw new Error(`SOAP AVTransport ${action} failed: HTTP ${res.status} — ${detail}`)
  }
}

/** Send a SOAP action to the RenderingControl service (volume, mute) */
export async function soapRenderingControl(ip: string, action: string, bodyXml: string): Promise<void> {
  const url = `http://${ip}:1400/MediaRenderer/RenderingControl/Control`
  const envelope = `<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
            s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:${action} xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1">
      <InstanceID>0</InstanceID>
      ${bodyXml}
    </u:${action}>
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
    const upnpCode = extractUpnpErrorCode(text)
    const detail = upnpCode ? `UPnP error ${upnpCode}` : text.slice(0, 200)
    throw new Error(`SOAP RenderingControl ${action} failed: HTTP ${res.status} — ${detail}`)
  }
}
