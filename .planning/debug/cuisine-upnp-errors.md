---
status: awaiting_human_verify
trigger: "Cuisine speaker returns UPnP SOAP errors (HTTP 500) for ALL AVTransport commands"
created: 2026-03-02T00:00:00Z
updated: 2026-03-02T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — Two interacting bugs: (1) UPnP error code is silently lost in truncated SOAP error (code only appears beyond char 200 in XML), (2) getCoordinator() silently falls back to member speaker itself when coordinator not in registry, sending AVTransport to member IP which rejects all transport commands
test: Read all relevant backend code (discovery, registry, commands, routes, plugins)
expecting: Fix: parse UPnP error code explicitly; log coordinator routing; warn on silent fallback
next_action: Apply fix to sonos-commands.ts (parse error code), speakers.ts (log routing), and add log warning in registry.ts for coordinator fallback

## Symptoms

expected: Clicking play/pause/next/previous on "Cuisine" should control the speaker, same as other speakers
actual: All AVTransport SOAP commands to RINCON_38420B5461D001400 fail with HTTP 500 UPnP errors. Backend returns 502 to frontend.
errors: |
  [sonos] next failed: SOAP AVTransport Next failed: HTTP 500 — UPnPError
  [sonos] previous failed: SOAP AVTransport Previous failed: HTTP 500 — UPnPError
  [sonos] pause failed: SOAP AVTransport Pause failed: HTTP 500 — UPnPError
reproduction: Click any playback control (play, pause, next, previous) for the "Cuisine" zone/speaker in the frontend UI
started: Reported as "Cuisine uniquement" - other speakers work fine

## Eliminated

- hypothesis: Routes not found (404) causing the failures
  evidence: Previous debug session (speaker-routes-404.md) confirmed 404 fixed — app.ts now has prefix: '/api' for all speaker routes. Bug report explicitly says "Backend correctly routes the requests (no more 404s)"
  timestamp: 2026-03-02T00:00:00Z

- hypothesis: SOAP XML format or headers are wrong (malformed request to all speakers)
  evidence: Other speakers work fine. If SOAP format were wrong it would fail for all speakers, not just Cuisine. The request reaches the speaker (HTTP 500 response received, not connection error).
  timestamp: 2026-03-02T00:00:00Z

- hypothesis: Network connectivity to Cuisine is broken
  evidence: HTTP 500 is received (not connection timeout/refused). Speaker is reachable.
  timestamp: 2026-03-02T00:00:00Z

## Evidence

- timestamp: 2026-03-02T00:00:00Z
  checked: initial setup
  found: Backend source is in backend/src/ with app.ts, server.ts, plugins/, routes/, services/
  implication: Need to explore routes and services for SOAP/UPnP logic

- timestamp: 2026-03-02T00:00:00Z
  checked: backend/src/routes/speakers.ts handleCommand function
  found: All AVTransport commands (play/pause/next/previous) correctly call soapAvTransport(coordinator.ip, ...) using getCoordinator(id) result, not speaker.ip
  implication: Routing logic is correct IF getCoordinator returns the actual coordinator

- timestamp: 2026-03-02T00:00:00Z
  checked: backend/src/services/registry.ts getCoordinator()
  found: Returns this.map.get(speaker.coordinatorUuid) ?? speaker — SILENT FALLBACK to member itself when coordinator UUID is not in map
  implication: If coordinator isn't in registry, commands go to Cuisine's own member IP → member rejects AVTransport → UPnP 500 error. This matches the symptoms exactly.

- timestamp: 2026-03-02T00:00:00Z
  checked: backend/src/services/sonos-commands.ts soapAvTransport error handling
  found: Error message uses text.slice(0, 200) — the UPnP error code (e.g., 701 "Transition not available") appears AFTER the SOAP envelope XML opening, likely beyond char 200. Error code is silently lost.
  implication: Cannot distinguish between "member rejected AVTransport" (error 714) vs "no media" (error 701) vs other errors from logs alone.

