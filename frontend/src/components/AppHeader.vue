<script setup lang="ts">
import { useWebSocket } from '@/composables/useWebSocket'
import WsIndicator from './WsIndicator.vue'

const { connected } = useWebSocket()
</script>

<template>
  <header class="app-header">
    <span class="app-title"><span class="green">Allo</span><span class="pink">Sonos</span></span>
    <WsIndicator :connected="connected" />
  </header>
</template>

<style scoped>
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--header-height);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-md);
  z-index: 100;
}

.app-title {
  font-weight: 600;
  font-size: var(--font-size-lg);
  color: var(--color-text-primary);
}

.green {
  color: var(--color-accent-green);
}

.pink {
  color: var(--color-accent-pink);
}
</style>
