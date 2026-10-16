# kizemo fork — implementation notes

This document describes additions layered on top of upstream
[`aleksey-hoffman/sigma-file-manager`](https://github.com/aleksey-hoffman/sigma-file-manager).
The fork tracks upstream's `main` branch and lives on
[kizemo/alpha-file-manager](https://github.com/kizemo/alpha-file-manager).

![Sigma File Manager with tree sidebar showing E:/办公文件 directory](./screenshots/tree-sidebar-v6.4.1.png)

---

## Folder tree sidebar (v6.4.1)

A toggleable, address-bar-synced, split-view-aware folder tree that lives
in the navigator sidebar.

### Feature highlights

- Toggle from the toolbar via a dedicated `FolderTreeIcon` button
  (independent of the list/grid layout dropdown).
- Single-click on a row navigates to that path; clicks on the chevron
  expand or collapse without navigating.
- Syncs with the address bar of every open tab.
- Split-view aware — each pane tracks its own selected path.
- Persists across sessions via `userSettings.navigator.showFolderTree`.

### Architecture

| Layer            | Path                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------- |
| State (Pinia)    | `src/stores/runtime/folder-tree.ts` — holds `selectedPath` and `expandedPaths`         |
| Tree builder     | `src/modules/navigator/composables/use-file-tree.ts`                                   |
| Renderer         | `src/modules/navigator/components/file-browser/file-browser-tree-view.vue`             |
| Sidebar host     | `src/modules/navigator/pages/navigator.vue`                                            |
| Toolbar toggle   | `src/modules/navigator/components/navigator-toolbar-actions/navigator-toolbar-actions.vue` |
| Settings type    | `src/types/user-settings.ts` (`navigator.showFolderTree`)                              |

### Persistence

`userSettings.navigator.showFolderTree: boolean` is the single source of
truth for whether the sidebar is rendered. Expanded paths and selected
path are stored in the Pinia `folder-tree` store; on reload, the store
re-hydrates from the active tab's address-bar path and re-discovers
expanded ancestors.

### Branch / commits

- Branch: `feat/tree-sidebar-v6-1`
- HEAD: `8caf14ae`
- Atomic commit series (v6 → v6.1 → v6.2 → v6.3 → v6.4 → v6.4.1):
  1. `fix(navigator): tree sync v6 — Pinia folder-tree store (issue #499)`
  2. `feat(navigator): sidebar tree + standalone toolbar toggle (v6.1, issue #499)`
  3. `fix(navigator): tree v6.2 UX polish — single-click nav, split-view sync, single-path expand`
  4. `fix(navigator): tree v6.3 — depth collapse + chevron/row click split`
  5. `feat(navigator): tree v6.4 — drive volume labels + hard-drive icon`
  6. `fix(navigator): tree v6.4.1 — drop duplicate "(C:)" suffix on drive labels`
- 259 unit tests passing.

### Upstream tracking

Tracks upstream issue
[#499](https://github.com/aleksey-hoffman/sigma-file-manager/issues/499).

---

## File dialog focus sync — shipped

When Alpha loses focus to a system file dialog (Save As / Open), the dialog is
primed with the navigator's current path, so returning to Alpha drops the user
back where they left off. This mirrors the "quick-switch" behaviour in tools
like Listary.

**Status** — shipped as of **2.2.x**. The installer bundles the extension
(`extensions/kizemo.focus-sync/`) plus a small local companion process; a
Windows scheduled task starts it at logon. See the "Focus Sync" section of the
top-level `README.md` for its behavioural guarantees.

### Implementation note

The shipped design deliberately **is not** the in-process Tauri hook sketched
here originally (`docs/superpowers/plans/2026-09-26-dialog-focus-sync.md`, in the
meta repo). That plan assumed a Tauri focus-event hook plus direct `IFileDialog`
COM access. Both were dropped:

- `IFileDialog::SetFolder` needs the COM interface to be re-acquired from a live
  dialog; on an already-shown dialog it is not exposed, so the route was
  abandoned.
- The per-platform behaviour the plan worried about (Win32 / Chromium / WinUI
  hosts) turned out to be the dominant source of real failures, and is handled
  better by a separate process with its own lifetime than by an in-process
  hook.

The extension requests only `commands`, `toolbar`, `notifications` and HTTP to
`127.0.0.1` — no shell access, no filesystem access.