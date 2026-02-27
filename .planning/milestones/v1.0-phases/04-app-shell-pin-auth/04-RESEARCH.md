# Phase 4: App Shell + PIN Auth - Research

**Researched:** 2026-02-27
**Domain:** Vue 3 SPA scaffold, PIN auth gate, server-side session, responsive mobile-first shell
**Confidence:** HIGH (core stack); MEDIUM (auth token mechanism, cookie cross-origin dev config)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**PIN entry screen:**
- Visual numeric keypad (0–9 grid, digicode style) — NOT a text input
- 4-digit PIN
- Dots display (○ → ●) during entry — universal pattern
- Incorrect PIN: plain text error message under dots (no shake animation)
- Unlimited retries — internal LAN tool, no external brute-force risk

**Session & logout:**
- No-expiry session — once PIN validated, user stays authenticated on that browser indefinitely
- Discreet logout button (in Settings tab/page, not prominent)
- PIN configured via `APP_PIN` env var in `.env` / docker-compose
- Server-side validation via `POST /api/auth/pin` — PIN never exposed in frontend; backend validates and returns token/cookie

**Shell structure:**
- Fixed header: app logo + title + WebSocket connection status indicator (connected/disconnected)
- Bottom navigation: 2 tabs — Zones (main view) + Settings (settings, logout)
- Desktop: content constrained to max ~480–600px, centered — mobile app style on large screen
- Mobile-first: designed for 375px minimum, scales up

**Visual identity:**
- Dark mode only (no light mode, no toggle)
- Dark background (black/very dark grey)
- Two accent colors: green `#87DB78` and pink `#FF3C74`
- Typography: Inter (loaded via Google Fonts or self-hosted)
- Rounded corners: border-radius 8px
- Cards with subtle elevation (subtle box-shadow on dark background)

### Claude's Discretion

- Exact dark background shade (pure black vs very dark grey)
- Specific usage of green vs pink (which accent for what purpose)
- WebSocket indicator design in the header
- Numeric keypad size and spacing
- Exact spacing and typographic scale
- Transition animation between PIN screen and app
- Vue Router setup structure
- Exact token mechanism (JWT, httpOnly cookie, etc.)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | User must enter a shared PIN to access the app | `POST /api/auth/pin` endpoint on Fastify; global `beforeEach` guard in Vue Router; Pinia `useAuthStore` stores session state; httpOnly cookie or localStorage token persists session |
| INFRA-02 | Interface is responsive and usable on both mobile and desktop | CSS custom properties for design tokens; mobile-first min-width breakpoints; `max-width` + `margin: auto` for desktop centering; `env(safe-area-inset-bottom)` for iOS bottom nav; 44px minimum touch targets |
</phase_requirements>

---

## Summary

Phase 4 introduces the Vue 3 SPA that wraps all future phases. It has two concerns: (1) a PIN auth gate that calls the existing Fastify backend, and (2) a mobile-first responsive shell with dark theme and bottom navigation. Both concerns are well-trodden in the Vue ecosystem with mature, stable solutions.

The scaffold is `npm create vue@latest` selecting TypeScript, Vue Router, Pinia, and ESLint/Prettier. The auth flow is a `POST /api/auth/pin` call to Fastify which sets an httpOnly cookie (requires `@fastify/cookie` on the backend); the Vue Router global `beforeEach` guard reads auth state from Pinia and redirects unauthenticated users to the PIN entry view. Session persistence without expiry is naturally handled by an httpOnly `Set-Cookie` without a `Max-Age` (session cookie) — but since that disappears on browser close, using `localStorage` to store a flag or using `Max-Age: very-large-number` on the cookie is needed for the "stays authenticated indefinitely" requirement.

The responsive shell uses CSS custom properties as design tokens (colors, radii, spacing, typography), a mobile-first layout with a single breakpoint at ~768px for desktop centering, and a bottom nav bar with `env(safe-area-inset-bottom)` padding for iOS safe areas. The Vite dev server's `server.proxy` configuration forwards `/api` to `http://localhost:3000`, eliminating CORS issues during development with no backend changes required.

