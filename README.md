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
| 🔍 | **Compare two folders side by side** — recursively, and sync what it finds. You see the plan before anything moves | **3.4.0** |
| 🧭 | **When it cannot tell which side is newer, it says so and changes nothing** — those items are listed, never overwritten | **3.4.0** |
| 🗑️ | **The compare-and-sync feature never deletes anything** — mirroring is a later release | **3.4.0** |
| 🌐 | **Map a network drive from the sidebar** — pick the share and the drive letter, exactly like Explorer | **3.4.0** |
| 🫳 | **Hold a file and drag it into another program** — WeChat, DingTalk, a browser — without your window jumping to the front and covering the target | **3.3.0** |
| 👁️ | **The program you drag over comes to the front** — you can see where the file will land | **3.3.0** |
| 🎨 | **Photoshop-style blend modes for the background effect**, with a fill colour of your own | **3.3.0** |
| ⌨️ | **Hold Shift and press an arrow key to select a range** — anchored where you started | **3.3.0** |
| 🔒 | **Extensions can no longer be steered onto a computer on your own network** | **3.3.0** |
| 🌐 | **Browse remote servers for real** — SFTP, FTP and FTPS, with host keys and certificates pinned | **3.2.11** |
| 🌲 | **The folder tree follows the pane you are in**, local or remote | **3.2.11** |
| ⬆️⬇️ | **Upload and download** to and from a remote server — and the receiving pane refreshes itself | **3.2.11** |
| 🗑️ | **Remote files can be deleted** — one entry, no pretend recycle bin, the server's refusal reported as it is | **3.2.11** |
| 🔐 | **Remote permissions from a list** — pick the mode instead of typing the octal | **3.2.11** |
| 🏠 | **A new tab opens on your drives**, and the drives page shows how full each one is | **3.2.11** |
| 🧹 | **The delete options are a real menu** — they used to be a tooltip you could not click | **3.2.11** |
| ⌨️ | **The address bar behaves like Explorer's** — select-all on open, paste a path and press Enter to go there | **3.2.4** |
| ↔️ | **Swap the two split-view panes** — one button beside the search box | **3.2.4** |
| 🔗 | **Synchronized browsing** — a toggle right beside the swap button; enter a folder and the other pane follows, even going up a level | **3.2.6** |
| 📐 | **Thumbnail size in the narrow-window menu** — it used to disappear below 600px | **3.2.4** |
| 🤖 | **Built-in MCP server** — let an AI assistant read drives, folders, and search results over a standard interface | **3.2.1-beta** |
| ⚡ | **One-click setup for six assistants** — Codex, Cursor, Claude Code, Claude Desktop, OpenClaw, Minimax Code | **3.2.1-beta** |
| 🔎 | **Directory search genuinely recurses** — the walk stops on *matches*, not on entries scanned | **3.1.3** |
| 🎚️ | **Search options sit above the results**, with typo tolerance that actually does something | **3.1.3** |
| 🏷️ | **Favourites ask for a category** on add — pick an existing one or create one | **3.1.3** |
| 🗂️ | **Folder tree in the left sidebar** — permanent, follows the pane you are in, and becomes the remote tree | 2.2.x |
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
| 🧠 | **Batch rename** — find-and-replace, case conversion, templates and numbering, with a live preview, conflicts blocked instead of silently overwriting, and undo | **3.0.0** |
| 📦 | One-step installer, in-place upgrade, complete uninstall | 3.0.0 |

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
| 📊 | **Which columns to show** | ✅ chosen per location — the drives page drops the columns that have nothing to say | ➖ one set for every folder | ➖ one set for every folder |
| 💾 | **How full a drive is** | ✅ filled on the card, plus a Free space column | ➖ | ✅ |
| 🖼️ | **Thumbnail size** | ✅ four sizes | ➖ | ➖ the system size |
| 🧠 | **Batch rename** | ✅ find-and-replace, case conversion, templates and numbering — with a live preview, conflicts blocked instead of silently overwriting, and undo | ❌ not in Sigma at all | ✅ find-and-replace, with a preview |
| 🫳 | **Dragging a file into another program** | ✅ **hold the file and drag** it into WeChat, DingTalk or a browser — the window you are dragging out of stays in the background | ➖ | ✅ |
| 👁️ | **The program you drag over comes to the front** | ✅ the window under the pointer is brought forward while you carry the file, so you can see where it will land | ➖ | ➖ a Windows drag never raises the window under the pointer |
| ⌨️ | **Keyboard range selection** | ✅ **Shift + arrow key** extends the selection from the anchor you started at | ➖ | ✅ Shift + arrow key extends the selection too |
| 🔍 | **Comparing two folders** | ✅ recursively, with the criteria serious tools use — and an explicit "direction undecided" state instead of guessing which side is newer | ➖ | ➖ compares by size and date only, and the choice is buried |
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

