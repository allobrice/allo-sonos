import fp from 'fastify-plugin'
import fastifyEnv from '@fastify/env'
import type { FastifyPluginAsync } from 'fastify'

const schema = {
  type: 'object',
  required: ['SONOS_PIN'],
  properties: {
    SONOS_PIN: {
      type: 'string',
      minLength: 4,
      maxLength: 4,
    },
    SONOS_SPEAKER_IPS: {
      type: 'string',
      default: '',
    },
    SONOS_LISTENER_HOST: {
      type: 'string',
      default: '',
    },
    PORT: {
      type: 'integer',
      default: 3000,
    },
  },
}

declare module 'fastify' {
  interface FastifyInstance {
    config: {
      SONOS_PIN: string
      SONOS_SPEAKER_IPS: string
      SONOS_LISTENER_HOST: string
      PORT: number
    }
  }
}

const envPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyEnv, {
    schema,
    dotenv: true,
  })
}

export default fp(envPlugin, { name: 'env' })
