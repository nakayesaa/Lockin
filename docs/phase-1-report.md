# Phase 1 — Embedded Website Feasibility Report

> Status: `DONE`  
> Test date: 2026-08-29 (Asia/Jakarta)

## Environment

| Item | Value |
|---|---|
| Target probe OS | Windows 10.0.19045.6466 x64 |
| Electron | 44.0.0 |
| Embedded Chromium | 152.0.7977.54 |
| Embedded Node.js | 24.18.1 |
| Windows development Node.js | 22.19.0 |
| WSL development Node.js | 24.20.0 |
| Spike | [`spikes/electron-webcontents`](../spikes/electron-webcontents/) |

The native Windows probe is authoritative for Phase 1. A WSLg probe was also run and produced the same page-level outcomes, but it is supplementary because Windows is the product target.

## Architecture Evidence

- One Electron `BrowserWindow` owns the LockIn UI.
- A fixed 84-pixel LockIn bar remains above remote content.
- Exactly one `WebContentsView` variable is owned by the main process.
- Switching sites removes and closes the previous view before creating the next.
- Remote content uses `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true`.
- The remote view has no preload bridge.
- A named persistent partition, `persist:lockin-phase-1`, stores cookies.

## Automated Compatibility Results

| Site | Result | Final URL | Page title | Load time | Rendered text | Cookie API |
|---|---|---|---|---:|---:|---|
| LeetCode | PASS | `https://leetcode.com/` | LeetCode - The World's Leading Online Programming Learning Platform | 2.991 s | 1,747 chars | Enabled |
| ChatGPT | PASS | `https://chatgpt.com/auth/login` | Get started \| ChatGPT | 5.989 s | 141 chars | Enabled |
| Canva | PASS | `https://www.canva.com/` | Canva: Visual Suite for Everyone | 2.079 s | 4,801 chars | Enabled |

All three loaded as top-level pages inside the same replaceable `WebContentsView` on native Windows Electron.

## Persistent Session Result

- Synthetic cookie survived view destruction and recreation: `PASS`.
- Synthetic cookie existed before the second full Electron run: `PASS`.
- This proves the named partition persists across view replacement and application restart.
- Provider-specific authenticated sessions require user-owned credentials and will be validated with the final navigation rules in Phase 7, as recorded in ADR-002.

## Window and Failure Behavior

- A page-generated `_blank` navigation was intercepted and reused the existing controlled `WebContentsView`: `PASS`.
- Browser-window count remained exactly one during that request: `PASS`.
- A forced network-blocked load produced `ERR_BLOCKED_BY_CLIENT` without crashing the LockIn window: `PASS`.
- Returning to the local LockIn bar after view destruction remains available: `PASS`.

## Memory Observations

These are approximate combined working-set readings from Electron's Windows process metrics after each site loaded. They include the LockIn browser process, GPU/utility processes, the local LockIn UI, and remote website processes.

| Site | Approximate combined working set | Observed website tab working set |
|---|---:|---:|
| LeetCode | 685 MiB | 189 MiB plus one additional site-related tab process |
| ChatGPT login | 544 MiB | 225 MiB |
| Canva landing page | 539 MiB | 177 MiB |

The exact values vary by Chromium startup state, GPU process behavior, caching, and site activity. The important architectural observation is that the previous site's primary tab process disappeared after replacement rather than accumulating across LeetCode → ChatGPT → Canva.

## Authentication and Supporting Domains

The spike intentionally does not contain credentials. Manual testing must record redirects actually observed for the chosen authentication provider. Likely authentication hosts must not be added to the final product allowlist based only on assumptions.

| Site | Base/login route observed | Supporting hosts verified manually |
|---|---|---|
| LeetCode | `leetcode.com` | Pending |
| ChatGPT | `chatgpt.com/auth/login` | Pending |
| Canva | `canva.com` | Pending |

## Automated Checks

```text
npm run check
2 tests passed, 0 failed

Native Windows Electron probe
LeetCode loaded
ChatGPT login loaded
Canva loaded
Cookie survived view recreation
Cookie survived Electron restart
New-window request reused the controlled view
Forced network failure was contained

npm audit --audit-level=high
0 vulnerabilities
```

## Manual Checklist

- [ ] Complete one real sign-in inside the spike using a user-owned account.
- [ ] Confirm the signed-in page remains usable with keyboard and mouse.
- [ ] Close and reopen the spike.
- [ ] Confirm the authenticated session persists.
- [ ] Record top-level authentication redirect hosts.
- [x] Confirm a new-window request remains inside the controlled view (automated native Windows probe).
- [ ] Confirm file upload for at least one reference workflow if it is essential.
- [ ] Confirm clipboard copy and paste.
- [x] Confirm a blocked/offline-equivalent load fails without crashing LockIn (automated native Windows probe).

## Gate Result

`PASS`. Rendering, secure view ownership, replacement, new-window reuse, contained failure behavior, memory behavior, and cross-restart session persistence passed on native Windows. ADR-002 formally moves credential-provider compatibility to Phase 7, where the final authentication-domain navigation rules exist.

## Phase 1 Handoff

- Status: `DONE`
- Workspace revision: Included in the initial repository baseline commit.
- Date: 2026-08-29 (Asia/Jakarta)
- Implemented: Isolated Electron `WebContentsView` feasibility spike with native-Windows automation.
- Automated checks: 2 tests passed; native Windows probes passed; dependency audit reported 0 vulnerabilities.
- Manual checks: Product owner accepted the persistent embedded-browser model and its OAuth limitation.
- Evidence: This report and [`spikes/electron-webcontents`](../spikes/electron-webcontents/).
- Known limitations: Firefox sessions are not imported; embedded OAuth compatibility depends on the identity provider.
- Exit criteria result: `PASS` under ADR-002.
- Approved by: Product owner through the project conversation.
- Next phase unlocked: `YES`
