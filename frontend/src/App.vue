<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppHeader from '@/components/AppHeader.vue'
import AppNav from '@/components/AppNav.vue'

const auth = useAuthStore()
</script>

<template>
  <!-- Unauthenticated: full-screen PIN view, no shell -->
  <RouterView v-if="!auth.isAuthenticated" />

  <!-- Authenticated: app shell with header + content + nav -->
  <div v-else class="app-shell">
    <AppHeader />
    <main class="app-content">
      <RouterView />
    </main>
    <AppNav />
  </div>
</template>

<style scoped>
.app-shell {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
}

.app-content {
  flex: 1;
  overflow-y: auto;
  padding-top: var(--header-height);
  padding-bottom: calc(var(--nav-height) + env(safe-area-inset-bottom, 0px));
  max-width: var(--app-max-width);
  width: 100%;
  margin: 0 auto;
  padding-left: var(--space-md);
  padding-right: var(--space-md);
}
</style>
