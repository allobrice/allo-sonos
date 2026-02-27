<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import PinPad from '@/components/PinPad.vue'

const router = useRouter()
const auth = useAuthStore()
const pinPadRef = ref<InstanceType<typeof PinPad> | null>(null)

async function handleSubmit(pin: string) {
  const result = await auth.login(pin)
  if (result.success) {
    router.push({ name: 'zones' })
  } else {
    pinPadRef.value?.setError(result.error ?? 'PIN incorrect')
  }
}
</script>

<template>
  <div class="pin-view">
    <h1 class="pin-title">Allo Sonos</h1>
    <PinPad ref="pinPadRef" @submit="handleSubmit" />
  </div>
</template>

<style scoped>
.pin-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: 16px;
  background: var(--color-background, #121212);
}

.pin-title {
  color: var(--color-text-primary, #f5f5f5);
  font-weight: 600;
  font-size: 1.5rem;
  margin-bottom: 2rem;
  letter-spacing: -0.02em;
}
</style>
