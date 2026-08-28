# LockIn Phase 1 WebContentsView Spike

This isolated spike validates the browser architecture before the production app is scaffolded. It is intentionally plain and disposable.

## Requirements

- Node.js 24 (`nvm use` from the repository root)
- A graphical Windows or WSLg session

## Run interactively

```bash
npm install
npm start
```

Use the LeetCode, ChatGPT, and Canva buttons to replace the single remote view. The local LockIn bar remains above it. **Cookie check** writes a synthetic cookie to the persistent website partition, recreates the view, and confirms the cookie remains.

For the manual Phase 1 gate, sign into an account you control. Never place credentials in source files, logs, screenshots, or the compatibility report.

## Run the automated probe

```bash
npm run check
npm run probe
```

The probe loads all reference sites sequentially, inspects their rendered top-level page, samples Electron process memory, checks persistent-partition cookies, prints one `LOCKIN_PHASE_1_RESULT` JSON record, and exits.

## Scope

This spike proves rendering, view ownership, persistent sessions, and rough resource behavior. Final hostname restrictions, permission policy, product UI, timer, and packaging belong to later gated phases.
