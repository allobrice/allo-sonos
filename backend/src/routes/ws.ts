/**
 * ws.ts
 *
 * GET /ws — WebSocket endpoint.
 *
 * On connection, the server immediately pushes a full state snapshot so the
 * client can render the current zone state without waiting for a GENA event.
 *
 * This is a server→client only channel. No incoming message handling is
 * implemented (per user decision — clients issue commands via REST, not WS).
 */

import type { FastifyPluginAsync } from 'fastify'

const wsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/ws', { websocket: true }, (socket, _req) => {
    // SYNCHRONOUS block — attach handlers and send snapshot before any async work.
    // @fastify/websocket requires event handler attachment synchronously
    // (see Pitfall 5 in research: handlers attached after an await may be missed).

    // Push full state snapshot immediately on connect
    const snapshot = fastify.stateCache.getAll()
    socket.send(JSON.stringify({ event: 'snapshot', data: snapshot }))
    fastify.log.info('[ws] Client connected, snapshot sent (%d zones)', snapshot.length)

    socket.on('close', () => {
      fastify.log.info('[ws] Client disconnected')
    })

    // No incoming message handling — server→client only per user decision.
    // Clients use REST endpoints for commands.
  })
}

export default wsRoutes
