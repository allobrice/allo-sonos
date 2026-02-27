import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/pin',
      name: 'pin',
      component: () => import('@/views/PinView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      name: 'zones',
      component: () => import('@/views/ZonesView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

// CRITICAL: useAuthStore() MUST be called INSIDE beforeEach, NOT at module level.
// Pinia is not initialized when this module is first imported (Pitfall 1 in research).
router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'pin' }
  }
  if (to.name === 'pin' && auth.isAuthenticated) {
    return { name: 'zones' }
  }
})

export default router
