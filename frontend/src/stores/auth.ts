import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', () => {
  // Hydrate from localStorage synchronously to prevent auth flash
  const _authenticated = ref(localStorage.getItem('auth') === 'true')

  const isAuthenticated = computed(() => _authenticated.value)

  async function login(pin: string): Promise<{ success: boolean; error?: string }> {
    const res = await fetch('/api/auth/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ pin }),
    })
    if (res.ok) {
      _authenticated.value = true
      localStorage.setItem('auth', 'true')
      return { success: true }
    }
    const body = await res.json().catch(() => ({}))
    return { success: false, error: body.message ?? 'PIN incorrect' }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    _authenticated.value = false
    localStorage.removeItem('auth')
  }

  return { isAuthenticated, login, logout }
})