## 🆕 What's new in 3.5.0

### 🔍 Comparing two folders no longer gives up at the first folder it cannot read

**Fixed.** Comparing two folders used to fail completely the moment it met a single directory it was not allowed to read. Windows keeps a lot of those — `System Volume Information`, the recycle bin, anything another program is holding open — and a real folder tree is full of them, so in practice the comparison usually ended in an error instead of a result. Unreadable directories are now **skipped**, the count is shown in the summary, and the comparison carries on with everything else. Only a root directory that cannot be read is still an error, because that genuinely cannot be compared.

### ⚡ Comparing a large tree is about fifty times faster

**Improved.** Collecting the two sides was **93% of the time**, and it was slow for one reason: the metadata of every entry was looked up by rebuilding an absolute path and asking again, which on Windows costs about a hundred times more than asking the directory entry itself. The metadata now comes straight from the directory entry, and **four workers collect in parallel** — this is IO-bound work, and a single thread leaves the disk queue empty.

Measured on one machine, over the same ten thousand entries: **1.18 seconds before, 23 milliseconds after.** The measurement was run in **both orders**, so neither implementation could claim the advantage of a warm cache.

### 📊 The comparison now tells you how far along it is

**Added.** Walking a large tree takes a while, and the dialog used to show nothing but a spinner — there was no way to tell a working application from a stuck one. It now says **which side it is reading**, how many entries it has been through, and how far along the comparison itself is.

### 🧾 A huge result list no longer locks up the window

**Fixed.** The difference tree was flattened into every single row and rendered at once, so a tree of hundreds of thousands of entries meant hundreds of thousands of DOM nodes. The first **two thousand rows** appear immediately and the rest are released in batches on request, with the total always on screen so nothing is silently hidden. The summary counts are still computed over everything, and the sync plan is still computed by the back end from its own fresh comparison.

### 🗑️ Deleting a big folder tree finally shows what it is doing

**Fixed.** The delete progress bar was counting the **top-level entries you had selected**, so deleting one folder that held 250,000 files showed a single jump from 0% to 100% at the very end. It is now driven by the number of items **actually deleted**, with the freed space shown alongside it as a second measure. Cancelling is checked before **every file**, so it now stops within a fraction of a second instead of waiting for the current folder to finish. Before a large deletion starts, the tree is walked once to find out how many files, folders and bytes are involved — which gives the progress bar a real denominator and lets the application tell you the scale before the work begins.

**Improved: subfolders are deleted in parallel.** Deleting hundreds of thousands of small files from a mechanical disk is a seek-bound workload, and a single thread keeps the disk queue nearly empty while the head hunts for one file at a time. Up to four independent subtrees are now removed at once.

### 🩹 And the smaller fixes

- **The extension update check had never worked on some networks.** It asked `github.com` for a list of release tags, which times out on networks where that host is unreachable — and produced a burst of failed-request warnings on every launch. The check now uses the `api.github.com` endpoint, which is reachable on the same networks, with the old address kept as a fallback. The update check for extensions now actually succeeds.
- **The update check writes down what it found.** Each check records the installed version, the version the server reported, which source answered and whether an update was offered.
- **The installer writes an install log.** Which folder it installed into, whether an existing installation was found, which version was already there, and whether this run was a reinstall of the very same version — all of it is now on disk next to the two logs the installer already kept.
- **The checksum criterion no longer loads whole files into memory.** Enabling the content checksum used to read each file completely into memory; files are now read in fixed-size pieces, so memory use does not depend on file size.

---

## 🆕 What's new in 3.4.0

### 🔍 Compare two folders, then sync what you find

Split the navigator into two panes and a **Compare & Sync** button appears in the toolbar. It compares the two folders recursively and tells you what differs — what exists only on the left, what exists only on the right, what is newer on one side, and what differs in size or content. The result is a **tree**, so a subfolder that only exists on one side reads as a subtree instead of a wall of loose names.

The criteria are the ones serious tools use, applied in WinSCP's order: **modification time first, then file size, then content checksum**. Time wins — when the times differ, the size is not even looked at. Leave every criterion off and "the file exists on both sides" is the whole test, so only genuinely new files are reported.

### 🧭 When it cannot decide, it says so — and does nothing

Two files with the **same timestamp but different contents** are the hard case: the copy on the left is not older than the one on the right, yet they are not the same file either. Auto-syncing necessarily overwrites one of them, and which one depends on an implicit convention buried in the implementation.

Alpha File Manager marks those **"direction undecided"** and leaves them alone. They are listed separately so you can decide, but nothing is overwritten behind your back. The same applies to a folder on one side and a file with the same name on the other — there is no target to put anything into.

### 📋 The plan comes before the first byte moves

