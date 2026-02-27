---
phase: 5
plan: "05-01"
subsystem: frontend-state
tags: [pinia, websocket, realtime, zone-store, vue3]
dependency_graph:
  requires: []
  provides: [ZoneState-interface, useZonesStore, useWebSocket-onMessage]
  affects: [ZonesView, AppHeader]
tech_stack:
  added: []
  patterns: [pinia-composition-api, map-keyed-by-uuid, computed-sorted-array, websocket-message-dispatch]
key_files:
  created:
    - frontend/src/stores/zones.ts
  modified:
    - frontend/src/composables/useWebSocket.ts
    - frontend/src/views/ZonesView.vue
decisions:
  - Combined ZoneState interface and useZonesStore into a single file (zones.ts) per plan spec
  - Used Map<string, ZoneState> keyed by UUID for O(1) updates; replaced Map ref on each mutation to trigger Pinia reactivity
  - ZonesView opens its own WebSocket connection separate from AppHeader — correct for current architecture
  - Loading skeleton shown while zones.length === 0 regardless of connected state (simpler, matches plan intent)
metrics:
  duration: "54s"
  completed_date: "2026-02-27"
  tasks_completed: 4
  files_modified: 3
requirements_satisfied: [RT-01, RT-02, RT-03, ZONE-01, ZONE-02, ZONE-03, ZONE-04]
---

# Phase 5 Plan 01: Zone Store (Pinia) + WebSocket Integration Summary

## One-liner

Pinia zone store keyed by UUID with WebSocket snapshot/state_changed dispatch and animated loading skeleton in ZonesView.

## What Was Built

### `frontend/src/stores/zones.ts` (new)

- `ZoneState` TypeScript interface mirroring the backend `state-cache.ts` definition
- `useZonesStore` Pinia store (composition API style) with:
  - `_zones`: internal `ref<Map<string, ZoneState>>` keyed by UUID
  - `zones`: computed sorted array (ascending by name) for stable grid rendering
  - `applySnapshot(data: ZoneState[])`: replaces entire Map from WebSocket snapshot
  - `applyStateChanged(data: ZoneState)`: updates single zone and replaces Map ref to trigger reactivity

### `frontend/src/composables/useWebSocket.ts` (modified)

- Added optional `onMessage?: (event: string, data: unknown) => void` parameter
- In `ws.onmessage`: parses JSON and calls `onMessage?.(event, data)` — malformed messages silently ignored
- All existing behavior preserved: `connected` ref, exponential backoff reconnect (1s→2s→4s→8s cap), lifecycle hooks
- `AppHeader.vue` call with no args remains fully compatible

### `frontend/src/views/ZonesView.vue` (modified)

- Replaced placeholder content with live store/WebSocket wiring
- Dispatches `snapshot` and `state_changed` events to store methods
- Loading skeleton: 4 animated cards (pulse animation) while `store.zones.length === 0`
- Zone grid: `grid-template-columns: 1fr 1fr` (desktop), `1fr` (mobile ≤540px)
- Zone name placeholders rendered once data arrives — ZoneCard components added in plan 05-02
- Uses CSS design tokens: `var(--space-md)`, `var(--color-surface)`, `var(--radius-md)`

## Verification Results

- `frontend/src/stores/zones.ts` exists and exports both `ZoneState` interface and `useZonesStore` — PASS
- `useZonesStore` has `zones` (computed sorted array), `applySnapshot`, `applyStateChanged` — PASS
- `useWebSocket` accepts optional `onMessage` callback and calls it on each message — PASS
- `AppHeader.vue` still compiles — `useWebSocket()` with no args still works — PASS
- `ZonesView.vue` wires `useWebSocket` + `useZonesStore` together — PASS
- Loading skeleton renders while store is empty — PASS
- Grid layout uses `grid-template-columns: 1fr 1fr` (desktop) and `1fr` (mobile ≤540px) — PASS
- `npm run type-check` — PASS (zero errors)

## Commits

| Task | Commit  | Description                                          |
|------|---------|------------------------------------------------------|
| 1+3  | 7e9bfb4 | feat(05-01): add ZoneState interface and useZonesStore Pinia store |
| 2    | 6e92a0b | feat(05-01): extend useWebSocket composable with optional onMessage callback |
| 4    | 3cee5e4 | feat(05-01): wire useZonesStore + useWebSocket into ZonesView |

## Deviations from Plan

### Auto-combined Tasks

**1. [Plan consolidation] Tasks 1 and 3 committed together**
- **Found during:** Task 1 execution
- **Issue:** Both tasks write to the same file (`frontend/src/stores/zones.ts`) — the plan describes them as sequential steps but separating them would create an incomplete intermediate state
- **Fix:** Wrote both `ZoneState` interface and `useZonesStore` implementation in a single commit — logically equivalent to executing Task 1 then Task 3 in sequence
- **Impact:** No functional difference; commit 7e9bfb4 covers the full file

## Self-Check: PASSED

- `frontend/src/stores/zones.ts` — FOUND
- `frontend/src/composables/useWebSocket.ts` — FOUND (modified)
- `frontend/src/views/ZonesView.vue` — FOUND (modified)
- Commit 7e9bfb4 — FOUND
- Commit 6e92a0b — FOUND
- Commit 3cee5e4 — FOUND
