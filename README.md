# LockIn

LockIn is a local-first Windows focus environment. Users choose a duration and approved websites, enter a fullscreen launcher, and open one controlled website at a time inside the application.

## Product preview

The current interactive prototype includes:

- the wallpaper-led session setup screen;
- a dynamic spaces dock with crystal and custom-image treatments;
- the animated transition into focus mode;
- launcher, immersive website, blocked-navigation, and completion states;
- a minimal active-timer panel and ten-second hold-to-end control;
- a compact floating album-player prototype; and
- a browser-only design mode with hot reload and mocked data.

Spaces, timer updates, embedded website content, and album playback currently use mock data while their application services are being connected.

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
| `npm start`            | Preview a previously built application               |

Before committing production code, run:

```bash
npm run check
```

## Architecture

```text
src/
├── main/       Trusted Electron lifecycle, windows, paths, logs, and IPC handlers
├── preload/    Narrow context-bridge API exposed to the local renderer
├── renderer/   Sandboxed React user interface
└── shared/     Runtime schemas and types shared across process boundaries
```

The renderer cannot access Node.js, Electron, the filesystem, or the shell directly. It calls only the methods exposed by `window.lockIn`. Inputs and outputs are validated on both sides of IPC using Zod.

Remote websites will use separate sandboxed `WebContentsView` instances in later phases and will never receive the LockIn preload bridge.

## Tests

The production suite currently covers:

- shared contract validation;
- secure `BrowserWindow` defaults;
- preload channel isolation and validation; and
- renderer-to-preload application bootstrap.

## Git workflow

Every meaningful feature, fix, initialization, or visual revision should be a focused commit. Do not mix unrelated changes. A commit must leave its relevant quality checks passing.

The `main` branch is protected by the same `npm run check` command in Windows CI.