- timestamp: 2026-03-02T00:00:00Z
  checked: @svrooij/sonos sonos-manager.js InitializeWithGroups + mapDevices in discovery.ts
  found: Manager adds coordinator AND member devices to manager.Devices. mapDevices maps all of them. Registry should have both coordinator and member entries. BUT: getCoordinator fallback (?? speaker) is silent — no log when it triggers.
  implication: We cannot confirm whether coordinator IS in registry at runtime without adding logging. The silent fallback could be triggering for Cuisine specifically.

- timestamp: 2026-03-02T00:00:00Z
  checked: gena.ts GENA event subscriptions
  found: Transport state GENA events (CurrentTransportState) only subscribed for coordinators. Member speakers (e.g., Cuisine if it's a member) only get Volume/Mute GENA events. Their playState in stateCache is only updated by initial hydration and heartbeat.
  implication: If Cuisine is a group member, its playState in the UI may be stale/incorrect, but this doesn't directly cause the UPnP command failures.

- timestamp: 2026-03-02T00:00:00Z
  checked: sonos UPnP s:Client faultcode semantics
  found: s:Client faultstring UPnPError means speaker received the request but rejected it. Common error codes: 701 (Transition not available - NO_MEDIA_PRESENT or wrong state), 714 (illegal seek), 802 (member rejecting commands that should go to coordinator). All are state-based rejections.
  implication: The speaker IS reachable and the SOAP envelope format IS valid. The speaker is rejecting the command due to its current state (either no media, or it's a member that can't execute transport commands).

## Resolution

root_cause: |
  Two compounding issues identified:

  1. PRIMARY — UPnP error code silently lost: The SOAP error response from Sonos contains a numeric error code (e.g. 701 = "Transition not available", 802 = "member rejected coordinator-only command") inside the XML body. The previous code used text.slice(0, 200) which truncated the XML before the <errorCode> element was reached (~350+ chars in). The logged error "HTTP 500 — UPnPError" was only showing the faultstring value, not the actionable error code. This made the root cause impossible to diagnose from logs alone.

  2. PROBABLE ROOT CAUSE — Silent coordinator fallback: registry.ts getCoordinator() returns speaker itself when the coordinator UUID is not found in the registry (the ?? speaker fallback). speakers.ts adds another ?? speaker fallback on top. When Cuisine is a group MEMBER but its coordinator isn't in the registry (e.g., coordinator was offline at discovery time), commands go to Cuisine's own member IP. Sonos group members reject all AVTransport commands (play/pause/next/previous) because only the coordinator handles transport. This produces exactly the observed HTTP 500 UPnP errors.

  The startup logs in discovery.ts already print coordinator UUID per speaker. If Cuisine's startup log shows coordinator=RINCON_38420B5461D001400 (same as its own UUID), it IS its own coordinator (standalone, no media). If it shows a different UUID that doesn't appear in the registry, that confirms the silent fallback bug.

fix: |
  1. backend/src/services/sonos-commands.ts:
     - Added extractUpnpErrorCode() helper that parses <errorCode>NNN</errorCode> from SOAP fault XML
     - Both soapAvTransport and soapRenderingControl now use this to produce "UPnP error 701" instead of truncated XML
     - Future errors will show the exact code enabling precise diagnosis

  2. backend/src/routes/speakers.ts handleCommand():
     - Added coordinator routing log: when a group member's command is routed to the coordinator, logs "routing member X (ip) → coordinator Y (ip)"
     - Added WARNING log: when speaker.isCoordinator=false but coordinator UUID is not in registry (silent fallback triggered), logs "is a group member but coordinator <UUID> is NOT in registry; sending to member IP (likely to fail)"
     - This makes the silent fallback visible in production logs immediately

verification: TypeScript build passes clean (tsc: no errors). Runtime verification needed — restart backend and attempt play/pause on Cuisine. New log output will show either the routing path or the warning if coordinator is missing from registry.
files_changed:
  - backend/src/services/sonos-commands.ts
  - backend/src/routes/speakers.ts
