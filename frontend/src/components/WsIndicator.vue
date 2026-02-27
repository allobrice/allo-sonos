<script setup lang="ts">
defineProps<{ connected: boolean }>()
</script>

<template>
  <span class="ws-indicator" :class="{ connected }" :title="connected ? 'Connected' : 'Disconnected'">
    <span class="ws-dot" />
    <span class="ws-label">{{ connected ? 'Live' : 'Offline' }}</span>
  </span>
</template>

<style scoped>
.ws-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.ws-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent-pink);
  transition: background 0.3s ease;
}

.ws-indicator.connected .ws-dot {
  background: var(--color-accent-green);
}

.ws-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}
</style>