**Primary recommendation:** Scaffold with `npm create vue@latest` (TypeScript + Vue Router + Pinia + ESLint). Use Vite proxy for `/api` in dev. Implement auth via `POST /api/auth/pin` → httpOnly cookie with `Max-Age` for persistence. Guard all routes except `/pin` with `router.beforeEach`. Store auth state in Pinia, hydrated from cookie presence check on app init.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vue | ^3.5.x | UI framework | Official; Composition API + `<script setup>` is idiomatic |
| vite | ^6.x | Build tool + dev server | Official; created by Vue author; fastest HMR |
| vue-router | ^4.x | Client-side routing + auth guard | Official router for Vue 3 |
| pinia | ^2.x | State management (auth state, WS status) | Official replacement for Vuex; TypeScript-native |
| typescript | ~5.x | Type safety | Project already uses TS on backend |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @fastify/cookie | ^9.x | Backend: set/parse httpOnly cookies | Required for server-side session token |
| @fastify/cors | ^10.x | Backend: allow Vite dev origin with credentials | Only if not using Vite proxy (proxy approach is preferred) |
| eslint + prettier | latest | Code quality + formatting | create-vue installs these; keep consistent with backend style |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| httpOnly cookie for session | `localStorage` flag | localStorage is accessible to JS (XSS risk), but for an internal LAN tool the risk is negligible. Cookie is more correct but adds backend complexity. Either works; httpOnly cookie is preferred per CONTEXT.md intent. |
| Vite proxy for dev | @fastify/cors with credentials | Proxy is simpler (no backend changes), recommended for this project. |
| CSS custom properties | Tailwind CSS | Tailwind would need config; custom properties are sufficient for this small, bespoke design system. |
| `npm create vue@latest` | Manual Vite + Vue setup | Manual setup gives no benefit; create-vue scaffold is the official way. |

**Installation (frontend):**
```bash
npm create vue@latest frontend
# prompts: TypeScript=Yes, Vue Router=Yes, Pinia=Yes, Vitest=No, E2E=No, ESLint=Yes, Prettier=Yes
```

**Installation (backend additions):**
```bash
npm install @fastify/cookie
```

---

## Architecture Patterns

### Recommended Project Structure

```
frontend/
├── src/
│   ├── assets/          # Global CSS (design tokens, reset, typography)
│   │   └── main.css     # CSS custom properties root vars
│   ├── components/
│   │   ├── AppHeader.vue      # Fixed header: logo + title + WS indicator
│   │   ├── AppNav.vue         # Bottom nav: Zones + Settings tabs
│   │   └── PinPad.vue         # Numeric keypad 0-9 + dots display
│   ├── views/
│   │   ├── PinView.vue        # Full-screen PIN entry (unauthenticated)
│   │   ├── ZonesView.vue      # Main view placeholder (Phase 5)
│   │   └── SettingsView.vue   # Settings + logout button
│   ├── stores/
│   │   └── auth.ts            # useAuthStore: isAuthenticated, login(), logout()
│   ├── router/
│   │   └── index.ts           # Routes + beforeEach auth guard
│   ├── App.vue                # Root: shell layout or PinView based on auth state
│   └── main.ts                # App entry: createApp + pinia + router
├── vite.config.ts             # Proxy /api → localhost:3000
├── tsconfig.json
└── package.json
```

### Pattern 1: Global beforeEach Auth Guard

**What:** All routes except the PIN entry route are behind an auth check. Vue Router redirects unauthenticated users to `/pin`.
**When to use:** Single auth gate pattern — the simplest and most maintainable approach for this app.

