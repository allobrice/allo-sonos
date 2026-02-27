/**
 * websocket.ts
 *
 * Fastify plugin that:
 * 1. Registers @fastify/websocket (must be before routes — it intercepts upgrade requests)
 * 2. Creates the StateCache with a broadcast function injected as the callback
 * 3. Decorates the Fastify instance with `broadcast()` and `stateCache`
 *
 * Registered as 'websocket-plugin' with dependency on 'sonos' so the speaker
 * registry is available when state initialisation runs in Plan 03-02.
 */

import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import websocketPlugin from '@fastify/websocket'
import type { WebSocket } from 'ws'
import { StateCache } from '../services/state-cache.js'

declare module 'fastify' {
  interface FastifyInstance {
    /** Broadcast a JSON message to all connected WebSocket clients. */
    broadcast(event: string, data: unknown): void
    /** In-memory state cache for all Sonos zones. */
    stateCache: StateCache
  }
}

const wsPlugin: FastifyPluginAsync = async (fastify) => {
  // 1. Register @fastify/websocket — MUST be before any WebSocket routes
  //    so it can intercept HTTP upgrade requests.
  await fastify.register(websocketPlugin)

  // 2. Build broadcast function — iterates connected clients and sends JSON.
  //    readyState === 1 corresponds to WebSocket.OPEN (avoids importing the
  //    ws constant just for a numeric comparison).
  const broadcast = (event: string, data: unknown): void => {
    const message = JSON.stringify({ event, data })
    for (const client of fastify.websocketServer.clients) {
      if ((client as WebSocket).readyState === 1 /* WebSocket.OPEN */) {
        client.send(message)
      }
    }
  }

  // 3. Create state cache, injecting the broadcast function as the callback.
  //    This decouples the cache from the WebSocket plugin — no circular dependency.
  const stateCache = new StateCache(broadcast)

  // 4. Decorate Fastify instance so routes and other plugins can access both.
  fastify.decorate('broadcast', broadcast)
  fastify.decorate('stateCache', stateCache)

  // 5. Cancel debounce timers on shutdown to prevent memory leaks.
  fastify.addHook('onClose', async () => {
    stateCache.clearTimers()
  })
}

export default fp(wsPlugin, {
  name: 'websocket-plugin',
  dependencies: ['sonos'],  // Sonos plugin must run first so speakers are available
})
