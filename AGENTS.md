## Cursor Cloud specific instructions

### Project overview

Sigma File Manager is a Tauri v2 desktop file manager (Vue 3 + Rust). See `CONTRIBUTING.md` for the full dev setup guide and `package.json` for available npm scripts.

### Running the app

- `npm run tauri:dev` starts both the Vite frontend (port 1420) and the Rust backend in a single command.
- On Linux with GPU issues: `npm run tauri:dev:webkit-igpu`
- The first Rust compilation takes ~90s; subsequent rebuilds with hot-reload are fast.

### Lint / type-check / test

- `npm run check` runs both `type-check` and `lint:check` in parallel.
- `npm run test:unit` runs Vitest (no test files exist as of v2.0.0-beta.1).

### Gotchas

- Rust >=1.88.0 is required (`src-tauri/Cargo.toml` `rust-version`). Run `rustup default stable` to activate the latest stable toolchain if `rustc --version` reports an older version.
- Tauri v2 on Linux requires system libraries: `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `libssl-dev`, `libxdo-dev`, `librsvg2-dev`, `libsoup-3.0-dev`, `libjavascriptcoregtk-4.1-dev`, `patchelf`. These are pre-installed in the Cloud VM.
- The app emits `libEGL warning: DRI3 error` on startup in the VM; this is cosmetic and does not affect functionality.
- `vite` is aliased to `rolldown-vite@latest` in `package.json` devDependencies; peer-dependency warnings from `vite-plugin-vue-devtools` during `npm install` are expected and harmless.
