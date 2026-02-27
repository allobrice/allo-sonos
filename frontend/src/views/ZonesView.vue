<script setup lang="ts">
import { useZonesStore } from '@/stores/zones'
import { useWebSocket } from '@/composables/useWebSocket'
import ZoneCard from '@/components/ZoneCard.vue'

const store = useZonesStore()

const { connected } = useWebSocket((event, data) => {
  if (event === 'snapshot') store.applySnapshot(data as any)
  else if (event === 'state_changed') store.applyStateChanged(data as any)
})
</script>

<template>
  <div class="zones-view">
    <!-- Loading skeleton: shown while no zones loaded yet -->
    <div v-if="store.zones.length === 0" class="zones-skeleton">
      <div v-for="i in 4" :key="i" class="skeleton-card" />
    </div>

    <!-- Zone grid: rendered once zones are available -->
    <div v-else class="zones-grid">
      <ZoneCard v-for="zone in store.zones" :key="zone.uuid" :zone="zone" />
    </div>
  </div>
</template>

<style scoped>
.zones-view {
  padding: var(--space-md);
  color: var(--color-text-primary);
}

.zones-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
}

/* Mobile: single column at 375px */
@media (max-width: 540px) {
  .zones-grid {
    grid-template-columns: 1fr;
  }
}

.zones-skeleton {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
}

@media (max-width: 540px) {
  .zones-skeleton {
    grid-template-columns: 1fr;
  }
}

.skeleton-card {
  height: 120px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
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
</style>
