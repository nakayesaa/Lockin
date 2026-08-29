# LockIn Decision Log

## ADR-001 — MVP product and stack baseline

- Date: 2026-08-29
- Status: Accepted

LockIn will be a local-first Windows desktop application built with Electron, React, TypeScript, Vite, and Tailwind CSS. A focus session shows a fullscreen launcher containing circular cards for user-approved websites. Exactly one website is displayed at a time inside an Electron `WebContentsView`.

The MVP uses local JSON persistence and does not include Firefox integration, C#/WPF, a backend, a database, a Windows service, a separate Windows account, or security-grade OS kiosk enforcement.

Any change to these decisions must add a new ADR and identify which completed phase gates need to be repeated.

## ADR-002 — Persistent embedded profile and authentication boundary

- Date: 2026-08-29
- Status: Accepted

LockIn will keep the embedded `WebContentsView` architecture because the product experience is a styled, fullscreen focus environment with wallpaper and circular website applications. Website cookies, local storage, IndexedDB, and service workers will use a named persistent Electron session so a successful login is reused across focus sessions.

The embedded profile does not import Firefox cookies or Firefox Sync data. Some identity providers, notably Google OAuth, may refuse embedded user-agents by policy. LockIn will not spoof its user-agent or copy encrypted browser cookies to bypass that restriction. Direct login, magic-link, and compatible authentication methods may be used; incompatible OAuth-only websites will be documented honestly.

Phase 1 proves that authentication pages render and that session state persists across view and application restarts. Provider-specific credential flows are deferred to Phase 7, where navigation and authentication supporting-domain rules are implemented. This revises the original Phase 1 credential-dependent gate without changing the approved architecture.

## ADR-003 — Deliberate emergency-exit interaction

- Date: 2026-08-29
- Status: Accepted

The emergency exit uses one uninterrupted ten-second press-and-hold action instead of a typed confirmation phrase. Releasing early cancels the action immediately. The confirmation surface contains only the centered glass “Hold To End” control, keeping the action deliberate without adding instructional friction.
