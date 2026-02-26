import Fastify from 'fastify'
import envPlugin from './plugins/env.js'
import sonosPlugin from './plugins/sonos.js'
import healthRoutes from './routes/health.js'
import speakerRoutes from './routes/speakers.js'

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

  // 2. Sonos plugin — runs SSDP discovery and populates speaker registry
  await fastify.register(sonosPlugin)

  // 3. Routes (depend on env plugin and sonos plugin)
  await fastify.register(healthRoutes)
  await fastify.register(speakerRoutes)

  return fastify
}
