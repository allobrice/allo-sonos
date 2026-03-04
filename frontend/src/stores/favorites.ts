import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface Favorite {
  title: string
  type: string // 'station' | 'playlist' | 'album' | 'other'
  uri: string
  albumArtURI: string | null
}

export const useFavoritesStore = defineStore('favorites', () => {
  const favorites = ref<Favorite[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadFavorites() {
    // Frontend cache — if already loaded, return immediately
    // Backend already has a 5-min TTL cache
    if (favorites.value.length > 0) return

    loading.value = true
    error.value = null

    try {
      const res = await fetch('/api/favorites', { credentials: 'include' })
      if (!res.ok) throw new Error('Non-ok response')
      const data: Favorite[] = await res.json()
      favorites.value = data
    } catch (err) {
      error.value = 'Impossible de charger les favoris'
    } finally {
      loading.value = false
    }
  }

  async function reloadFavorites() {
    // Force-clear cache then re-fetch (used by retry button)
    favorites.value = []
    await loadFavorites()
  }

  async function playFavorite(zoneUuid: string, favorite: Favorite) {
    // Fire-and-forget — WebSocket will push the new state
    try {
      await fetch(`/api/speakers/${zoneUuid}/play-favorite`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri: favorite.uri, type: favorite.type }),
      })
    } catch (err) {
      console.warn('[favorites] playFavorite failed:', err)
    }
  }

  return { favorites, loading, error, loadFavorites, reloadFavorites, playFavorite }
})
