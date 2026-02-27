import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import envPlugin from './plugins/env.js'
import sonosPlugin from './plugins/sonos.js'
import wsPlugin from './plugins/websocket.js'
import genaPlugin from './plugins/gena.js'
import healthRoutes from './routes/health.js'
import speakerRoutes from './routes/speakers.js'
import wsRoutes from './routes/ws.js'
import authRoutes from './routes/auth.js'

export async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: 'info',
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty' }
          : undefined,
    },
  })

  // 1. Env plugin — validates and exposes config; must be first
  await fastify.register(envPlugin)

  // 2. Cookie plugin — must be registered before auth routes use setCookie
  await fastify.register(cookie)

  // 3. Sonos plugin — runs SSDP discovery and populates speaker registry
  await fastify.register(sonosPlugin)

  // 4. WebSocket plugin — registers @fastify/websocket, creates state cache + broadcast
  //    MUST be before routes so upgrade requests are intercepted
  await fastify.register(wsPlugin)

  // 5. GENA plugin — subscribes to Sonos events, hydrates state cache, starts heartbeat
  await fastify.register(genaPlugin)

  // 6. Routes (depend on env, sonos, websocket, and gena plugins)
  await fastify.register(healthRoutes)
  await fastify.register(speakerRoutes)
  await fastify.register(wsRoutes)
  await fastify.register(authRoutes)

  return fastify
}