```typescript
// Source: https://router.vuejs.org/guide/advanced/navigation-guards.html
// src/router/index.ts

import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/pin', name: 'pin', component: () => import('@/views/PinView.vue'), meta: { public: true } },
    { path: '/', name: 'zones', component: () => import('@/views/ZonesView.vue') },
    { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'pin' }
  }
  // If already authenticated and visiting /pin, redirect to home
  if (to.name === 'pin' && auth.isAuthenticated) {
    return { name: 'zones' }
  }
})

export default router
```

**Critical note:** `useAuthStore()` must NOT be called at module level (outside the guard function). It must be called inside `beforeEach` after Pinia is initialized. If called at module top level, it will fail because Pinia isn't ready yet.

### Pattern 2: Pinia Auth Store (Setup Store style)

**What:** Centralized auth state. `isAuthenticated` is persisted to `localStorage` to survive page refreshes. Login action calls `POST /api/auth/pin` and sets state; logout action calls `POST /api/auth/logout` and clears state.

```typescript
// Source: https://pinia.vuejs.org/core-concepts/
// src/stores/auth.ts

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', () => {
  // Hydrate from localStorage on store creation
  const _authenticated = ref(localStorage.getItem('auth') === 'true')

  const isAuthenticated = computed(() => _authenticated.value)

  async function login(pin: string): Promise<{ success: boolean; error?: string }> {
    const res = await fetch('/api/auth/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // send/receive httpOnly cookies
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
```

**Session persistence without expiry:** The combination of an httpOnly cookie with a long `Max-Age` (e.g., 1 year) on the backend and the `localStorage` flag on the frontend covers two scenarios:
- `localStorage` flag: fast, synchronous check for the auth guard on page load (no flash)
- httpOnly cookie: server-side proof of auth (backend can verify protected routes)

For this project — an internal LAN tool with no server-side protected API routes after login — the `localStorage` flag alone is sufficient. The httpOnly cookie is the more correct approach if backend route protection is ever needed.

### Pattern 3: Backend PIN Endpoint

**What:** `POST /api/auth/pin` validates the submitted PIN against `fastify.config.SONOS_PIN` (already in env plugin). Sets a session marker cookie. Returns 200 or 401.

```typescript
// backend: src/routes/auth.ts (NEW file)
import type { FastifyPluginAsync } from 'fastify'

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: { pin: string } }>('/api/auth/pin', {
    schema: {
      body: {
        type: 'object',
        required: ['pin'],
        properties: { pin: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { pin } = request.body
    if (pin !== fastify.config.SONOS_PIN) {
      return reply.status(401).send({ message: 'PIN incorrect' })
    }
    // Set httpOnly cookie valid for 1 year
    reply.setCookie('session', 'authenticated', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year in seconds
    })
    return reply.status(200).send({ ok: true })
  })

  fastify.post('/api/auth/logout', async (_request, reply) => {
    reply.clearCookie('session', { path: '/' })
    return reply.status(200).send({ ok: true })
  })
}

export default authRoutes
```

Note: The env plugin already exposes `fastify.config.SONOS_PIN` — no changes needed there. The docker-compose already has `SONOS_PIN=1234`. The variable name in CONTEXT.md is `APP_PIN` but the codebase already uses `SONOS_PIN` — use `SONOS_PIN` to stay consistent.

### Pattern 4: Vite Dev Proxy

**What:** All `/api` requests from Vite dev server are forwarded to `http://localhost:3000`, so the browser never makes a cross-origin request.

```typescript
// Source: https://vite.dev/config/server-options.html#server-proxy
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
```

With this proxy, cookies set by the backend are received and sent by the browser on subsequent `/api` calls without any CORS credentials configuration. This is the cleanest dev setup.

### Pattern 5: CSS Design Token System

**What:** A small set of CSS custom properties defined on `:root` that encode the entire visual identity. All components reference tokens, never raw values.

