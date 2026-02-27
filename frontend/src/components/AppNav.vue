<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <nav class="app-nav">
    <RouterLink to="/" class="nav-tab" active-class="active" exact-active-class="active">
      <span class="nav-icon" aria-hidden="true">&#9432;</span>
      <span class="nav-label">Zones</span>
    </RouterLink>
    <RouterLink to="/settings" class="nav-tab" active-class="active">
      <span class="nav-icon" aria-hidden="true">&#9881;</span>
      <span class="nav-label">Settings</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.app-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: calc(var(--nav-height) + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  display: flex;
  align-items: stretch;
  z-index: 100;
}

.nav-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  gap: var(--space-xs);
  text-decoration: none;
  color: var(--color-text-secondary);
  transition: color 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.nav-tab.active {
  color: var(--color-accent-green);
}

.nav-icon {
  font-size: 1.25rem;
  line-height: 1;
}

.nav-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
}
</style>
