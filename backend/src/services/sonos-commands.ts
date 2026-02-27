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
    throw new Error(`SOAP AVTransport ${action} failed: HTTP ${res.status} — ${text.slice(0, 200)}`)
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
    throw new Error(`SOAP RenderingControl ${action} failed: HTTP ${res.status} — ${text.slice(0, 200)}`)
  }
}