```css
/* src/assets/main.css */
:root {
  /* Colors */
  --color-bg: #111111;           /* Very dark grey, not pure black — easier on eyes */
  --color-surface: #1c1c1e;      /* Card/surface background */
  --color-border: #2c2c2e;       /* Subtle borders */
  --color-text-primary: #f5f5f5;
  --color-text-secondary: #8e8e93;
  --color-accent-green: #87DB78; /* Locked by user */
  --color-accent-pink: #FF3C74;  /* Locked by user */

  /* Spacing scale */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;

  /* Layout */
  --app-max-width: 540px;        /* Desktop centering constraint */
  --header-height: 56px;
  --nav-height: 56px;

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 8px;              /* Locked by user */
  --radius-lg: 12px;

  /* Elevation / shadows on dark bg */
  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.6);

  /* Typography */
  --font-family: 'Inter', system-ui, -apple-system, sans-serif;
  --font-size-sm: 0.875rem;      /* 14px */
  --font-size-base: 1rem;        /* 16px */
  --font-size-lg: 1.125rem;      /* 18px */
  --font-size-xl: 1.25rem;       /* 20px */
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body, #app {
  height: 100%;
  background: var(--color-bg);
  color: var(--color-text-primary);
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  -webkit-font-smoothing: antialiased;
}
```

### Pattern 6: App Shell Layout

**What:** Fixed header + scrollable main content + fixed bottom nav. Content area has padding to clear header and nav. Desktop centers content via `max-width`.

```css
/* App shell layout */
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100dvh; /* dvh: dynamic viewport height — handles iOS Safari URL bar collapse */
}

.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--header-height);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  z-index: 100;
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

.app-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: calc(var(--nav-height) + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  z-index: 100;
  display: flex;
  align-items: flex-start;
}
```

Note: Use `100dvh` (dynamic viewport height) for the app shell to handle iOS Safari's retractable URL bar. On older browsers, fallback to `100vh`.

### Anti-Patterns to Avoid

- **Calling `useAuthStore()` at module level in router/index.ts:** Pinia is not yet initialized when the module is first imported. Always call inside the `beforeEach` callback.
- **Storing PIN in frontend code or state:** The PIN must only travel from user input → POST body → backend validation. Never store it.
- **Using `window.location.href` redirects for auth:** This forces full page reloads and breaks Vue Router's SPA navigation. Use `router.push()` or return a route object from guards.
- **Not setting `credentials: 'include'` on fetch calls:** Without this, browsers will not send the httpOnly cookie on subsequent requests.
- **Using `100vh` on mobile for full-height layouts:** iOS Safari's address bar causes `100vh` to exceed the visible area. Use `100dvh` or a JS-based solution.
- **Inline styles for design values:** Always use CSS custom properties, never hardcode `#87DB78` directly in component styles.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session cookie management | Custom cookie parser/setter | `@fastify/cookie` | Handles parsing, serialization, signing options, security flags correctly |
| Route protection | Custom middleware or component-level guards | Vue Router `beforeEach` global guard | The standard pattern; handles all navigation types including programmatic pushes |
| Reactive global state | Passing props through multiple layers or Vue `provide/inject` | Pinia store | Designed for this; integrates with Vue DevTools; TypeScript-native |
| WebSocket status display | Polling backend `/health` endpoint | Composable reading existing WS connection state from Phase 3 | WS connection already exists from Phase 3; read its `readyState` |

**Key insight:** The auth mechanism is simple (one PIN, no users, no JWTs with refresh tokens). Resist the urge to use a full auth library — the custom endpoint + httpOnly cookie pattern is 20 lines and fits the use case exactly.

---

## Common Pitfalls

### Pitfall 1: Pinia Not Ready When Router Guard Fires

**What goes wrong:** `useAuthStore()` throws "getActivePinia was called with no active Pinia" when called at module top level in `router/index.ts`.
**Why it happens:** The router module is imported before `app.use(pinia)` is called in `main.ts`.
**How to avoid:** Call `useAuthStore()` *inside* `router.beforeEach((to) => { const auth = useAuthStore() ... })`, not outside the callback.
**Warning signs:** Runtime error on first navigation with "no active Pinia" message.

