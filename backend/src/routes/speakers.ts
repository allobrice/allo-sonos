import type { FastifyPluginAsync } from 'fastify'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommandBody {
  command: string
  value?: number
}

// ---------------------------------------------------------------------------
// SOAP helpers (direct HTTP to port 1400 — library command API is broken)
// ---------------------------------------------------------------------------

/** Send a SOAP action to the AVTransport service (play, pause, stop, next, previous) */
async function soapAvTransport(ip: string, action: string, bodyXml: string): Promise<void> {
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
async function soapRenderingControl(ip: string, action: string, bodyXml: string): Promise<void> {
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

// ---------------------------------------------------------------------------
// Command execution (routes to coordinator for transport, direct for rendering)
// ---------------------------------------------------------------------------

/** Transport commands: routed to the zone group coordinator */
const TRANSPORT_COMMANDS = new Set(['play', 'pause', 'stop', 'next', 'previous'])
/** Rendering commands: sent directly to the target speaker */
const RENDERING_COMMANDS = new Set(['volume', 'mute', 'unmute'])

async function executeCommand(
  targetIp: string,
  coordinatorIp: string,
  command: string,
  value?: number,
): Promise<void> {
  switch (command) {
    case 'play':
      await soapAvTransport(coordinatorIp, 'Play', '<Speed>1</Speed>')
      break
    case 'pause':
      await soapAvTransport(coordinatorIp, 'Pause', '')
      break
    case 'stop':
      await soapAvTransport(coordinatorIp, 'Stop', '')
      break
    case 'next':
      await soapAvTransport(coordinatorIp, 'Next', '')
      break
    case 'previous':
      await soapAvTransport(coordinatorIp, 'Previous', '')
      break
    case 'volume': {
      const vol = Math.min(100, Math.max(0, value ?? 20))
      await soapRenderingControl(
        targetIp,
        'SetVolume',
        `<Channel>Master</Channel><DesiredVolume>${vol}</DesiredVolume>`,
      )
      break
    }
    case 'mute':
      await soapRenderingControl(
        targetIp,
        'SetMute',
        '<Channel>Master</Channel><DesiredMute>1</DesiredMute>',
      )
      break
    case 'unmute':
      await soapRenderingControl(
        targetIp,
        'SetMute',
        '<Channel>Master</Channel><DesiredMute>0</DesiredMute>',
      )
      break
    default:
      throw new RangeError(`Unknown command: ${command}`)
  }
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

const speakerRoutes: FastifyPluginAsync = async (fastify) => {
  // -----------------------------------------------------------------------
  // GET /speakers — list all known speakers
  // -----------------------------------------------------------------------
  fastify.get(
    '/speakers',
    {
      schema: {
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                uuid: { type: 'string' },
                name: { type: 'string' },
                ip: { type: 'string' },
                groupName: { type: 'string' },
                isCoordinator: { type: 'boolean' },
                coordinatorUuid: { type: 'string' },
              },
              required: ['uuid', 'name', 'ip', 'groupName', 'isCoordinator', 'coordinatorUuid'],
            },
          },
        },
      },
    },
    async () => {
      return fastify.speakers.getAll()
    },
  )

  // -----------------------------------------------------------------------
  // POST /speakers/:id/command — send a command to a speaker
  // -----------------------------------------------------------------------
  fastify.post<{ Params: { id: string }; Body: CommandBody }>(
    '/speakers/:id/command',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: {
            command: { type: 'string' },
            value: { type: 'number' },
          },
          required: ['command'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              command: { type: 'string' },
              speaker: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              command: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              uuid: { type: 'string' },
            },
          },
          502: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              detail: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const { command, value } = request.body

      // Validate command
      if (!TRANSPORT_COMMANDS.has(command) && !RENDERING_COMMANDS.has(command)) {
        return reply
          .status(400)
          .send({ error: 'Unknown command', command })
      }

      // Resolve target speaker
      const speaker = fastify.speakers.getById(id)
      if (!speaker) {
        return reply
          .status(404)
          .send({ error: 'Speaker not found', uuid: id })
      }

      // Resolve coordinator for transport commands
      const coordinator = fastify.speakers.getCoordinator(id) ?? speaker

      fastify.log.info(
        `[sonos] Command "${command}" → target="${speaker.name}" (${speaker.ip}) coordinator="${coordinator.name}" (${coordinator.ip})`,
      )

      try {
        await executeCommand(speaker.ip, coordinator.ip, command, value)
        return { ok: true, command, speaker: speaker.name }
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err)
        fastify.log.error(`[sonos] Command "${command}" failed: ${detail}`)
        return reply.status(502).send({ error: 'Command failed', detail })
      }
    },
  )
}

export default speakerRoutes
