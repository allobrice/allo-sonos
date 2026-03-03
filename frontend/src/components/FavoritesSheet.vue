<script setup lang="ts">
import { watch } from 'vue'
import { useFavoritesStore, type Favorite } from '@/stores/favorites'

const props = defineProps<{
  visible: boolean
  zoneName: string
  zoneUuid: string
}>()

const emit = defineEmits<{
  close: []
}>()

const favStore = useFavoritesStore()

watch(
  () => props.visible,
  (val) => {
    if (val) {
      favStore.loadFavorites()
    }
  },
)

function typeIconPath(type: string): string {
  switch (type) {
    case 'station':
      return 'M3.24 6.15C2.51 6.43 2 7.17 2 8v12c0 1.1.89 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2H8.3l8.26-3.34-.37-.92L3.24 6.15zM7 20c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm0-4c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z'
    case 'playlist':
      return 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z'
    case 'album':
      return 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z'
    default:
      return 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z'
  }
}

function handleSelect(fav: Favorite) {
  favStore.playFavorite(props.zoneUuid, fav)
  emit('close')
}

function handleBackdropClick() {
  emit('close')
}

function handleRetry() {
  favStore.reloadFavorites()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="visible" class="sheet-overlay" @click.self="handleBackdropClick">
        <div class="sheet-panel">
          <!-- Header -->
          <div class="sheet-header">
            <span class="sheet-title">Favoris — {{ zoneName }}</span>
            <button class="sheet-close-btn" aria-label="Fermer" @click="emit('close')">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path
                  d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                />
              </svg>
            </button>
          </div>

          <!-- Loading skeleton -->
          <div v-if="favStore.loading" class="sheet-body">
            <div v-for="i in 4" :key="i" class="skeleton-line" />
          </div>

          <!-- Error state -->
          <div v-else-if="favStore.error" class="sheet-body sheet-error">
            <p>{{ favStore.error }}</p>
            <button class="retry-btn" @click="handleRetry">Reessayer</button>
          </div>

          <!-- Empty state -->
          <div v-else-if="favStore.favorites.length === 0" class="sheet-body sheet-empty">
            <p>Aucun favori Sonos</p>
          </div>

          <!-- Favorites list -->
          <div v-else class="sheet-body sheet-list">
            <button
              v-for="fav in favStore.favorites"
              :key="fav.uri"
              class="fav-item"
              @click="handleSelect(fav)"
            >
              <svg
                class="fav-icon"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path :d="typeIconPath(fav.type)" />
              </svg>
              <span class="fav-title">{{ fav.title }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet-panel {
  background: var(--color-surface);
  width: 100%;
  max-width: var(--app-max-width);
  max-height: 50vh;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.sheet-title {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text-primary);
}

.sheet-close-btn {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: var(--space-xs);
  min-width: 36px;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sheet-body {
  overflow-y: auto;
  flex: 1;
}

.skeleton-line {
  height: 44px;
  margin: var(--space-xs) var(--space-md);
  border-radius: var(--radius-sm);
  background: var(--color-border);
  opacity: 0.6;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

@keyframes skeleton-pulse {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.7;
  }
}

.sheet-error {
  padding: var(--space-lg) var(--space-md);
  text-align: center;
  color: var(--color-text-secondary);
}

.retry-btn {
  background: var(--color-border);
  color: var(--color-text-primary);
  border: none;
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-sm);
  cursor: pointer;
  margin-top: var(--space-sm);
  font-size: var(--font-size-sm);
}

.sheet-empty {
  padding: var(--space-lg) var(--space-md);
  text-align: center;
  color: var(--color-text-secondary);
}

.fav-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  background: none;
  border: none;
  padding: var(--space-sm) var(--space-md);
  cursor: pointer;
  color: var(--color-text-primary);
  text-align: left;
  font-size: var(--font-size-sm);
  min-height: 44px;
  -webkit-tap-highlight-color: transparent;
}

.fav-item:active {
  opacity: 0.6;
}

.fav-icon {
  flex-shrink: 0;
  color: var(--color-text-secondary);
}

.fav-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

/* Transition animations — slide-up ~250ms on open, slide-down on close */
.sheet-enter-active {
  transition: opacity 0.25s ease-out;
}
.sheet-enter-active .sheet-panel {
  transition: transform 0.25s ease-out;
}
.sheet-leave-active {
  transition: opacity 0.2s ease-in;
}
.sheet-leave-active .sheet-panel {
  transition: transform 0.2s ease-in;
}
.sheet-enter-from {
  opacity: 0;
}
.sheet-enter-from .sheet-panel {
  transform: translateY(100%);
}
.sheet-leave-to {
  opacity: 0;
}
.sheet-leave-to .sheet-panel {
  transform: translateY(100%);
}
</style>
