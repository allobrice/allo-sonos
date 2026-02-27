import type { FastifyInstance, FastifyPluginAsync, FastifyReply } from 'fastify'
import { soapAvTransport, soapRenderingControl } from '../services/sonos-commands.js'
import { readSpeakerState } from '../services/sonos-state.js'
import type { SpeakerInfo } from '../services/registry.js'

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

const paramsSchema = {
  type: 'object' as const,
  properties: { id: { type: 'string' as const } },
  required: ['id'] as const,
}

const commandResponseSchema = {
  200: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      state: {
        anyOf: [
          {
            type: 'object',
            properties: {
              playState: { type: 'string' },
              volume: { type: 'number' },
              muted: { type: 'boolean' },
            },
            required: ['playState', 'volume', 'muted'],
          },
          { type: 'null' },
        ],
      },
    },
    required: ['ok'],
  },
  404: {
    type: 'object',
    properties: { error: { type: 'string' }, uuid: { type: 'string' } },
  },
  502: {
    type: 'object',
    properties: { error: { type: 'string' }, detail: { type: 'string' } },
  },
}

// ---------------------------------------------------------------------------
// DRY command handler helper
// ---------------------------------------------------------------------------

async function handleCommand(
  fastify: FastifyInstance,
  id: string,
  reply: FastifyReply,
  label: string,
  execute: (speaker: SpeakerInfo, coordinator: SpeakerInfo) => Promise<void>,
) {
  const speaker = fastify.speakers.getById(id)
  if (!speaker) return reply.status(404).send({ error: 'Speaker not found', uuid: id })

  const coordinator = fastify.speakers.getCoordinator(id) ?? speaker

  try {
    await execute(speaker, coordinator)
    const state = await readSpeakerState(speaker.ip, coordinator.ip)
    fastify.log.info(`[sonos] ${label} → "${speaker.name}"`)
    return { ok: true, state }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    fastify.log.error(`[sonos] ${label} failed: ${detail}`)
    return reply.status(502).send({ error: 'Command failed', detail })
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
  // POST /speakers/:id/play — PLAY-01
  // -----------------------------------------------------------------------
  fastify.post<{ Params: { id: string } }>(
    '/speakers/:id/play',
    { schema: { params: paramsSchema, response: commandResponseSchema } },
    async (request, reply) => {
      const { id } = request.params
      return handleCommand(fastify, id, reply, `play → "${fastify.speakers.getById(id)?.name ?? id}" via coordinator`, async (_speaker, coordinator) => {
        await soapAvTransport(coordinator.ip, 'Play', '<Speed>1</Speed>')
      })
    },
  )

  // -----------------------------------------------------------------------
  // POST /speakers/:id/pause — PLAY-01
  // -----------------------------------------------------------------------
  fastify.post<{ Params: { id: string } }>(
    '/speakers/:id/pause',
    { schema: { params: paramsSchema, response: commandResponseSchema } },
    async (request, reply) => {
      const { id } = request.params
      return handleCommand(fastify, id, reply, 'pause', async (_speaker, coordinator) => {
        await soapAvTransport(coordinator.ip, 'Pause', '')
      })
    },
  )

  // -----------------------------------------------------------------------
  // POST /speakers/:id/next — PLAY-04
  // -----------------------------------------------------------------------
  fastify.post<{ Params: { id: string } }>(
    '/speakers/:id/next',
    { schema: { params: paramsSchema, response: commandResponseSchema } },
    async (request, reply) => {
      const { id } = request.params
      return handleCommand(fastify, id, reply, 'next', async (_speaker, coordinator) => {
        await soapAvTransport(coordinator.ip, 'Next', '')
      })
    },
  )

  // -----------------------------------------------------------------------
  // POST /speakers/:id/previous — PLAY-04
  // -----------------------------------------------------------------------
  fastify.post<{ Params: { id: string } }>(
    '/speakers/:id/previous',
    { schema: { params: paramsSchema, response: commandResponseSchema } },
    async (request, reply) => {
      const { id } = request.params
      return handleCommand(fastify, id, reply, 'previous', async (_speaker, coordinator) => {
        await soapAvTransport(coordinator.ip, 'Previous', '')
      })
    },
  )

  // -----------------------------------------------------------------------
  // PUT /speakers/:id/volume — PLAY-02
  // -----------------------------------------------------------------------
  fastify.put<{ Params: { id: string }; Body: { level: number } }>(
    '/speakers/:id/volume',
    {
      schema: {
        params: paramsSchema,
        body: {
          type: 'object',
          properties: {
            level: { type: 'integer', minimum: 0, maximum: 100 },
          },
          required: ['level'],
        },
        response: commandResponseSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const { level } = request.body
      return handleCommand(fastify, id, reply, `volume ${level}`, async (speaker) => {
        await soapRenderingControl(
          speaker.ip, // NOTE: volume is per-speaker rendering, NOT coordinator
          'SetVolume',
          `<Channel>Master</Channel><DesiredVolume>${level}</DesiredVolume>`,
        )
      })
    },
  )

  // -----------------------------------------------------------------------
  // POST /speakers/:id/mute — PLAY-03
  // -----------------------------------------------------------------------
  fastify.post<{ Params: { id: string } }>(
    '/speakers/:id/mute',
    { schema: { params: paramsSchema, response: commandResponseSchema } },
    async (request, reply) => {
      const { id } = request.params
      return handleCommand(fastify, id, reply, 'mute', async (speaker) => {
        await soapRenderingControl(
          speaker.ip, // NOTE: mute is per-speaker rendering, NOT coordinator
          'SetMute',
          '<Channel>Master</Channel><DesiredMute>1</DesiredMute>',
        )
      })
    },
  )

  // -----------------------------------------------------------------------
  // POST /speakers/:id/unmute — PLAY-03
  // -----------------------------------------------------------------------
  fastify.post<{ Params: { id: string } }>(
    '/speakers/:id/unmute',
    { schema: { params: paramsSchema, response: commandResponseSchema } },
    async (request, reply) => {
      const { id } = request.params
      return handleCommand(fastify, id, reply, 'unmute', async (speaker) => {
        await soapRenderingControl(
          speaker.ip, // NOTE: unmute is per-speaker rendering, NOT coordinator
          'SetMute',
          '<Channel>Master</Channel><DesiredMute>0</DesiredMute>',
        )
      })
    },
  )

  // -----------------------------------------------------------------------
  // GET /speakers/:id/state — read current state (no command)
  // -----------------------------------------------------------------------
  fastify.get<{ Params: { id: string } }>(
    '/speakers/:id/state',
    {
      schema: {
        params: paramsSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              playState: { type: 'string' },
              volume: { type: 'number' },
              muted: { type: 'boolean' },
            },
            required: ['playState', 'volume', 'muted'],
          },
          404: {
            type: 'object',
            properties: { error: { type: 'string' }, uuid: { type: 'string' } },
          },
          502: {
            type: 'object',
            properties: { error: { type: 'string' }, detail: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params

      const speaker = fastify.speakers.getById(id)
      if (!speaker) return reply.status(404).send({ error: 'Speaker not found', uuid: id })

      const coordinator = fastify.speakers.getCoordinator(id) ?? speaker
      fastify.log.info(`[sonos] state → "${speaker.name}"`)

      const state = await readSpeakerState(speaker.ip, coordinator.ip)
      if (state === null) {
        return reply.status(502).send({ error: 'State read failed', detail: 'Could not read speaker state' })
      }
      return state
    },
  )
}

export default speakerRoutes
