# LockIn

LockIn is a local-first Windows focus environment. Users choose a duration and approved websites, enter a fullscreen launcher, and open one controlled website at a time inside the application.

## Product

The current application includes:

- the wallpaper-led session setup screen;
- a dynamic spaces dock with crystal and custom-image treatments;
- the animated transition into focus mode;
- launcher, immersive website, blocked-navigation, and completion states;
- a minimal active-timer panel and ten-second hold-to-end control;
- restart-safe focus sessions with absolute-deadline timers;
- real allowlisted websites with loading, retry, and crash-recovery states;
- controlled redirects, forms, new-window requests, and external protocols;
- persistent website login data with a guarded reset action;
- a compact Spotify Connect player with live playback controls; and
- a browser-only design mode with hot reload.

Spaces, presets, active sessions, timer recovery, controlled website navigation, and Spotify playback are validated and managed by the Electron main process. Browser-only design mode keeps an interactive player preview because it does not expose desktop authentication.

## Requirements

- Windows 10 or 11 for target-platform development and runtime validation.
- Node.js 24, recorded in [`.nvmrc`](./.nvmrc).
- npm using the committed lockfile.

Running from a native Windows terminal is recommended. WSL launches the Linux Electron binary and requires additional Chromium system libraries, so it does not represent the target runtime.

## Setup

```bash
nvm use
npm ci
npm run dev
```

For lightweight UI-only work with browser hot reload and mocked application data:

```bash
npm run dev:ui
```

Electron 44 downloads its platform binary during the root `postinstall` step. npm's dependency-script allowlist is committed in `package.json`; no global script-policy bypass is needed.

## Quality commands

| Command                | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `npm run dev`          | Run Electron with renderer hot reload                |
| `npm run dev:ui`       | Run the mocked UI in a browser without Electron      |
| `npm run typecheck`    | Check main, preload, shared, and renderer TypeScript |
| `npm run lint`         | Run ESLint across production source and tests        |
| `npm run format:check` | Verify Prettier formatting                           |
| `npm test`             | Run production unit and renderer tests once          |
| `npm run test:watch`   | Run tests in watch mode                              |
| `npm run build`        | Typecheck and compile all Electron processes         |
| `npm run check`        | Run the complete local quality gate                  |
| `npm run package:win`  | Build and verify the Windows x64 installer           |
| `npm start`            | Preview a previously built application               |

Before committing production code, run:

```bash
npm run check
```

## Windows installer

Build the production installer from a native Windows terminal:

```bash
npm ci
npm run package:win
```

The verified outputs are written to `release/`:

```text
LockIn-Setup-1.1.0-x64.exe
LockIn-Setup-1.1.0-x64.exe.sha256
```

The installer is per-user, adds Start Menu and desktop shortcuts, and preserves LockIn's data when the app is upgraded or uninstalled. Packaged startup logs are written beneath Electron's `logs` directory inside the LockIn user-data folder. The installer is currently unsigned, so Windows SmartScreen may show an unknown-publisher warning.

Pushing a tag that exactly matches the package version, such as `v1.1.0`, runs the Windows quality gate, builds the installer, smoke-tests the packaged app, and publishes both verified files to a GitHub Release. A manual workflow run builds the same downloadable artifact without publishing a release.

## Architecture

```text
src/
├── main/       Trusted Electron lifecycle, windows, paths, logs, and IPC handlers
├── preload/    Narrow context-bridge API exposed to the local renderer
├── renderer/   Sandboxed React user interface
└── shared/     Runtime schemas and types shared across process boundaries
```

The renderer cannot access Node.js, Electron, the filesystem, or the shell directly. It calls only the methods exposed by `window.lockIn`. Inputs and outputs are validated on both sides of IPC using Zod.

Workspace data is versioned and written atomically beneath Electron's `userData` directory. Invalid data is quarantined and replaced with safe defaults; old supported versions are migrated before use.

Remote websites use exactly one disposable, sandboxed `WebContentsView` with a persistent site partition for login cookies. Switching spaces or pressing Back closes the previous view, so remote renderers cannot accumulate in memory. Websites never receive the LockIn preload bridge, Node.js access, permissions, downloads, unrestricted pop-up windows, or developer tools. Every top-level link, form, redirect, history navigation, and new-window request is checked against the active session snapshot; allowed new windows load in the same controlled view, while outside destinations and non-HTTPS protocols produce the blocked state. Subresources remain under the website's normal browser security model so modern sites can function.

Authentication or support hosts are not trusted implicitly. Add each required hostname as a Space in the preset before starting focus. Site data can be cleared from setup, but never during an active focus session.

Active sessions are written atomically to a separate versioned file. A restarted app resumes the same deadline and allowed-space snapshot; expired sessions complete at their original deadline rather than restarting the timer.

Spotify uses Authorization Code with PKCE through the system browser and a temporary loopback callback. Refresh tokens are encrypted with the operating system's secure storage before being written beneath `userData`; no client secret is shipped or stored. LockIn controls the user's active Spotify Connect device rather than embedding or downloading audio.

The Spotify application must allowlist this exact redirect URI:

```text
http://127.0.0.1:43821/callback
```

## Tests

The production suite currently covers:

- shared contract validation;
- URL normalization and hostname matching;
- atomic persistence, migrations, corruption recovery, and Space/Preset operations;
- active-session persistence, restart recovery, deadline completion, and early ending;
- secure embedded-site options and session navigation matching;
- embedded-site lifecycle events and website-data reset commands;
- adversarial hostname, protocol, redirect, and pop-up handling;
- secure `BrowserWindow` defaults;
- preload channel isolation and validation; and
- Spotify PKCE, encrypted token persistence, refresh, playback, and link isolation; and
- the complete renderer product flow.

## Git workflow

Every meaningful feature, fix, initialization, or visual revision should be a focused commit. Do not mix unrelated changes. A commit must leave its relevant quality checks passing.

The `main` branch is protected by the same `npm run check` command in Windows CI.
