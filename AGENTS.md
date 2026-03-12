# Agents

## Cursor Cloud specific instructions

### Overview

Sigma File Manager is a Tauri v2 desktop app: Vue 3 frontend (Vite on port 1420) + Rust backend. No external services, databases, or Docker required.

### Running the app

See `CONTRIBUTING.md` for prerequisites and dev commands. The primary dev command is:

```
WEBKIT_DISABLE_COMPOSITING_MODE=1 npm run tauri:dev
```

The `WEBKIT_DISABLE_COMPOSITING_MODE=1` env var is required on the Cloud VM to avoid rendering issues with the WebKitGTK compositor.

### Key caveats

- The `vite` alias in `package.json` points to `rolldown-vite` (not standard Vite). This may cause peer-dependency warnings during `npm install` — these are safe to ignore.
- On first launch, the Vite HMR server may emit transient `ENOENT` errors for some `.vue` files. These resolve after the initial module graph settles and do not affect the running app.
- Rust compilation (`cargo build` / `tauri dev`) takes ~60-90s on first run (subsequent builds are incremental and much faster).
- System dependency `libappindicator3-dev` may fail to install; use `libayatana-appindicator3-dev` instead (already present on Cloud VM).

### Checks and tests

Standard commands from `package.json`:

- `npm run lint:check` — ESLint + Stylelint (no auto-fix)
- `npm run test` — Vitest unit tests
- `npm run type-check` — vue-tsc
- `npm run check` — all three combined
