# Agents

## Cursor Cloud specific instructions

### Overview

Sigma File Manager is a Tauri v2 desktop app (Vue 3 + TypeScript frontend, Rust backend). It is a single project (not a monorepo). No external services, databases, or Docker are needed.

### Key commands

See `package.json` scripts and `CONTRIBUTING.md` for full details. Quick reference:

| Task | Command |
|---|---|
| Lint + type-check | `npm run check` |
| ESLint fix | `npm run lint:eslint` |
| Stylelint fix | `npm run lint:stylelint` |
| Unit tests (vitest) | `npm run test:unit` |
| Vite frontend only | `npm run dev` (serves on `http://localhost:1420`) |
| Full Tauri app | `WEBKIT_DISABLE_COMPOSITING_MODE=1 npm run tauri:dev` |
| Rust backend only | `cd src-tauri && cargo build` |

### Non-obvious caveats

- **Always use `WEBKIT_DISABLE_COMPOSITING_MODE=1`** when running `tauri:dev` on Linux in this cloud environment. Without it, WebKitGTK may crash or show rendering artifacts.
- The Tauri `beforeDevCommand` starts Vite automatically, so do not start Vite separately before running `npm run tauri:dev` or the port will conflict on 1420.
- No test files exist yet; `npm run test:unit -- --run` will exit with code 1 ("No test files found"). The vitest infrastructure is configured and ready for when tests are added.
- The Rust build has some compiler warnings (unused imports, dead code) that are pre-existing in the codebase — these are not errors.
- `vite` is aliased to `rolldown-vite` via `"vite": "npm:rolldown-vite@latest"` in `package.json`.
