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

  return { zones, applySnapshot, applyStateChanged }
})
