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
  padding: 24px;
  color: var(--color-text-primary, #f5f5f5);
}

.settings-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
}

.settings-section {
  margin-top: 1rem;
}

/* Discreet logout button — not prominent per user decision */
.logout-btn {
  background: transparent;
  border: 1px solid var(--color-border, #2c2c2e);
  color: var(--color-text-secondary, #8e8e93);
  font-size: 0.875rem;
  padding: 8px 16px;
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.15s ease;
}

.logout-btn:hover {
  opacity: 0.75;
}
</style>
