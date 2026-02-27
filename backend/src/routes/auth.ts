import type { FastifyPluginAsync } from 'fastify'

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/auth/pin — validate PIN and set session cookie
  fastify.post<{ Body: { pin: string } }>('/api/auth/pin', {
    schema: {
      body: {
        type: 'object',
        required: ['pin'],
        properties: { pin: { type: 'string' } },
      },
      response: {
        200: { type: 'object', properties: { ok: { type: 'boolean' } } },
        401: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const { pin } = request.body
    if (pin !== fastify.config.SONOS_PIN) {
      return reply.status(401).send({ message: 'PIN incorrect' })
    }
    // Set httpOnly cookie valid for 1 year (no-expiry session per user decision)
    reply.setCookie('session', 'authenticated', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
    return { ok: true }
  })

  // POST /api/auth/logout — clear session cookie
  fastify.post('/api/auth/logout', async (_request, reply) => {
    reply.clearCookie('session', { path: '/' })
    return { ok: true }
  })
}

export default authRoutes