### Pitfall 2: Auth Flash (PIN Screen Visible Briefly Before Redirect)

**What goes wrong:** On page load, the app briefly shows the authenticated shell before the router guard fires and redirects to `/pin`.
**Why it happens:** Vue Router's `beforeEach` is asynchronous; there's a tick between page render and guard execution.
**How to avoid:** Initialize auth state synchronously from `localStorage` in the Pinia store (see Pattern 2 above). The guard then has correct state immediately. Alternatively, render an app-level loading state until the router is ready.
**Warning signs:** A flash of the Zones view before the PIN entry appears on unauthenticated load.

### Pitfall 3: httpOnly Cookie Not Sent in Dev (CORS / Proxy)

**What goes wrong:** The browser sends `POST /api/auth/pin` from Vite's port (e.g., 5173) to Fastify's port (3000) — different origins. The httpOnly cookie is set but not sent on subsequent requests.
**Why it happens:** Cross-origin requests require explicit `credentials: 'include'` on the client AND CORS headers with `credentials: true` + specific `origin` on the server. Without the Vite proxy, this is complex.
**How to avoid:** Use Vite's `server.proxy` to forward `/api` to `localhost:3000`. The browser sees all requests as same-origin (localhost:5173), so cookies work normally.
**Warning signs:** Auth succeeds but subsequent API calls return 401; browser DevTools shows no Cookie header on API requests.

### Pitfall 4: `100vh` iOS Safari Overflow

**What goes wrong:** The app shell overflows the visible viewport on iOS Safari, creating a scrollbar on the page itself.
**Why it happens:** `100vh` in iOS Safari includes the area behind the browser chrome (address bar), which is not visible.
**How to avoid:** Use `height: 100dvh` for the app shell. `dvh` (dynamic viewport height) adjusts when the browser chrome shows/hides. Add `height: 100vh` as a fallback for browsers that don't support `dvh`.
**Warning signs:** The bottom navigation bar is partially obscured by the browser chrome on iOS Safari.

### Pitfall 5: Bottom Nav Clipped by iOS Home Bar

**What goes wrong:** Bottom navigation buttons are obscured by the iOS Home Indicator (swipe-up bar) on notch/Dynamic Island phones.
**Why it happens:** Fixed bottom elements need additional padding for the safe area.
**How to avoid:** Add `padding-bottom: env(safe-area-inset-bottom, 0px)` to the nav bar, and account for that padding in the content area's bottom padding. Requires `<meta name="viewport" content="viewport-fit=cover">` in `index.html`.
**Warning signs:** Tap targets at the bottom of the nav bar are unreachable or require precise tapping on iOS devices with Home Bar.

### Pitfall 6: Touch Targets Too Small

**What goes wrong:** Numeric keypad buttons and nav items are too small to reliably tap on mobile.
**Why it happens:** Default button sizing from CSS resets or tight layouts.
**How to avoid:** Enforce minimum 44×44px tap targets for all interactive elements (WCAG 2.5.8 requires 24px minimum, iOS HIG requires 44pt, Material Design recommends 48dp). For the PIN pad, this means each digit button should be at least 64×64px for comfortable use.
**Warning signs:** User complaints about missed taps; buttons feel small during manual testing.

### Pitfall 7: `SONOS_PIN` vs `APP_PIN` Naming

**What goes wrong:** CONTEXT.md mentions `APP_PIN` but the existing codebase uses `SONOS_PIN` in `env.ts` and `docker-compose.yml`.
**Why it happens:** CONTEXT.md was written without checking the existing env schema.
**How to avoid:** Use `SONOS_PIN` — it already exists and is validated in the env plugin. No rename required.
**Warning signs:** Backend startup failure if a new `APP_PIN` variable is added without updating the schema.

---

## Code Examples

### PIN Entry Component — Dots Display + Keypad

