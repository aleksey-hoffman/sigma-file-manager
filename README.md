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
| ⌨️ | **The address bar behaves like Explorer's** — select-all on open, paste a path and press Enter to go there | **3.2.4** |
| ↔️ | **Swap the two split-view panes** — one button beside the search box | **3.2.4** |
| 📐 | **Thumbnail size in the narrow-window menu** — it used to disappear below 600px | **3.2.4** |
| 🤖 | **Built-in MCP server** — let an AI assistant read drives, folders, and search results over a standard interface | **3.2.1-beta** |
| ⚡ | **One-click setup for six assistants** — Codex, Cursor, Claude Code, Claude Desktop, OpenClaw, Minimax Code | **3.2.1-beta** |
| 🔎 | **Directory search genuinely recurses** — the walk stops on *matches*, not on entries scanned | **3.1.3** |
| 🎚️ | **Search options sit above the results**, with typo tolerance that actually does something | **3.1.3** |
| 🏷️ | **Favourites ask for a category** on add — pick an existing one or create one | **3.1.3** |
| 🗂️ | **Folder tree sidebar** — persistent, tracks the active pane | 2.2.x |
| ⚡ | **Focus Sync** — every file dialog follows the folder you're browsing | 2.2.x |
| 🧱 | **Directory & non-media rows keep a fixed height** as thumbnail size changes | **3.1.2** |
| ↕️ | **List columns vertically centred** — item / modified / created / type / link status | **3.1.2** |
| 🗃️ | **Dashboard favourites grouped by category**, and editable | **3.1.2** |
| 🧭 | **Right-click menu on the folder tree** — 6 actions | **3.1.0** |
| 🎚️ | **Per-folder layout toggle**, moved into the tab toolbar | **3.1.0** |
| 🖼️ | **Four thumbnail sizes** — 32 / 48 / 64 / 80 px | **3.1.0** |
| 🧹 | **Thumbnail cache usage + one-click clear** | 3.0.2 |
| 🔀 | **Mixed-folder sorting toggle** | 3.0.2 |
| ✅ | **Box selection on by default** | 3.0.2 |
| 🧠 | **Batch-rename data-loss fix** — no more silent overwrites | 3.0.1 |
| 📦 | One-step installer, in-place upgrade, complete uninstall | 3.0.0 |

---

## 🆕 What's new in 3.2.4

**3.2.4 is the first stable build of the 3.2 line.** The address bar behaves the
way Windows Explorer's does, split view can swap its two panes, and the thumbnail
size control is still there when the window gets narrow. It replaces 3.2.1-beta,
which was the last test build.

### ⌨️ The address bar behaves like Explorer's

Click it and it turns into an edit box with the current path **already
selected** — paste a new path and press Enter to go there. Previously the caret
sat at the end, so pasting appended to the old path and produced a mashed-together
string; press End if you would rather extend the existing path, exactly as in
Explorer.

Three defects went out together, and any one of them alone was enough to make
pasting a path unreliable:

- **A path was only read as a folder if it ended with a slash.** `D:\photos\2026`
  without the trailing slash came back as a single search result instead of the
  folder. A bare word such as `photos` is still treated as a search term, so
  name-based lookup is unchanged.
- **Enter no longer waits for the list.** The suggestion list needs a moment to
  refresh right after you paste, and pressing Enter during that window used to do
  nothing at all. It now acts on what is in the input box, immediately.
- **Arrow keys still win.** Arrow down to a file, press Enter, and that file is
  what opens — the typed path does not override your choice.

### 🌲 The suggestion list reads as a small tree

The first row is the directory you are pointing at — flush left, in a heavier
weight, and selected when the list opens, so pressing Enter goes straight into
it. Subfolders and files sit one indent in, level with each other, connected by a
vertical line with a short dash into each icon and closed off at the last row.
Subfolders come before files, each sorted by name.

### ↔️ Swap the two panes in split view

With two panes open, a swap button sits to the right of the search box in each
pane's toolbar. Click it and the panes trade folders — **only the folder
changes**; each pane keeps its own width and its own place in the tab order. If
both panes already show the same folder, nothing happens, and that is deliberate.

### 📐 Thumbnail size survives a narrow window

Below 600px the toolbar folds into a single "..." menu. The thumbnail size
control had only ever been added to the wide row of icons, so once the window
narrowed there was no way to reach it at all — not hidden, simply absent. It is
now in the "..." menu too, right after the matching list/grid item, and both
open the same dialog.

