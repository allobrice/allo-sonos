import type { FastifyPluginAsync } from 'fastify'
import { fetchFavorites } from '../services/sonos-favorites.js'
import { soapAvTransport } from '../services/sonos-commands.js'
import { readSpeakerState } from '../services/sonos-state.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ---------------------------------------------------------------------------
// Shared schemas (mirror the pattern from speakers.ts)
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
// Route plugin
// ---------------------------------------------------------------------------

const favoritesRoutes: FastifyPluginAsync = async (fastify) => {
  // -------------------------------------------------------------------------
  // GET /favorites — list all Sonos favorites (cached, 5-minute TTL)
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: { refresh?: string } }>(
    '/favorites',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: { refresh: { type: 'string' } },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                type: { type: 'string' },
                uri: { type: 'string' },
                albumArtURI: { type: ['string', 'null'] },
              },
              required: ['title', 'type', 'uri', 'albumArtURI'],
            },
          },
          502: {
            type: 'object',
            properties: { error: { type: 'string' }, detail: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const forceRefresh = request.query.refresh === 'true'
      const speakers = fastify.speakers.getAll()

      try {
        const favorites = await fetchFavorites(speakers, forceRefresh)
        return favorites
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err)
        fastify.log.error(`[sonos] fetch-favorites failed: ${detail}`)
        return reply.status(502).send({ error: 'Failed to fetch favorites', detail })
      }
    },
  )

  // -------------------------------------------------------------------------
  // POST /speakers/:id/play-favorite — load URI and start playback on a zone
  // -------------------------------------------------------------------------
  fastify.post<{ Params: { id: string }; Body: { uri: string; type: string } }>(
    '/speakers/:id/play-favorite',
    {
      schema: {
        params: paramsSchema,
        body: {
          type: 'object',
          properties: {
            uri: { type: 'string' },
            type: { type: 'string' },
          },
          required: ['uri', 'type'],
        },
        response: commandResponseSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const { uri, type } = request.body

      const speaker = fastify.speakers.getById(id)
      if (!speaker) return reply.status(404).send({ error: 'Speaker not found', uuid: id })

      const coordinator = fastify.speakers.getCoordinator(id) ?? speaker

      try {
        // SetAVTransportURI loads the favorite URI onto the coordinator.
        // Sonos resolves the queue/stream from the URI internally.
        // Empty metadata string — Sonos resolves everything from the URI itself.
        await soapAvTransport(
          coordinator.ip,
          'SetAVTransportURI',
          `<CurrentURI>${escapeXml(uri)}</CurrentURI><CurrentURIMetaData></CurrentURIMetaData>`,
        )

        // Send Play after loading — SetAVTransportURI only queues, does not auto-play
        await soapAvTransport(coordinator.ip, 'Play', '<Speed>1</Speed>')

        const state = await readSpeakerState(speaker.ip, coordinator.ip)
        fastify.log.info(`[sonos] play-favorite (${type}) → "${speaker.name}"`)
        return { ok: true, state }
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err)
        fastify.log.error(`[sonos] play-favorite failed: ${detail}`)
        return reply.status(502).send({ error: 'Command failed', detail })
      }
    },
  )
}

export default favoritesRoutes