A preview lists every folder that would be created, every file that would be copied and every item that would be skipped. Only then does the sync start, in the background, with a progress bar you can cancel. Failed items are reported one by one.

### 🗑️ This feature never deletes anything

Syncing copies what is missing and updates what is older. Anything that exists only on the target side is **reported, not removed**. A mirror mode that also deletes is planned for a later release.

### 🌐 Map a network drive from the sidebar

The drive list at the bottom of the sidebar now ends with a **Map network drive** button — the same entry Windows Explorer has offered for years, and the same place you would actually look for it. Pick the share, pick a drive letter (or leave it empty and Windows picks one), and the drive shows up in the sidebar like any other.

### 🩹 And the smaller fixes

**Fixed: the drive letter reported after mapping a network drive was usually blank.** The application looked for the word "assigned" in the output of the Windows `net use` command. That word does not appear in what Windows actually prints, so the letter was often empty even though the drive had been mapped correctly. It now asks Windows directly which drive points at the share — which works regardless of the Windows language, the width of the output table, or whether the share name contains spaces.

---

## 🆕 What's new in 3.3.0

**3.3.0 is the first stable release of the 3.3 line.** It gathers four beta rounds
that were never published on their own — extension hardening, keyboard range
selection, background blend modes, and the long-press drag — into one build.

### 🫳 Drag a file into another program, without your window getting in the way

Press and hold a file or folder for a moment and a real Windows drag begins.
Carry it to WeChat, DingTalk, a browser — anything — and let go. The same gesture
still works inside Alpha File Manager, where dropping onto a folder moves the file
as before.

Three things had to be true for that to be usable:

- **Your window does not come to the front when you press.** Windows normally
  raises a window the instant you click it, which meant that reaching for a file
  in a background window immediately covered the program you were about to drop
  into. While you press and hold, Alpha File Manager stays where it is.
- **The program you drag over comes to the front.** While you are carrying the
  file, whichever application the pointer is over is brought forward. The
  conversation is on screen and you can see where the file is going to land.
- **Letting go does not take the foreground back.** When the drag finishes, the
  foreground stays where it is — the program you dropped into stays in front, and
  you can carry on with it.

An ordinary click is unchanged: click a file in a background window and it still
comes forward and still takes keyboard focus. Only the press-and-hold gesture
holds the window back, and moving the pointer even slightly while pressing turns
the gesture into an ordinary drag — so nothing changes for people who drag files
the way they always have.

### 🎨 The background effect, blended like Photoshop

The effect layer — the blurred, grained wash behind the app — can now be combined
with the interface using the familiar layer modes: Darken, Multiply, Color Burn,
Lighten, Screen, Color Dodge, Linear Dodge (Add), Overlay, Soft Light, Hard Light,
Difference, Exclusion, Color and Luminosity. The menu is grouped the way
Photoshop groups them, and a mode the WebView cannot actually draw is hidden
instead of offered and then ignored.

Every mode except Normal can also be told **what to mix with**. Leave it on
Interface and the effect blends with the window underneath, exactly as before.
Switch it to Fill color and the effect blends with a color you choose — eight
ready-made swatches, or a custom color of your own.

Moving the pointer down the menu previews the mode live on the page behind.
Leaving the menu puts your saved mode back, so browsing costs you nothing.

### ⌨️ Select a range with the keyboard

In a folder, the entry you start from becomes the **anchor**; every further
Shift+arrow extends the selection from that anchor, and Shift+arrow back towards
the anchor shrinks it again. A plain arrow key without Shift moves on to the next
entry and selects only that one, as it always did.

### 🔒 Extensions can no longer be steered onto your own network

When Alpha File Manager fetches an extension, it now checks the address it
**actually connects to** — not just the name that was written down. If that
address turns out to be on a private network, on this computer, or in a reserved
range, the download is refused and the refusal is reported. The check happens at
the moment of connecting, so it holds for the first request, for a retry, for a
fallback mirror, and for every redirect along the way.

Whether an extension may run a program is now decided by **its own description
file**, read from disk by the application, before the program is allowed to
start. Asking on behalf of a different extension, or asking without asking at all,
is refused. And the "sandbox" that only appeared to contain extension code is
gone, because it never really did: extension code already runs somewhere else
entirely — its own worker, or a sandboxed frame — and that is where the genuine
separation comes from.

### 🩹 And the smaller fixes

- **A network-drive file could be deleted permanently without asking.** The
  Recycle Bin only exists on a local disk. Previously the attempt simply failed
  and the file was removed for good — without a word. It now asks first, and only
  removes the file permanently if you say yes.
- **The window could come back with its bottom edge off the screen.** The frame
  is now restored in stages and then fitted to the work area, so it always comes
  back somewhere you can reach it.
- **Double-clicking the top bar did not maximize the window.** The blank part of
  the top bar was not a real drag region, so the double-click never reached the
  window manager. It is now.
