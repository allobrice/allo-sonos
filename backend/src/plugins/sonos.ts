import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { SonosDevice } from '@svrooij/sonos'
import { discoverSpeakers } from '../services/discovery.js'
import { SpeakerRegistry } from '../services/registry.js'

// ---------------------------------------------------------------------------
// TypeScript augmentation — extend FastifyInstance with sonos decorations
// ---------------------------------------------------------------------------
declare module 'fastify' {
  interface FastifyInstance {
    /** In-memory speaker registry — use for GET /speakers and coordinator routing */
    speakers: SpeakerRegistry
    /**
     * Raw SonosDevice objects keyed by speaker UUID.
     * Used by the command endpoint to retrieve the target device's IP for SOAP calls.
     */
    sonosDevices: Map<string, SonosDevice>
  }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

const sonosPlugin: FastifyPluginAsync = async (fastify) => {
  // Retrieve manual IP list from the env config (validated by envPlugin)
  const manualIps: string = fastify.config.SONOS_SPEAKER_IPS ?? ''

  // 1. Run discovery (SSDP first, manual fallback)
  const discovered = await discoverSpeakers(manualIps)

  // 2. Build the speaker registry
  const registry = new SpeakerRegistry()
  registry.populate(discovered)

  // 3. Build a UUID → SonosDevice map for the command layer
  const deviceMap = new Map<string, SonosDevice>()
  for (const d of discovered) {
    deviceMap.set(d.uuid, d.device)
  }

  // 4. Count unique zone groups (coordinators)
  const groupCount = registry
    .getAll()
    .filter((s) => s.isCoordinator).length

  fastify.log.info(
    `[sonos] Speaker registry: ${registry.count} speaker(s) in ${groupCount} zone group(s)`,
  )

  // 5. Decorate the Fastify instance
  fastify.decorate('speakers', registry)
  fastify.decorate('sonosDevices', deviceMap)
}

export default fp(sonosPlugin, {
  name: 'sonos',
  dependencies: ['env'], // env plugin must run first so fastify.config is available
})
