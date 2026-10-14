**[English](README.md)** | **[中文](README.zh-CN.md)**

<h1>&nbsp;&nbsp;Alpha File Manager</h1>

**A modern file manager for Windows and Linux — with the two things you miss
most in Explorer: a real folder tree, and file dialogs that follow you between apps.**

Alpha File Manager is an independent build of
[Sigma File Manager](https://github.com/aleksey-hoffman/sigma-file-manager),
maintained by [kizemo](https://github.com/kizemo). It tracks upstream and layers on
a folder tree, cross-app dialog path sync, and a long list of day-to-day fixes.

> [!IMPORTANT]
> **Alpha File Manager is an independent community project.** It is not affiliated
> with, endorsed by, or supported by the Sigma File Manager project. The base
> application's features and branding belong to [Aleksey Hoffman](https://github.com/aleksey-hoffman).

---

## ✨ What we added on top of Sigma File Manager

Everything below is ours. Nothing in this section exists upstream.

| | Feature | Since |
|---|---|---|
| 🗂️ | **Folder tree sidebar** — persistent, tracks the active pane | 2.2.x |
| ⚡ | **Focus Sync** — every file dialog follows the folder you're browsing | 2.2.x |
| 🧭 | **Right-click menu on the folder tree** — 6 actions | **3.1.0** |
| 🎚️ | **Per-folder layout toggle**, moved into the tab toolbar | **3.1.0** |
| 🖼️ | **Four thumbnail sizes** — 24 / 32 / 48 / 54 px | **3.1.0** |
| 🧹 | **Thumbnail cache usage + one-click clear** | 3.0.2 |
| 🔀 | **Mixed-folder sorting toggle** | 3.0.2 |
| ✅ | **Box selection on by default** | 3.0.2 |
| 🧠 | **Batch-rename data-loss fix** — no more silent overwrites | 3.0.1 |
| 📦 | One-step installer, in-place upgrade, complete uninstall | 3.0.0 |

---

## 🆕 What's new in 3.1.0

**3.1.0 is everything we added after renaming the app to Alpha File Manager.**
3.0.0 was the rebranding release; 3.0.1 fixed a batch-rename data-loss bug; 3.0.2
added list thumbnails. This release is the polish pass on top of those.

### 🧭 Navigation

- **The folder tree gets a right-click menu.** Right-click any node — a drive, a
  folder, a file — and you get **Copy, Cut, Paste, Rename, Open containing
  directory, Properties**. Paste only appears when your clipboard actually holds
  something. Rename reuses the same dialog as the file list, so it behaves
  identically wherever you invoke it from.
- **The layout toggle moved to the tab toolbar**, next to refresh, and now writes
  to **the current folder only** instead of globally. Two tabs showing the same
  folder can sit in different layouts, and switching tabs no longer clobbers the
  other one's view. If you prefer the old global behaviour, the toggle is still
  in the collapsed ⋮ menu under "this folder only".
- **Drives show free space *and* total.** Locations entries display
  `147.1 GB / 931.3 GB` instead of an item count.

### 🖼️ Thumbnails

- **Four thumbnail sizes.** Small (24 px), Medium (32 px), Large (48 px) and
  Extra large (54 px) — pick one from the tab toolbar or
  **Settings → General → File view**. Row height follows the choice (42 / 42 / 64 /
  70 logical px), so the list never misaligns when you switch.
- Thumbnails are generated **lazily**: only for rows scrolled into view.

### 🏠 Home & settings

- **The home title sits outside the theme image**, at a readable size. Clicking
  the image itself now opens background management directly.
- **Settings links to the official site and this repository.** The about text
  describes what *this* build adds over Sigma File Manager, rather than the
  upstream blurb.

### 🔧 Fixes

- **Focus Sync stopped going silent after the app had been running for a few
  minutes.** The sidecar recorded a dialog as "already written" even when the
  write had been *refused*, which permanently disabled its own retry path — so
  after an early failure, every later path change was ignored until you closed
  the dialog and reopened it. Failed writes are no longer recorded as successes.
- **The extension loader rejected our own extension.** A code scanner flagged the
  word `self` inside an English *comment* in the bundled extension, so Focus Sync
  was refused before its worker ever started — which is what made path sync look
  broken everywhere at once. The scanner now ignores comments and string
  literals, while still rejecting real violations in executable code.
- **Right-click Copy / Cut on the tree threw a signature error** instead of
  populating the clipboard.

### 📦 Installer

- Upgrades and uninstalls now **terminate the app's whole process tree**, so a
  leftover helper process can no longer hold a file open and abort the install.

> **Version lineage:** 2.2.x → **3.0.0** rebrand → 3.0.1 rename data-loss fix →
> 3.0.2 list thumbnails → **3.1.0** this release.

---

## 🗂️ Folder tree sidebar

![Alpha File Manager with the folder tree sidebar showing E:/办公文件](./docs/screenshots/tree-sidebar-v6.4.1.png)

A folder tree down the left edge that mirrors the file system and tracks
whichever pane is active — so you can see the shape of where you are and reach
any ancestor in one click.

- **Always one click away** — a dedicated `FolderTree` button in the navigator
  toolbar, deliberately *not* buried in the layout dropdown.
- **Follows everything** — tracks the address bar, the favourites panel, and the
  **active pane** in split view; each side keeps its own expansion state.
- **Stays compact** — on navigation only the current path's ancestor chain stays
  open; everything else collapses.
- **Predictable clicks** — click a row to enter it, click the chevron to expand
  without changing directory.
- **Unambiguous drives** — root nodes show volume label *and* drive letter
  (`Win (C:)`), so multi-drive and WSL setups read at a glance.
- **Right-clickable** — the six-action menu described above.
- **Remembers** — show/hide state persists across restarts.

Tracks upstream issue [#499](https://github.com/aleksey-hoffman/sigma-file-manager/issues/499).

---

## ⚡ Focus Sync — file dialogs that follow you

Browse to a folder, then open a **Save As / Open** dialog in *any* Windows app —
Chrome downloads, Word, VS Code, DingTalk, Feishu — and it's already sitting in
that same folder.

**Zero configuration.** The installer bundles the extension and a small local
companion process; a Windows scheduled task starts it at logon. There is nothing
to launch by hand.

**The rules it holds itself to**

| | |
|---|---|
| **Never steals focus** | If the dialog isn't in the foreground, the write waits — it is never forced. |
| **Never leaves a dirty filename** | The address bar is the target. When a fallback must touch the filename field, it restores the original and **reads the value back** before committing. |
| **Never writes a stale path** | If Alpha FM isn't running, writes are refused rather than filling your dialog with where you *used to* be. |

The extension requests only `commands`, `toolbar`, `notifications`, and HTTP to
`127.0.0.1` — **no shell access, no filesystem access.**

> **Status** — still being hardened. Validated against native Win32 dialogs;
> behaviour varies across Chromium and UWP hosts.

---

## 📦 Getting it

**Primary download:** [**www.aiec.fun/alpha-file-manager**](https://www.aiec.fun/alpha-file-manager/)
— this is the update channel the app itself checks.

**GitHub releases** carry the same installer and act as a fallback mirror.

Windows builds are unsigned, so SmartScreen reports *"Unknown publisher"* — click
**More info → Run anyway**. Upgrading in place keeps your settings, extensions
and window layout.

---

## Credits

- **Upstream:** [aleksey-hoffman/sigma-file-manager](https://github.com/aleksey-hoffman/sigma-file-manager)
  by [Aleksey Hoffman](https://github.com/aleksey-hoffman). The base application,
  its features and its branding belong to upstream.
- **Focus Sync extension:** lives in THIS repository under
  [`extensions/kizemo.focus-sync/`](./extensions/kizemo.focus-sync/) —
  extension payload, sidecar source and the standalone installer.
  Released standalone installers are archived at
  [kizemo/focus-sync](https://github.com/kizemo/focus-sync).
- **Maintainer of this fork:** [kizemo](https://github.com/kizemo)

Additional code reused under its original terms:
[inaku-Gyan/PathWrap](https://github.com/inaku-Gyan/PathWrap) (MIT) ·
[QwenLM/qwen-code](https://github.com/QwenLM/qwen-code) (Apache-2.0).

---

## License

**GPL-3.0-or-later** — see [`LICENSE.md`](./LICENSE.md). Fork additions are
contributed under the same license.

As required by GPL-3, the corresponding source for every shipped binary is
available at:

| Component | Source |
|---|---|
| Alpha File Manager (this fork) | <https://github.com/kizemo/alpha-file-manager> |
| Sigma File Manager (base) | <https://github.com/aleksey-hoffman/sigma-file-manager> |
| Focus Sync extension + sidecar | bundled in this repository, `extensions/kizemo.focus-sync/` |