- **The maximize button could leave the window in full screen and maximized at
  the same time.** The button now leaves full screen before it maximizes.
- **A long press could still bring the window to the front after the file list
  re-sorted.** Whether the pointer is over a draggable entry is now decided by
  where the pointer actually is, so a re-ordering list no longer changes the
  answer.
- **The colour picker in Appearance settings is no longer hidden.** Choosing
  "Blend with fill colour" now always reveals the palette and the custom colour
  input.

> **Coming from 3.2.12-beta?** The four beta rounds in between were never
> published on their own — this release contains all of them, plus the
> beta-to-stable step. There is nothing to install twice.

---

## 🆕 What's new in 3.2.11

**3.2.11 is the first build of the 3.2 line that can browse a remote server for
real.** Seven rounds of work landed in it: SFTP, FTP and FTPS connections that
actually list a remote directory, a folder tree that follows you into it, two
panes that can browse together, uploading, downloading and deleting — and a
long list of local fixes on top.

### 🌐 Remote servers, for real

Three protocols, one code path each: **SFTP**, **FTP** and **FTPS**. A saved
connection is no longer a bookmark — opening one lists the remote directory,
with its files, its sizes and its dates.

The first time you reach a machine you get a prompt showing its fingerprint
before anything is trusted. SSH public keys and X.509 certificates are stored as
separate records for the same host and port, so trusting one never implies the
other, and a certificate that changes is reported as a change rather than as a
network error. Every remembered host is listed under **Settings → Trusted
hosts**, and any of them can be revoked from there.

### 🌲 The tree follows you into the remote folder

The tree is not just a list of local drives any more. Switch to a remote pane
and it becomes the remote tree, rooted at the folder you configured for that
connection and labelled with the connection's name. It expands down to the
directory you are in, scrolls that row into view, and it follows the pane you
are actually working in — the other one cannot steal the selection while the
remote machine is still connecting.

### 🔗 Two panes, one browsing session

Give a connection a starting path and it opens there instead of at the remote
root. Turn on **synchronized browsing** and the two panes walk together:
entering `wp-content` on the local side opens `wp-content` on the remote side,
and going up a level takes the other pane with you.

### ⬆️⬇️ Upload, download — and the pane that refreshes itself

Send a file or a whole folder to the remote side, or pull one back. When the
transfer finishes, **the pane that received the files re-reads its own
directory**, so the new file is there immediately instead of after you press
refresh by hand. It refreshes itself, and only while it is still showing the
directory that received them.

### 🗑️ Deleting a remote file

A remote file used to have no delete entry at all. It has one now — one
**Delete**, not a "Move to recycle bin" that could not work, because a remote
server has no recycle bin. It says so before you commit, and if your account is
not allowed to delete, the server's refusal is reported as it is. The menu
entry is never hidden, because the front end cannot know whether you are the
owner, in the group, or "other" on the server.

### 🔐 Permissions from a list

Setting permissions on a remote file used to mean typing the octal digits,
where one wrong digit quietly widens or narrows someone else's access. It is a
list of the usual modes now, each shown in its `rwxr-xr-x` form. The mode the
file already has is always in the list, so opening the dialog and applying
without changing anything leaves it exactly as it was.

### 🏠 A new tab opens on your drives, and you can see how full they are

Clicking **+** used to open your home folder. It opens the **locations** page
now. Every drive card is filled in proportion to how much of it is used, in
three strengths, and the list view has a **Free space** column next to Size. On
the locations page the **modified** and **created** columns are gone — a drive
has neither, so they were a column of dashes saying nothing. Everywhere else
the free space column is gone instead, for exactly the same reason.

### 🧹 Small ones worth knowing

- The trash icon in the toolbar used to show a *tooltip* with two options you
  could not click. It is a real menu now, with the keyboard shortcut next to
  each entry.
- The list of saved connections is read at startup, before the window is shown.
  Before, the **Permissions** entry and the connection name in the tree could
  silently do nothing until you happened to open a screen that loaded it.
- The tree scrolls to the directory you are in, and keeps a single root instead
  of sprouting extra ones.

### 🧪 What is not in this build

- **Copying into a remote location is not implemented.** Upload and download
  are entries of their own and they work; cross-boundary copy / cut / paste,
  renaming a remote entry and creating a new one there are not there yet.
- **FTPS file contents are not encrypted yet.** The control channel is pinned,
  but the data channel still uses the server's default — plaintext contents in
  transit. `PBSZ` / `PROT P` is not sent.
- **FTPS has never been run against a real server.** SFTP has.

The full list — including exactly which parts were verified on an installed
build and which were covered by tests — is in the
[changelog](https://github.com/kizemo/alpha-file-manager/blob/main/CHANGELOG.md).

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