```vue
<!-- Source: derived from CONTEXT.md decisions + standard patterns -->
<!-- src/components/PinPad.vue -->
<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{ submit: [pin: string] }>()

const digits = ref<string[]>([])
const error = ref('')
const PIN_LENGTH = 4

function pressDigit(d: string) {
  if (digits.value.length >= PIN_LENGTH) return
  digits.value.push(d)
  error.value = ''
  if (digits.value.length === PIN_LENGTH) {
    emit('submit', digits.value.join(''))
  }
}

function pressDelete() {
  digits.value.pop()
  error.value = ''
}

// Called by parent on failed attempt
function setError(msg: string) {
  error.value = msg
  digits.value = []
}

defineExpose({ setError })
</script>

<template>
  <div class="pin-pad">
    <!-- Dots display -->
    <div class="pin-dots" role="status" :aria-label="`${digits.length} of ${PIN_LENGTH} digits entered`">
      <span
        v-for="i in PIN_LENGTH"
        :key="i"
        class="dot"
        :class="{ filled: i <= digits.length }"
      />
    </div>

    <!-- Error message -->
    <p v-if="error" class="pin-error" role="alert">{{ error }}</p>

    <!-- Numeric keypad -->
    <div class="keypad">
      <button v-for="d in ['1','2','3','4','5','6','7','8','9']" :key="d"
        class="key" @click="pressDigit(d)" :aria-label="`digit ${d}`">
        {{ d }}
      </button>
      <div class="key key--empty" aria-hidden="true" />
      <button class="key" @click="pressDigit('0')" aria-label="digit 0">0</button>
      <button class="key key--delete" @click="pressDelete" aria-label="delete">⌫</button>
    </div>
  </div>
</template>
```

### Vue Router — History Mode + SPA Fallback

```typescript
// For production deployment, Fastify must serve index.html for all non-API routes.
// Add to backend app.ts (after API routes are registered):

// fastify.setNotFoundHandler(async (_request, reply) => {
//   return reply.sendFile('index.html') // requires @fastify/static
// })
```

The Vite dev server handles the SPA fallback automatically via `appType: 'spa'` (default). In production, the Fastify backend needs to serve the Vue build's `index.html` for all non-API routes, OR the frontend is served by a separate static server (nginx) — this decision is deferred to deployment planning.

### Inter Font — Self-Hosted (Recommended)

```html
<!-- index.html — Google Fonts approach (simpler, acceptable for LAN tool) -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
```

For a LAN-only internal tool, Google Fonts is acceptable (the LAN has internet access for development). Self-hosting via `fontsource` is an alternative if offline support is needed:

```bash
npm install @fontsource/inter
```
```typescript
// main.ts
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
```

### WebSocket Status Indicator

The Phase 3 WS connection is established in the frontend via `new WebSocket('ws://...')`. The indicator in the header reads the connection's `readyState`. This should be a Pinia store or composable that wraps the WebSocket lifecycle.

```typescript
// Minimal composable pattern (to be expanded in Phase 5)
// src/composables/useWebSocket.ts
import { ref, onMounted, onUnmounted } from 'vue'

export function useWebSocket() {
  const connected = ref(false)
  let ws: WebSocket | null = null

  onMounted(() => {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    ws = new WebSocket(`${proto}//${location.hostname}:3000/ws`)
    ws.onopen = () => { connected.value = true }
    ws.onclose = () => { connected.value = false }
    ws.onerror = () => { connected.value = false }
  })

  onUnmounted(() => ws?.close())

  return { connected }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vuex for state management | Pinia | Vue 3 era (2021+) | Pinia is the official recommendation; simpler API, TypeScript-native |
| `vue-cli` (`@vue/cli`) scaffold | `npm create vue@latest` (create-vue + Vite) | 2021–2022 | create-vue is the official tool; @vue/cli is in maintenance mode |
| Options API + `data()` | Composition API + `<script setup>` | Vue 3.2+ | `<script setup>` is idiomatic; better TypeScript inference |
| `beforeRouteEnter` component guard | Global `beforeEach` with Pinia | Vue Router 4 era | Global guard is cleaner for app-wide auth; component guards still valid for route-specific logic |
| `next()` in navigation guards | Return values (`return { name: '...' }` or `return false`) | Vue Router 4.1+ | More intuitive; `next()` still works but return-based is modern |
| `100vh` for full-height | `100dvh` + `100vh` fallback | 2022+ (CSS spec) | `dvh` correctly handles iOS Safari's dynamic chrome |

