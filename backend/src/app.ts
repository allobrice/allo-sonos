import Fastify from 'fastify'
import envPlugin from './plugins/env.js'
import healthRoutes from './routes/health.js'

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

  // 2. Routes (depend on env plugin)
  await fastify.register(healthRoutes)

  return fastify
}
