<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

async function handleLogout() {
  await auth.logout()
  router.push({ name: 'pin' })
}
</script>

<template>
  <div class="settings-view">
    <h2 class="settings-title">Settings</h2>
    <div class="settings-section">
      <button class="logout-btn" @click="handleLogout">Log out</button>
    </div>
  </div>
</template>

<style scoped>
.settings-view {
  padding: var(--space-lg) 0;
  color: var(--color-text-primary);
  min-height: 100%;
}

.settings-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  margin-bottom: var(--space-lg);
}

.settings-section {
  margin-top: var(--space-md);
}

/* Discreet logout button — not prominent per user decision */
.logout-btn {
  color: var(--color-accent-pink);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
  font-size: var(--font-size-base);
  font-family: inherit;
  cursor: pointer;
  transition: opacity 0.15s ease;
  -webkit-tap-highlight-color: transparent;
  min-height: 44px;
}

.logout-btn:hover {
  opacity: 0.75;
}
</style>