**Deprecated/outdated:**
- `@vue/cli` / `vue-cli-service`: Maintenance mode. Do not use for new projects.
- Vuex: Superseded by Pinia. Do not use.
- `next()` in navigation guards: Functional but old style. Use return values.
- `<script lang="ts">` with Options API: Still valid but not idiomatic for new Vue 3 code. Use `<script setup lang="ts">`.

---

## Open Questions

1. **Production serving: Fastify serves the frontend, or separate nginx?**
   - What we know: The backend uses `docker-compose` with `network_mode: host`. There's no existing static file serving setup.
   - What's unclear: Whether `@fastify/static` should be added to serve the Vue build, or whether a separate nginx container is preferred.
   - Recommendation: For Phase 4, defer this decision. During Phase 4 development, Vite dev server is sufficient. Add a note in the PLAN that production serving strategy is a Phase-5/deployment concern.

2. **`SONOS_PIN` vs `APP_PIN` naming for the env variable**
   - What we know: CONTEXT.md says `APP_PIN` but the existing `env.ts` plugin and `docker-compose.yml` use `SONOS_PIN`.
   - What's unclear: Whether the user wants a rename or if using the existing variable name is acceptable.
   - Recommendation: Use existing `SONOS_PIN` — no rename, no schema changes, less risk. Document the decision.

3. **Auth cookie verification on subsequent API calls**
   - What we know: The auth gate is frontend-only for Phase 4. The backend speaker routes have no auth check.
   - What's unclear: Whether backend route protection (middleware checking the cookie) is in scope for Phase 4.
   - Recommendation: Out of scope for Phase 4 per CONTEXT.md. The backend auth endpoint just validates PIN and sets cookie; the frontend guards the UI. Backend route protection is an INFRA concern for a later phase.

---

## Sources

### Primary (HIGH confidence)
- https://vuejs.org/guide/quick-start — create-vue scaffold prompts, Node.js version requirement, official CLI
- https://router.vuejs.org/guide/advanced/navigation-guards.html — `beforeEach` guard syntax, return values, route meta
- https://pinia.vuejs.org/core-concepts/ — `defineStore` setup store pattern, TypeScript patterns
- https://vite.dev/config/server-options.html — proxy configuration (verified via multiple sources)
- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env — `env(safe-area-inset-bottom)` CSS spec

### Secondary (MEDIUM confidence)
- https://github.com/fastify/fastify-cookie — `@fastify/cookie` `setCookie` API with `httpOnly`, `sameSite`, `maxAge`
- https://github.com/fastify/fastify-cors — CORS credentials configuration (relevant if proxy not used)
- https://samuelkraft.com/blog/safari-15-bottom-tab-bars-web — iOS Safari bottom bar `env(safe-area-inset-bottom)` pattern
- https://www.allaccessible.org/blog/wcag-258-target-size-minimum-implementation-guide — 44px touch target standard

### Tertiary (LOW confidence)
- Various blog articles on Vue 3 auth patterns — patterns are consistent across sources; individual implementations vary

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — create-vue, vue-router 4, pinia are official Vue ecosystem; verified via vuejs.org
- Architecture: HIGH — navigation guards and proxy patterns verified with official docs; cookie pattern verified with @fastify/cookie repo
- Pitfalls: MEDIUM — Pinia + router timing issue is well-documented community knowledge; iOS CSS pitfalls verified with MDN and browser vendor sources

**Research date:** 2026-02-27
**Valid until:** 2026-05-27 (stable ecosystem; Vue Router and Pinia APIs are stable)
