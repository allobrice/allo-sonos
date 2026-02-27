<script setup lang="ts">
import { computed } from 'vue'
import type { ZoneState } from '@/stores/zones'

const props = defineProps<{ zone: ZoneState }>()

const isPlaying = computed(() => props.zone.playState === 'PLAYING')
const isOffline = computed(() => !props.zone.reachable)
const isActive = computed(() => isPlaying.value && !isOffline.value)

function sourceLabel(source: string | null): string {
  switch (source) {
    case 'spotify':
      return 'Spotify'
    case 'deezer':
      return 'Deezer'
    case 'tunein':
      return 'TuneIn'
    case 'library':
      return 'Library'
    default:
      return 'Unknown source'
  }
}
</script>

<template>
  <div
    class="zone-card"
    :class="{ active: isActive, offline: isOffline }"
    :aria-label="`Zone ${zone.name}`"
  >
    <!-- Header: zone name + source icon -->
    <div class="zone-header">
      <span class="zone-name">{{ zone.name }}</span>
      <span class="zone-source-icon" :aria-label="sourceLabel(zone.source)">
        <template v-if="zone.source === 'spotify'">
          <!-- Spotify: simplified ring+dots icon -->
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
            />
          </svg>
        </template>
        <template v-else-if="zone.source === 'deezer'">
          <!-- Deezer: stylized D shape -->
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M18.81 10.8h4.69v2.56h-4.69zm0 3.6h4.69v2.56h-4.69zm0-7.2h4.69v2.56h-4.69zM.5 17.76h4.69v2.56H.5zm6.1 0h4.7v2.56H6.6zm6.1 0h4.69v2.56H12.7zm6.11 0h4.69v2.56h-4.69zM6.6 14.4h4.7v2.56H6.6zm6.1 0h4.69v2.56H12.7zm-6.1-3.6h4.7v2.56H6.6zm6.1 0h4.69v2.56H12.7z"
            />
          </svg>
        </template>
        <template v-else-if="zone.source === 'tunein'">
          <!-- TuneIn: radio wave symbol -->
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M12 1a11 11 0 100 22A11 11 0 0012 1zm0 2a9 9 0 110 18A9 9 0 0112 3zm0 3a6 6 0 100 12A6 6 0 0012 6zm0 2a4 4 0 110 8 4 4 0 010-8zm0 2a2 2 0 100 4 2 2 0 000-4z"
            />
          </svg>
        </template>
        <template v-else-if="zone.source === 'library'">
          <!-- Library: music note -->
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
            />
          </svg>
        </template>
        <template v-else>
          <!-- Generic music note fallback -->
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
            />
          </svg>
        </template>
      </span>
    </div>

    <!-- Body: offline / playing / idle -->
    <div class="zone-body">
      <template v-if="isOffline">
        <span class="offline-badge">Offline</span>
      </template>
      <template v-else-if="isActive">
        <div class="now-playing-row">
          <span class="play-icon" aria-hidden="true">&#9654;</span>
          <div class="now-playing">
            <div class="track-title">{{ zone.title || '—' }}</div>
            <div class="track-artist">{{ zone.artist || '—' }}</div>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="idle-state">
          <span aria-hidden="true">&#9835;</span>
          <span>Aucune lecture</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.zone-card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  padding: var(--space-md);
  min-height: 120px;
  position: relative;
  border-left: 3px solid transparent;
  transition: opacity 0.3s ease;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  box-sizing: border-box;
}

.zone-card.active {
  border-left-color: var(--color-accent-green);
}

.zone-card.offline {
  opacity: 0.4;
}

/* Header */
.zone-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-xs);
  min-width: 0;
}

.zone-name {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.zone-source-icon {
  position: absolute;
  top: var(--space-sm);
  right: var(--space-sm);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  opacity: 0.7;
  flex-shrink: 0;
  line-height: 1;
}

/* Body */
.zone-body {
  flex: 1;
  display: flex;
  align-items: center;
  min-width: 0;
}

/* Offline badge */
.offline-badge {
  display: inline-block;
  background: var(--color-border);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  padding: 2px var(--space-sm);
  border-radius: var(--radius-sm);
}

/* Now playing */
.now-playing-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
  width: 100%;
}

.play-icon {
  color: var(--color-accent-green);
  font-size: 0.75rem;
  flex-shrink: 0;
}

.now-playing {
  min-width: 0;
  flex: 1;
}

.track-title {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
}

.track-artist {
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-size-sm);
}

/* Idle state */
.idle-state {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}
</style>
