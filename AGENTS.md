# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Sigma File Manager is a Tauri v2 desktop file manager for Windows/Linux. It has two tightly-coupled halves:
- **Frontend**: Vue 3 + TypeScript + Vite (port 1420)
- **Backend**: Rust (Tauri) in `src-tauri/`

There are no external services, databases, or Docker dependencies.

### Key commands

All standard commands are in `package.json`. The most important ones:

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev mode | `WEBKIT_DISABLE_COMPOSITING_MODE=1 npm run tauri:dev` |
| Lint (all) | `npm run lint:check` |
| ESLint only | `npm run lint:eslint:check` |
| Stylelint only | `npm run lint:stylelint:check` |
| Type check | `npm run type-check` |
| Full check | `npm run check` (type-check + lint) |
| Frontend build | `npm run build-only` |
| Rust build | `cd src-tauri && cargo build` |
| Unit tests | `npx vitest run` (no test files exist yet) |

### Non-obvious caveats

- **`WEBKIT_DISABLE_COMPOSITING_MODE=1`** is required when running `tauri:dev` in headless/cloud environments to avoid WebKit GPU rendering issues. Use it for all `tauri dev` and `tauri build` invocations.
- **Rust toolchain >= 1.88.0** is required (MSRV in `Cargo.toml`). If `rustup` has an older default, run `rustup default stable` to switch.
- **Tauri system dependencies** must be installed on Linux: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`, `libssl-dev`, `libsoup-3.0-dev`, `libjavascriptcoregtk-4.1-dev`. These are APT packages.
- **Node.js >= 22.13.1** is required (`engines` in `package.json`).
- The Vite config uses `rolldown-vite` (aliased as `vite` in `package.json`), which may produce peer dependency warnings during `npm install` — these are harmless.
- There are **no test files** in the repo. Vitest is configured but will exit with code 1 when run with `npx vitest run` due to no `.spec.ts`/`.test.ts` files found.
- The Rust build has a few harmless compiler warnings (unused imports, dead code) that are pre-existing.
- First Rust compilation takes ~2 minutes; subsequent incremental builds are much faster.
