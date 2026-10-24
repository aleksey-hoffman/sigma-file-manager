<!-- markdownlint-disable MD033 MD041 -->

**[English](README.md)** | **[中文](README.zh-CN.md)**

[![Stars](https://img.shields.io/github/stars/kizemo/alpha-file-manager?style=for-the-badge&logo=github&color=70b59d)](https://github.com/kizemo/alpha-file-manager/stargazers)
[![Forks](https://img.shields.io/github/forks/kizemo/alpha-file-manager?style=for-the-badge&logo=github&color=70b59d)](https://github.com/kizemo/alpha-file-manager/network/members)
[![Issues](https://img.shields.io/github/issues/kizemo/alpha-file-manager?style=for-the-badge&logo=github&color=70b59d)](https://github.com/kizemo/alpha-file-manager/issues)
[![Latest release](https://img.shields.io/github/v/release/kizemo/alpha-file-manager?style=for-the-badge&logo=github&color=70b59d&label=release)](https://github.com/kizemo/alpha-file-manager/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/kizemo/alpha-file-manager/total?style=for-the-badge&logo=github&color=70b59d)](https://github.com/kizemo/alpha-file-manager/releases)
[![License](https://img.shields.io/badge/license-GPL--3.0-70b59d.svg)](./LICENSE.md)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-70b59d.svg)](https://github.com/kizemo/alpha-file-manager/releases)

<h1>
  <img valign="middle" src="./.github/media/alpha-file-manager-logo.png" width="56px" alt="Alpha File Manager">
  &nbsp;&nbsp;Alpha File Manager
</h1>

**A modern file manager for Windows and Linux — with the two things you miss most
in Explorer: a real folder tree, and file dialogs that follow you between apps.**

![Alpha File Manager](docs/screenshots/afm-main-window.png)

Alpha File Manager is an independent build of
[Sigma File Manager](https://github.com/aleksey-hoffman/sigma-file-manager),
maintained by [kizemo](https://github.com/kizemo). It tracks upstream and layers on
a permanent folder tree, cross-app dialog path sync, a built-in MCP server for AI
assistants, remote servers over SFTP/FTP/FTPS, recursive folder comparison with
sync, batch rename, and a long list of day-to-day fixes.

> [!IMPORTANT]
> **Alpha File Manager is an independent community project.** It is not affiliated
> with, endorsed by, or supported by the Sigma File Manager project. The base
> application's features and branding belong to [Aleksey Hoffman](https://github.com/aleksey-hoffman).

---

## ✨ Highlights

- 🗂️ **A folder tree that is always there** — it follows the pane you are in, local
  or remote, and it is the first thing you reach for instead of typing a path.
- ⚡ **Focus Sync** — every *Save As* / *Open* dialog in any other Windows app
  opens in the folder you are browsing. Zero configuration.
- 🔍 **Compare two folders, then sync what you find** — recursive, with the
  criteria serious tools use, and an explicit "direction undecided" state instead
  of guessing which side is newer.
- 🤖 **A built-in MCP server** — let an AI assistant list drives, browse folders,
  search files and read your favourites over a standard interface.
- 🔐 **Real remote servers** — SFTP, FTP and FTPS with pinned host keys and
  certificates, plus upload, download, delete and permission editing.
- 🧠 **Batch rename that does not lose work** — find-and-replace, case conversion,
  templates and numbering, with a live preview, conflicts blocked instead of
  silently overwriting, and undo.

---

## 🧭 Features

### Browse and organise

| | |
|---|---|
| 🗂️ | **Permanent folder tree** — follows the active pane, becomes the remote tree, remembers its own expansion state |
| 🗂️ | **Tabs and split view** — swap the two panes with one button, and a synchronized-browsing toggle right beside it |
| 🔎 | **Smart global search** — full-drive search with typo tolerance, and directory search that genuinely recurses |
| 🏷️ | **Tags** — organise files and folders, with a grouped, editable dashboard |
| ⭐ | **Favourites by category** — adding one asks which category it belongs to; categories are editable |
| 🎚️ | **Item filter** — narrow a large folder by name, size, date, type and more |
| 🖼️ | **Thumbnails** — four sizes, generated lazily only for what is on screen |
| 📐 | **Per-folder layout** — list or grid, chosen per location rather than globally |

### Compare and sync

| | |
|---|---|
| 🔍 | **Recursive comparison** — modification time first, then size, then content checksum, in WinSCP's order |
| 🧭 | **"Direction undecided"** — same timestamp, different contents: listed separately, never overwritten |
| 📋 | **The plan comes first** — a preview of every file that would be created, copied or skipped, before the first byte moves |
| 🗑️ | **Compare and sync never deletes** — mirroring is a later release |

### Work on remote servers

| | |
|---|---|
| 🔐 | **SFTP · FTP · FTPS** — host keys and X.509 certificates pinned per host and port |
| ⬆️⬇️ | **Upload and download** — the receiving pane refreshes itself when the transfer finishes |
| 🗑️ | **Delete, honestly** — one *Delete* entry, no pretend recycle bin, the server's refusal reported as it is |
| 🔐 | **Permissions from a list** — pick the mode instead of typing the octal |
| 🌐 | **Map a network drive** — pick the share and the drive letter, like Explorer does |

### Automation and AI assistants

| | |
|---|---|
| 🤖 | **Built-in MCP server** — six read-only tools: drives, directory listing, search, size, favourites, mountable devices |
| ⚡ | **One-click setup for six assistants** — Codex, Cursor, Claude Code, Claude Desktop, OpenClaw, MiniMax Code |
| 🔒 | **Hardened by default** — localhost only, a random access key, and per-call permission checks |
| 🔌 | **Extensions and a marketplace** — extensions can add commands, pages, shortcuts and settings |
| ⌨️ | **Shortcuts and a command palette** — most actions are reachable from the keyboard |

### Look and feel

| | |
|---|---|
| 🎨 | **Background effects** — custom images and videos, with Photoshop-style blend modes |
| 🖼️ | **Quick view** — preview images, video, audio, PDFs and text with `Space`, without leaving the app |
| 📦 | **Zip archives** — compress and extract without leaving the app |
| 🪟 | **Can replace Explorer** — register as the default file manager on Windows |

---

## 📸 Screenshots

| | |
|---|---|
| ![Quick Access](docs/screenshots/afm-dashboard-hero-light.png) | **Quick Access** — favourites grouped by category, with thumbnails, sizes and relative times |
| ![Compare and sync](docs/screenshots/afm-dashboard-card-enrichment.png) | **The dashboard** — a single place for favourites, tags, frequent places and history |

---

## ⚖️ Alpha File Manager vs Sigma File Manager vs Windows Explorer

Three different tools, three different jobs. Here is the honest version of how
they compare.

| | | Alpha File Manager | Sigma File Manager | Windows Explorer |
|---|---|---|---|---|
| 🖥️ | **Where it runs** | Windows + Linux | Windows + Linux | Windows only |
| 🌲 | **Folder tree in the left sidebar** | ✅ a permanent tree that follows the pane you are in — and becomes the remote tree | ➖ none | ✅ in the navigation pane |
| ⭐ | **Getting to the folders you use daily** | ✅ favourites grouped by category and editable — adding one asks which category it belongs to, so your working set is one click away | ➖ no categories, and adding one never asks | ➖ pinned to Quick access, no categories |
| ⚡ | **File dialogs in other apps** | ✅ **Focus Sync** — every dialog opens in the folder you are browsing | ➖ | ❌ |
| 🤖 | **Driven by an AI assistant** | ✅ built-in MCP server, one-click setup for six assistants | ❌ | ❌ |
| 🔐 | **Remote servers** | ✅ SFTP · FTP · FTPS, host keys and certificates pinned | ❌ | ➖ SMB / WebDAV / OneDrive, and no SFTP at all |
| 📤 | **Working on remote files** | ✅ upload, download, delete, set permissions | ❌ | ➖ shares only |
| ↔️ | **Two panes, used together** | ✅ **swap them with one button**, and a **synchronized browsing** toggle right beside it — enter a folder and the other pane follows, going up a level takes it along too | ➖ **no pane swap**; linked browsing exists but is a buried option in the navigator menu | ➖ tabs, not panes |
| 🔍 | **Comparing two folders** | ✅ recursively, with the criteria serious tools use — and an explicit "direction undecided" state instead of guessing which side is newer | ➖ | ➖ compares by size and date only, and the choice is buried |
| 🧠 | **Batch rename** | ✅ find-and-replace, case conversion, templates and numbering — with a live preview, conflicts blocked instead of silently overwriting, and undo | ❌ not in Sigma at all | ✅ find-and-replace, with a preview |
| 🫳 | **Dragging a file into another program** | ✅ **hold the file and drag** it into WeChat, DingTalk or a browser — the window you are dragging out of stays in the background | ➖ | ✅ |
| 👁️ | **The program you drag over comes to the front** | ✅ the window under the pointer is brought forward while you carry the file, so you can see where it will land | ➖ | ➖ a Windows drag never raises the window under the pointer |
| ⌨️ | **Keyboard range selection** | ✅ **Shift + arrow key** extends the selection from the anchor you started at | ➖ | ✅ Shift + arrow key extends the selection too |
| 📊 | **Which columns to show** | ✅ chosen per location — the drives page drops the columns that have nothing to say | ➖ one set for every folder | ➖ one set for every folder |
| 💾 | **How full a drive is** | ✅ filled on the card, plus a Free space column | ➖ | ✅ |
| 🖼️ | **Thumbnail size** | ✅ four sizes | ➖ | ➖ the system size |
| 🌐 | **Mapping a network drive** | ✅ from the sidebar, with a drive letter you pick | ➖ | ✅ |
| 🎨 | **Background effects can blend** | ✅ the full set of Photoshop layer modes, with your own fill colour | ➖ | ❌ |

✅ has it · ➖ not part of that project · ❌ cannot

> **If you want the file manager that is part of Windows** — with the shell
> extensions, the codecs, the network shares, the EFS encryption and the "it
> works with everything" factor — use Explorer. No third-party file manager
> replaces that, and we are not going to pretend otherwise.
>
> **If you want one window in which a local disk and a remote server sit side by
> side**, with an assistant able to read your drives over a standard interface
> and a tree that follows you into either of them — that is what Alpha File
> Manager is. Explorer ships no SFTP client at all, and no way to let an
> assistant see your files without a third-party bridge.
>
> **Sigma File Manager** is the base application we build on. Take it if you
> want the upstream project itself, its own release cadence and its community.
> Alpha File Manager is an independent fork of it and tracks upstream.

---

## 📦 Download & install

**Primary download:** [**www.aiec.fun/alpha-file-manager**](https://www.aiec.fun/alpha-file-manager/)
— this is the update channel the app itself checks.

| | Platform | How |
|---|---|---|
| 🪟 | **Windows** | One-step installer from [the download page](https://www.aiec.fun/alpha-file-manager/) — installs, upgrades in place, and uninstalls cleanly |
| 🪟 | **Windows, portable** | The same installer works as a per-user install; the app never needs elevation |
| 🐧 | **Linux** | Builds are produced from source (`.deb` / `.AppImage`); see [build from source](#-build-from-source) |

GitHub releases carry the same installer and act as a fallback mirror:
[releases/latest](https://github.com/kizemo/alpha-file-manager/releases/latest).

> **Windows builds are unsigned**, so SmartScreen reports *"Unknown publisher"* —
> click **More info → Run anyway**. Upgrading in place keeps your settings,
> extensions and window layout.

---

## 🆕 What's new in 3.5.0

### 🔍 Comparing two folders no longer gives up at the first folder it cannot read

**Fixed.** Comparing two folders used to fail completely the moment it met a
single directory it was not allowed to read. Windows keeps a lot of those — the
recycle bin, anything another program is holding open — and a real folder tree
is full of them, so in practice the comparison usually ended in an error instead
of a result. Unreadable directories are now **skipped**, the count is shown in
the summary, and the comparison carries on with everything else.

### ⚡ Comparing a large tree is about fifty times faster

**Improved.** Collecting the two sides was **93% of the time**, and it was slow
for one reason: the metadata of every entry was looked up by rebuilding an
absolute path and asking again, which on Windows costs about a hundred times
more than asking the directory entry itself. The metadata now comes straight from
the directory entry, and **four workers collect in parallel**.

Measured on one machine, over the same ten thousand entries: **1.18 seconds
before, 23 milliseconds after.** The measurement was run in **both orders**, so
neither implementation could claim the advantage of a warm cache.

### 📊 The comparison now tells you how far along it is

**Added.** Walking a large tree takes a while, and the dialog used to show
nothing but a spinner — there was no way to tell a working application from a
stuck one. It now says **which side it is reading**, how many entries it has
been through, and how far along the comparison itself is.

### 🗑️ Deleting a big folder tree finally shows what it is doing

**Fixed.** The delete progress bar was counting the **top-level entries you had
selected**, so deleting one folder that held 250,000 files showed a single jump
from 0% to 100% at the very end. It is now driven by the number of items
**actually deleted**, with the freed space shown alongside it. Cancelling is
checked before **every file**, and up to four independent subtrees are removed
in parallel.

> The full history — every release, every fix — is in the
> [changelog](CHANGELOG.md) and on the
> [releases page](https://github.com/kizemo/alpha-file-manager/releases).

---

## 👥 Community

| | |
|---|---|
| 🌐 | **Website** — [www.aiec.fun/alpha-file-manager](https://www.aiec.fun/alpha-file-manager/) |
| 💬 | **Discussions** — [ask a question or share an idea](https://github.com/kizemo/alpha-file-manager/discussions) |
| 🐛 | **Issues** — [report a bug](https://github.com/kizemo/alpha-file-manager/issues) |
| 🧑‍💻 | **Contributing** — [CONTRIBUTING.md](CONTRIBUTING.md) |

> **If Alpha File Manager is useful to you, a star helps other people find it.**
> GitHub only shows a project to people who search for it or see it shared, and
> a star is the single cheapest way to make it visible to both.

---

## 💻 Build from source

Alpha File Manager is a [Tauri v2](https://v2.tauri.app/) application: a Rust
backend (`src-tauri/`) and a Vue 3 + TypeScript frontend (`src/`).

```bash
git clone https://github.com/kizemo/alpha-file-manager.git
cd alpha-file-manager
npm ci --ignore-scripts
npm run tauri:dev          # development
npm run check              # lint + type-check + tests
npm run tauri:build        # release build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for prerequisites and the full workflow.

---

## Credits

- **Upstream:** [aleksey-hoffman/sigma-file-manager](https://github.com/aleksey-hoffman/sigma-file-manager)
  by [Aleksey Hoffman](https://github.com/aleksey-hoffman). The base application,
  its features and its branding belong to upstream.
- **Focus Sync extension:** lives in THIS repository under
  [`extensions/kizemo.focus-sync/`](./extensions/kizemo.focus-sync/) —
  extension payload, sidecar source and the standalone installer. Released
  standalone installers are archived at
  [kizemo/focus-sync](https://github.com/kizemo/focus-sync).
- **Maintainer of this fork:** [kizemo](https://github.com/kizemo)

Additional code reused under its original terms:
[inaku-Gyan/PathWrap](https://github.com/inaku-Gyan/PathWrap) (MIT) ·
[QwenLM/qwen-code](https://github.com/QwenLM/qwen-code) (Apache-2.0).

---

## License

**GPL-3.0-or-later** — the full text is in [`LICENSE.md`](./LICENSE.md), and the
copyright notice plus a plain-language summary are in [`NOTICE.md`](./NOTICE.md).
Fork additions are contributed under the same license.

As required by GPL-3, the corresponding source for every shipped binary is
available at:

| Component | Source |
|---|---|
| Alpha File Manager (this fork) | <https://github.com/kizemo/alpha-file-manager> |
| Sigma File Manager (base) | <https://github.com/aleksey-hoffman/sigma-file-manager> |
| Focus Sync extension + sidecar | bundled in this repository, `extensions/kizemo.focus-sync/` |