> **Still read-only.** The MCP server from 3.2.1-beta comes along unchanged —
> nothing in this release can move, rename or delete your files.

---

## 🆕 What's new in 3.2.1-beta

**3.2.1-beta is the AI release: the file manager ships an MCP server, so an
assistant can read your drives over a standard interface instead of being handed
screenshots and guessing.**

### 🤖 An assistant can now ask your file manager

[Model Context Protocol](https://modelcontextprotocol.io) is the interface Claude,
Codex, Cursor and a growing list of other assistants already speak. Switch the
server on in Settings → Experimental and they can list your drives, browse a
folder, search by filename, work out how much space a directory takes, and read
your favourites — through the file manager that already knows about shortcuts,
virtual folders and network shares.

**Six tools, all of them read-only.** Nothing can be moved, renamed, copied or
deleted, and the write operations are not switched off by default — they are not
implemented.

| Tool | The question it answers |
| --- | --- |
| `list_directory` | What is in this folder? |
| `get_drives` | Which drives does this computer have, and how much room is left? |
| `get_mountable_devices` | Which USB drives and shares can be connected? |
| `search_files` | Where is the file called…? |
| `get_directory_size` | How much space does this folder take, subfolders included? |
| `get_favorites` | What has this person starred? |

### 🔒 Three safeguards, none of them optional

- **Localhost only.** The server binds to 127.0.0.1 and nowhere else. Another
  device on your network cannot reach it even if it learns the address.
- **A random access key,** generated the first time you switch the server on.
  Requests without it are refused.
- **Requests from unknown sites are refused.** Only pages served from this
  computer are accepted.

Four permission levels, and whichever one you pick is **re-checked on every
single call** — turning it down takes effect on the very next request, with
nothing to reconnect.

### ⚡ One click per assistant

Hand-copying a JSON snippet into someone else's config file is where this usually
goes wrong: a missing comma and the assistant reports "no servers configured",
with nothing pointing at the actual mistake. Settings → Experimental → MCP server
now lists the assistants it can find on this computer, names **which file each
one reads**, and writes the entry for you. The same screen takes it back out
again.

Because this is *your* configuration file, the writing obeys three rules:

- **It only ever merges.** The file is parsed, exactly one entry is added or
  removed, and it is written back — the rest of the file, including the comments
  in Codex's `config.toml`, is left exactly as it was.
- **It refuses to write if it cannot read the file.** A config that fails to parse
  is reported and left alone, rather than replaced with something that looks right
  and is not.
- **It backs the file up first,** as `<that file>.alpha-mcp.bak`, every time.

An entry does not take effect until the assistant restarts, so the panel keeps a
notice on screen naming the file that changed and the backup that was taken.

### 📜 Everything is written down

Every call is logged next to your settings — which tool, when, and whether it was
allowed or turned down. Plain text; open it in any editor if you want to review
what an assistant has been asking for.

### 🧪 This is a beta

Only read operations are available, on purpose. The permission model and the
configuration panel may still change before the final release, and the interface
text may not be finished in every language yet.

---

## 🆕 What's new in 3.1.3

**3.1.3 is a search release: directory search now actually recurses, its options
move somewhere you can watch them, and the split view puts directories back on
the left.**

### 🔎 Directory search: recursion genuinely works now

The headline fix, and it took **two independent defects** stacked on top of each
other — fixing only one would still leave most directories unable to reach deep
files.

- **The traversal cap counted the wrong thing.** The recursive walk had a "stop
  once we have seen enough" limit, but it counted **entries scanned**, not entries
  matched, and the limit was 20× the result limit (50 × 20 = 1000 by default). In a
  photo directory with 43,167 entries the walk stopped at entry 1000 —
  indistinguishable from "current layer only". It now stops on **match count**,
  with the scan-volume safety valve widened separately so the two no longer
  constrain each other.
- **Short queries were discarded by the score threshold.** After a filename
  substring matched, a score gate still applied — and three-character queries
  demanded 0.9. Searching `095` against `20251009_0095_27.jpg` scores 0.82, so it
  was **thrown away on the spot**. This was independent of directory size: small
  directories failed the same way. The score now only **ranks** results; it no
  longer gates them.

> The 3.1.2 note claiming *"Search inside a folder now recurses"* was **not true
> at the time**. If you hit "searching the current directory can't find files in
> subfolders", this release is the fix for exactly that.

### 🎚️ Search options moved above the results

Show files / show directories / exact match / typo tolerance / result limit used
to live in a button plus popover inside the filter box — but the point of
adjusting options is to **watch the results change**. They are now permanently
visible above the results, and not rendered at all when you are not searching.

**Typo tolerance now actually does something** rather than being decoration: the
recursive scan also computes a similarity score when the substring misses. With it
off a misspelled query still finds nothing; with it on, it matches — both
directions are covered by tests. Directory search and global search now **share
one set of options**.

### ↔️ Split view after search: directories on the left

Opening global search used to push the search UI left and squeeze directories to
the right. It is the other way round now — **the left pane keeps the directory
view, the right pane switches to search**, matching the *open containing
directory* layout.

### 🔭 Default search depth 7 → 9 levels

Existing installations are migrated too — changing only the default has no effect
on people who already have 7 written in their local settings. **A depth you set
yourself is never overwritten.**

### 🏷️ Right-click "Add to favorites" asks for a category

Pick an existing category or create one on the spot. **There is no text field** —
just a choice. A new name that collides with an existing category lands in
*Uncategorized* instead of interrupting the operation, and entries that are already
favorited are skipped rather than asked again.

---

## 🆕 What's new in 3.1.2

**3.1.2 is a polish pass over how rows and cards behave when you change the
thumbnail size, plus the folder tree, sidebar and favourites work.**

### 🧱 Rows and cards stop growing for content that has no thumbnail

Changing the thumbnail size used to make **every** row taller — including the ones
that hold no thumbnail at all, so the extra height was pure whitespace.

- **Grid**: directory cards and non-media file cards now keep a **fixed height** at
  all four sizes. Non-media cards still change **width** (which decides how many
  fit per row), just not height.
- **List**: directory rows and non-media file rows likewise keep a fixed height —
  the default one. **Image and video rows still scale** with the setting, so
  thumbnails are never cropped.
- The **small** step moved up a notch so card content is no longer clipped — the
  description line used to survive as only its top edge.

All four steps now read their pixel and height values from **one table**, so the
virtual scroller, the CSS variables and the rendered cards can no longer disagree.

### ↕️ List columns are vertically centred

**Item, Modified, Created, Type and Link status** were pinned to the top of the
row while Name, Size, Tags and Link count sat centred. All of them are centred now.

This also fixed a stylesheet rule that **had never matched**: the link-status
column's class name was spelled differently in the component and in the CSS, so
that column was getting no styling at all.

### 🗂️ Folder tree, sidebar and favourites

- **The folder tree scrolls properly.** It used to overflow the panel with no way
  to scroll, hiding the last folders. It is a real scroll container now.
- **The sidebar panel groups things**: *Frequent* and *History* get their own
  sections, the redundant headings are gone, and clicking a section title jumps to
  the dashboard. Favourites and Tagged default to expanded; Frequent and History
  default to collapsed.
- **Dashboard favourites are grouped by category and can be edited**, and the
  favourites area distinguishes **categories, directories and files** by icon. The
  sidebar mirrors the grouping.

### 🔀 Open containing directory splits the window

Right-clicking a search result and choosing *Open containing directory in Alpha*
used to open a new tab. It now **splits the window: the containing folder on the
left, the search results on the right**, and the results list is preserved.

### 🩹 Fixed

- **A newly created favourite category no longer disappears after a restart.** The
  new field was silently dropped by a top-level field allow-list — the UI looked
  correct and the data was simply gone.
- **The home button opens This PC** instead of your user folder.
- **Search inside a folder now recurses** into subfolders.
  ⚠️ *This claim did not hold in 3.1.2 — the walk stopped after scanning 1,000
  entries, and short queries were dropped by a score threshold. Both are fixed
  properly in [3.1.3](#-whats-new-in-313).*
- **Box selection follows the grid column width** at every thumbnail size.
- The settings **external-links menu is branded**, and the dead *Discussions* entry
  is gone.

---

## What's new in 3.1.0

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

- **Four thumbnail sizes.** Small (32 px), Medium (48 px), Large (64 px) and
  Extra large (80 px) — pick one from the tab toolbar or
  **Settings → General → File view**. Row height follows the choice (48 / 64 / 80 /
  96 logical px for image and video rows), so the list never misaligns when you
  switch. Directory and non-media rows keep a fixed height — see
  [3.1.2](#-whats-new-in-312).
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
> 3.0.2 list thumbnails → 3.1.0 navigation & thumbnail sizes → 3.1.2 layout
> polish → **3.1.3** this release.

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

Architecture, file map and persistence details:
[`docs/FORK-NOTES.md`](./docs/FORK-NOTES.md).

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