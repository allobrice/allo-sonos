import { buildApp } from './app.js'

async function main() {
  const fastify = await buildApp()

  const gracefulShutdown = async (signal: string) => {
    fastify.log.info(`Received ${signal}, shutting down gracefully...`)
    try {
      await fastify.close()
      fastify.log.info('Server closed successfully')
      process.exit(0)
    } catch (err) {
      fastify.log.error(err, 'Error during shutdown')
      process.exit(1)
    }
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))

  try {
    await fastify.listen({ port: fastify.config.PORT, host: '0.0.0.0' })
  } catch (err) {
    fastify.log.error(err, 'Failed to start server')
    process.exit(1)
  }
}

main()
