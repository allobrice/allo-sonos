import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export interface ZoneState {
  uuid: string
  name: string
  playState: string // 'PLAYING' | 'PAUSED_PLAYBACK' | 'STOPPED' | 'TRANSITIONING' | 'UNKNOWN'
  volume: number // 0-100
  muted: boolean
  title: string | null
  artist: string | null
  album: string | null
  source: string | null // 'spotify' | 'deezer' | 'tunein' | 'library' | null
  reachable: boolean
  lastSeen: number
}

export const useZonesStore = defineStore('zones', () => {
  const _zones = ref<Map<string, ZoneState>>(new Map())

  // Sorted by zone name ascending for stable, predictable grid order
  const zones = computed<ZoneState[]>(() =>
    Array.from(_zones.value.values()).sort((a, b) => a.name.localeCompare(b.name)),
  )

  function applySnapshot(data: ZoneState[]) {
    _zones.value = new Map(data.map((z) => [z.uuid, z]))
  }

  function applyStateChanged(data: ZoneState) {
    _zones.value.set(data.uuid, data)
    // Trigger reactivity — replace the Map reference
    _zones.value = new Map(_zones.value)
  }

  async function sendPlay(uuid: string) {
    const zone = _zones.value.get(uuid)
    if (!zone) return
    const previousPlayState = zone.playState
    // Optimistic update
    _zones.value.set(uuid, { ...zone, playState: 'PLAYING' })
    _zones.value = new Map(_zones.value)
    try {
      const res = await fetch(`/api/speakers/${uuid}/play`, { method: 'POST', credentials: 'include' })
      if (!res.ok) throw new Error('Non-ok response')
    } catch {
      // Silently revert on failure
      const current = _zones.value.get(uuid)
      if (current) {
        _zones.value.set(uuid, { ...current, playState: previousPlayState })
        _zones.value = new Map(_zones.value)
      }
    }
  }

  async function sendPause(uuid: string) {
    const zone = _zones.value.get(uuid)
    if (!zone) return
    const previousPlayState = zone.playState
    // Optimistic update
    _zones.value.set(uuid, { ...zone, playState: 'PAUSED_PLAYBACK' })
    _zones.value = new Map(_zones.value)
    try {
      const res = await fetch(`/api/speakers/${uuid}/pause`, { method: 'POST', credentials: 'include' })
      if (!res.ok) throw new Error('Non-ok response')
    } catch {
      // Silently revert on failure
      const current = _zones.value.get(uuid)
      if (current) {
        _zones.value.set(uuid, { ...current, playState: previousPlayState })
        _zones.value = new Map(_zones.value)
      }
    }
  }

  async function sendNext(uuid: string) {
    // No optimistic playState change for track skip (track change is async)
    try {
      const res = await fetch(`/api/speakers/${uuid}/next`, { method: 'POST', credentials: 'include' })
      if (!res.ok) throw new Error('Non-ok response')
    } catch {
      // Silently ignore — no optimistic state to revert
    }
  }

  async function sendPrevious(uuid: string) {
    // No optimistic playState change for track skip (track change is async)
    try {
      const res = await fetch(`/api/speakers/${uuid}/previous`, { method: 'POST', credentials: 'include' })
      if (!res.ok) throw new Error('Non-ok response')
    } catch {
      // Silently ignore — no optimistic state to revert
    }
  }

  return { zones, applySnapshot, applyStateChanged, sendPlay, sendPause, sendNext, sendPrevious }
})
