# Changelog

## [3.2.1-beta] - October 2026

**Summary:** Alpha File Manager can now be driven by AI assistants. Turn on the built-in MCP server in Settings → Experimental, pick a permission level, and assistants such as Claude Code or Minimax Code can read your drives, browse folders, and search files through a standard interface. This beta ships six read-only tools; nothing can be moved, renamed, or deleted.

### Connecting an AI assistant

The server listens on this computer only (127.0.0.1), on a port picked automatically when it starts. Settings → Experimental → MCP server shows the exact address and a ready-to-paste configuration snippet for each assistant, so there is nothing to type by hand.

Three safeguards are on by default and are not optional:

- **Bound to localhost.** Other devices on your network cannot reach it, even if they know the address.
- **A random access key.** A fresh four-part key is generated the first time you turn the server on. Requests without it are turned away.
- **Web requests from unknown sites are refused.** Only addresses served from this computer are accepted.

### Permission levels

Four levels, switchable at any time — a change takes effect on the very next tool call, without reconnecting:

| Level | What an assistant can do |
| --- | --- |
| Off (default) | Nothing. The server does not start at all. |
| Read-only | The six tools listed below. |
| Writable | Reserved for a later release. |
| Ask every time | Each call raises a confirmation in the app before it runs. |

### The six tools

- **List drives** — every drive on this computer, with names and free space.
- **List removable devices** — USB drives and network shares that can be connected or disconnected.
- **List a folder** — the contents of any folder you name. Large folders are cut off and say so.
- **Search files** — by name, across the indexed drive or inside one folder, with the same options as the search box in the app.
- **Folder size** — how much space a folder and its subfolders use, with the slowest case capped at two minutes.
- **Favorites** — the categories and paths you have starred in the app.

### Recording what was asked

Every call is written to a plain-text log next to the app's settings, including which tool, when, and whether it was allowed or turned down. Open it with any text editor if you want to review what an assistant has been doing.

### This is a beta

Only read operations are available. Anything that could change or remove your files is deliberately absent. The permission model and the configuration panel may still change before the final release, and the interface text may not be final in every language yet.

## [3.1.3] - October 2026

**Summary:** Directory search had two defects that made recursion look unimplemented; both are fixed. Search options now sit where you can watch results change, split view keeps directories on the left, and default search depth moves to 9 levels.

### Directory search: recursion genuinely was not working

The most important fix here, caused by **two independent problems** stacked on top of each other — fixing only one of them would still leave most directories unable to reach deep files.

- **The traversal cap counted the wrong thing.** The recursive walk had a "stop once we have seen enough" limit, but it counted **entries scanned**, not entries matched, and the limit was 20× the result limit (50 × 20 = 1000 by default). In a photo directory with 43,167 entries the walk therefore stopped at entry 1000 — indistinguishable from "current layer only". It now stops on match count, with the scan-volume safety valve widened separately, so the two no longer constrain each other.
- **Short queries were discarded by the score threshold.** After a filename substring matched, a score gate still applied, and three-character queries demanded 0.9: searching `095` against `20251009_0095_27.jpg` scores only 0.82, so it was **thrown away on the spot**. This was independent of directory size — small directories failed the same way. The score now only ranks results; it no longer gates them.

The previous release note claiming "directory search is now recursive" was therefore **not true at the time**. If you ran into "searching the current directory can't find files in subdirectories", this release is the fix for exactly that.

### Search options moved above the results

Show files / show directories / exact match / typo tolerance / result limit used to live in a button plus popover inside the filter box — but the point of adjusting options is to **watch the results change**, and hiding them behind a popover means opening and closing a floating layer on every adjustment. They are now permanently visible above the search results, so ticking one box updates the list below in view. They are not rendered when you are not searching, so they take up no room.

**Typo tolerance now actually does something** rather than being decoration: the recursive scan also computes a similarity score when the substring misses. With it off, a misspelled query still finds nothing; with it on, it matches — both directions are covered by tests.

Directory search and global search now **use the same set of options**, instead of each behaving its own way.

### Split view after search: directories on the left, search on the right

Opening global search previously pushed the search UI to the left and shoved directories to the right. It is now the other way round: **the left pane keeps the directory view and the right pane switches to search**, matching the "open containing directory" layout. In single-pane mode there is no left/right split, so nothing changes there.

### Default search depth 7 → 9 levels

Existing installations are migrated to 9 as well — changing only the default has no effect on people who already have 7 written in their local settings. **A depth you set yourself is never overwritten.**

### Right-click "Add to favorites" now asks for a category

Right-clicking a file or folder to favorite it now lets you pick a category first: an existing one, or one you create on the spot. **There is no text field** — just a choice. A new name that collides with an existing category lands in "Uncategorized" instead of interrupting the operation, and entries that are already favorited are skipped rather than asked again.

---

This release is search fixes and interaction polish: no new settings, nothing breaking.

## [3.1.2] - October 2026

**Summary:** Stops rows and cards growing for content that has no thumbnail, centres the list columns vertically, and delivers the folder tree, sidebar and favourites work.

### Rows And Cards Stop Growing For Content Without A Thumbnail

Changing the thumbnail size used to make every row taller, including rows that hold no thumbnail at all, so the extra height was pure whitespace.

- **Grid**: directory cards and non-media file cards now keep a **fixed height** across all four sizes. Non-media cards still change width, which decides how many fit per row;
- **List**: directory rows and non-media file rows likewise keep a fixed height, the default one. **Image and video rows still scale** with the setting, so thumbnails are never cropped;
- The **small** step moved up a notch so card content is no longer clipped.

All four steps now read their pixel and height values from **one table**, so the virtual scroller, the CSS variables and the rendered cards can no longer disagree with each other.

### List Columns Are Vertically Centred

**Item, Modified, Created, Type and Link status** were pinned to the top of the row while Name, Size, Tags and Link count sat centred. All of them are centred now.

This also fixed a stylesheet rule that **had never matched**: the link-status column's class name was spelled differently in the component and in the CSS, so that column was receiving no styling at all.

### Folder Tree, Sidebar And Favourites

- **The folder tree scrolls properly.** It used to overflow the panel with no way to scroll, hiding the last folders;
- **The sidebar panel groups things** — Frequent and History get their own sections, the redundant headings are gone, and clicking a section title jumps to the dashboard. Favourites and Tagged default to expanded, Frequent and History to collapsed;
- **Dashboard favourites are grouped by category and can be edited**, and the favourites area distinguishes categories, directories and files by icon. The sidebar mirrors the grouping.

### Open Containing Directory Splits The Window

Right-clicking a search result and choosing *Open containing directory in Alpha* used to open a new tab. It now splits the window: **the containing folder on the left, the search results on the right**, with the results list preserved.

### Fixed

- **A newly created favourite category no longer disappears after a restart.** The new top-level field was silently dropped by a field allow-list — the UI looked correct and the data was simply gone;
- **The home button opens This PC** instead of the user folder;
- **Search inside a folder now recurses** into subfolders;
- **Box selection follows the grid column width** at every thumbnail size;
- The settings **external-links menu is branded**, and the dead Discussions entry is removed.

## [3.1.1] - October 2026

**Summary:** Makes path following work when uploading a file, not just when saving one, stops dialogs from flickering, and fixes upgrades dying halfway through.

### Path Following Now Works When Uploading

With the Focus Sync extension enabled, a file dialog follows the folder you are browsing in Sigma FM. Until now that worked for **download and Save As** dialogs only. The picker a browser opens when you **upload** a file never moved.

Those two are not the same control. Edge and Chrome draw their Save As dialog themselves, but when they need you to pick an existing file they hand the job to Windows, which draws a different one. Both report themselves as the same kind of window, so the extension could not tell them apart and skipped the navigation step on the Windows-drawn ones. That step now runs on every dialog.

The path is also never written into the **file name** box any more. If the dialog has not put the keyboard into its address bar, the extension gives up instead of typing the path into the field where you are naming your file.

### Dialogs Stopped Flickering

A dialog could flash and re-sort dozens of times in a single minute. The extension was reading the name of the **first file in the list** instead of the folder the dialog was showing, so it believed the folder had changed and wrote the same path again, and again. One dialog went from 205 reads over four and a half minutes to a single read.

### Upgrades No Longer Die Halfway

Installing over an existing copy could stop part-way through with no error shown. The installer's own cleanup step was killing the installer itself. This is fixed, and an upgrade now runs to completion.

## [3.1.0] - October 2026

**Summary:** Makes the folder tree, the layout switch and thumbnail sizes behave the way people expect, and fixes the Focus Sync extension being unable to start at all.

### Folder Tree Context Menu

Right-clicking any node in the folder tree -- a drive, a folder or a file -- now offers six actions.

- **Copy / Cut / Paste / Rename**: all four work on the node you right-clicked. Previously the clipboard commands were wired to the wrong signatures, so they appeared in the menu but did nothing, and the interface showed the raw translation key instead of the action name;
- **Open containing folder**: reveals the file in Windows Explorer;
- **Properties**: opens the Windows property sheet for that node.

### Layout Is Per Folder

The layout switch moved from the window toolbar to the tab toolbar, next to the refresh button.

- **It now applies to the current folder only**, not globally. Two folders in two tabs can each keep their own layout, and switching tabs no longer resets the other tab's view;
- **Still reachable from the collapsed toolbar** via the overflow menu, for narrow windows;
- **Global scope moved to the settings page**, under the file view section, for anyone who does want one layout everywhere.

### Four Thumbnail Sizes

Thumbnail size is now selectable with four steps: **small 24 / medium 32 / large 48 / extra large 54 pixels**.

- Reachable from the tab toolbar, and from *View > File thumbnails > Thumbnail size* in the main menu;
- **The row height follows the thumbnail**, so a larger thumbnail no longer shifts the row out of alignment;
- Thumbnails are only generated once a file scrolls into the visible area, and a directory with 1000 images loads about 30 on the first screen and fills in the rest as you scroll.

### Drives Show Free Space

Under *Locations*, the drive row no longer shows only the entry count. It now shows `147.1 GB / 931.3 GB` -- free space and total capacity in one glance.

### Home And Settings

- **The home page title moved out of the theme image** and is now large enough to read, and clicking the theme image itself opens background management;
- **The settings page now links the official site and the source repository**, and the top of the page was rewritten: this build is *Alpha File Manager*, a file manager built on Sigma File Manager, not a generic one.

### Fixed

- **Focus Sync no longer gives up after a single rejected write.** Previously the sidecar marked a dialog as "already written" even when the write had been refused, so its own retry channel was permanently disabled and the dialog stayed out of sync until you closed and reopened it. A refused write is now treated as a refusal, and a failed write is never recorded as a success;
- **The Focus Sync extension can now load at all.** The extension code scanner treated a `self` occurrence inside an English *comment* as a direct `self` access, so the whole extension was rejected before its worker was created -- which made path sync look entirely broken. The scanner now strips comments, strings, template literals and regular expressions, and only inspects executable code;
- **Fixed Copy/Cut in the folder tree context menu**, which raised a signature error and never applied;
- **Fixed: installing over an existing version no longer kills the installer.** When an upgrade ran the previous version's uninstaller, that uninstaller's process-kill step treated the installer itself as a leftover process and terminated it mid-install. The install then failed with no readable error. Any process named `*setup.exe` or `uninstall.exe` is now excluded from that kill, regardless of where it sits in the process tree, while the application itself is still terminated so its executable is not held open;
- **The update dialog now matches the installed version.** `CHANGELOG.md` had not been updated since 2.2.0, so every release from 3.0.0 onward silently displayed the oldest entry in the file. The lookup now falls back to the English entry when a translation predates the running version, and a `verify-changelog` check fails the build if the changelog does not cover the current version;
- The settings intro text now uses the wording you supplied instead of the upstream placeholder.

## [3.0.2] - October 2026

**Summary:** Thumbnails reach the list view, the layout switch becomes a toolbar button, and thumbnail cache storage becomes visible and clearable.

### Thumbnails In The List View

- **Images and videos now show a thumbnail directly in the list view**, instead of only being visible in the grid view. Folders, documents and PDFs keep their type icons, so the row height stays stable and the list does not shift when thumbnails change. Thumbnails are generated only once a file scrolls into the visible area;
- The switch lives under *View > File thumbnails* in the main menu, and in *Appearance > File view* on the settings page.

### Layout Switch In The Toolbar

The layout switch moved out of the gear menu into the toolbar, next to the refresh button: icon+text tells you where you are, and icons only stay as a tooltip and as a success signal for "you clicked me to go somewhere".

- **Layout is per folder.** The switch applies to the current folder, not globally, so the same folder can look different in two tabs. The global option is available under *Appearance*;
- The switch is still in the gear menu for *only this folder*, and also reachable from the toolbar button when the toolbar is collapsed.

### Thumbnail Cache Is Visible And Clearable

- *Settings > Data storage > Thumbnail cache* now shows how many files the cache holds and how much space it uses, plus a one-click clear button. Image and video thumbnails share one cache directory, and after clearing they are regenerated on the next browse.

### Also Adjusted

- **Folders show by default.** The folder toggle existed but defaulted to off; it now defaults to on since the release, and can still be turned off under *Appearance > File thumbnails*;
- **Files sort before folders.** The *Folders first* option moved from the sort settings into the *View > File thumbnails* menu and now sits at the top of the list view's context menu, so it is easier to reach.

## [3.0.1] - October 2026

**Summary:** Fixes a data-loss bug in batch rename, found while testing 3.0.0.

### Batch Rename

- **Fixed: a rename could silently overwrite a file the rules left unchanged.** When a new name collided with another file in the same batch that no rule modified, that file was never moved aside and the rename landed on top of it. On Windows this happens with no error at all, so the original content was destroyed and could not be undone. Such a collision is now blocked in the preview, with the conflicting row highlighted;
- **Fixed: Title Case no longer rewrites your separators.** `27_gri_r0_c0` came out as `27 Gri R 0 C 0`, because underscores and hyphens were treated as word breaks and replaced with spaces. Original separators are preserved now, and digits are no longer treated as word boundaries;
- **Fixed: case-only changes are no longer reported as "unchanged".** Converting a selection to UPPERCASE or lowercase showed `0` items to change. A case-only rename is a real operation and is now counted and applied;
- **Fixed: rule options from the interface now take effect.** Checkboxes such as *Include extension* did nothing, because the field names sent to the backend did not match the ones it expected;
- **Numbering is easier to reach.** Numbering only supplies `{n}` for template rules and never renames on its own, which surprised people. A one-click *Add a template rule* button now sits next to it, pre-filled with `{n}-{name}`;

## [3.0.0] - October 2026

**Summary:** The first official release under the Alpha File Manager brand. Adds batch rename, makes drives identifiable in the narrow sidebar, and ships a substantially hardened dialog focus sync extension.

This release also renames the product from Sigma File Manager to **Alpha File Manager** throughout the interface, installer, and error messages. The underlying project lineage is unchanged; existing settings and layouts carry over.

### Batch Rename

Rename many files in one directory at once, with a live preview before anything touches disk.

- **Entry point**: select two or more items, right-click, and choose `Batch rename`. Single selection keeps using the existing `Rename` action;
- **Rules**: find and replace (optionally case-sensitive, optionally including the extension), case conversion (UPPERCASE, lowercase, Title Case, camelCase, snake_case, kebab-case), template names, numbering, and extension changes. Rules apply in the order shown and can be reordered;
- **Template variables**: `{name}`, `{ext}`, `{parent}`, `{size}`, `{date}`, `{n}`, with `{date:YYYYMMDD}` formatting and local time;
- **Live preview**: every entry shows its current and proposed name as you type. Entries that do not change are dimmed;
- **Conflict safety**: a new name that collides with a file outside the batch is blocked rather than overwritten; two entries that would end up with the same name are blocked and named; swap cycles such as `a -> b` and `b -> a` are resolved automatically through a two-pass rename with no user-visible temporary files;
- **Undo**: the last 10 batches are recorded and can be reverted, including batches that failed partway through. Reverting re-checks for collisions and refuses rather than overwriting later changes;

Numbering supplies the value for `{n}` and does not rename on its own; pair it with a Template rule.

### Drive Labels In The Sidebar

Disks in the narrow sidebar are now distinguishable at a glance.

- **Short label on the icon**: each drive icon carries a short label derived from its mount point — `C`, `D`, or the share name for network paths;
- **Why it matters**: the sidebar column is only 24px wide and every drive icon looks alike, so it was impossible to tell partitions apart;
- **Themed outline**: the label uses a 2px stroke in the sidebar's own background colour with `paint-order: stroke fill`, so the icon lines are knocked out behind the glyph. It stays legible in both light and dark themes;

Folder tree panels also start slightly wider, so directory names are readable without dragging the divider.

### Dialog Focus Sync

The Focus Sync extension (`kizemo.focus-sync`) reaches version 0.5.8 with a set of correctness fixes. It navigates Windows file dialogs — including Save As in other applications — to the folder currently focused in Alpha File Manager.

- **No more duplicate writes**: a dialog is no longer navigated twice about 900ms apart, which previously made the address bar visibly jump;
- **Window activation races**: Windows routes activation through a short-lived `ForegroundStaging` window. The extension now waits for the dialog to be foreground again (up to 500ms) instead of giving up and falling through to a path that never actually navigated;
- **Honest restore reporting**: restoring the filename field is now verified by reading the value back. A failed restore returns false instead of reporting success;
- **Cleaner diagnostics**: the trace ring is no longer saturated by health-check polling, so a lost push is distinguishable from a callback that never fired. Dead window handles are reaped on sight instead of accumulating;
- **Sidecar safety**: running the test suite no longer force-kills a sidecar you are actively using;

### Branding

- The application is now **Alpha File Manager** in the interface, the installer, window titles, and error messages;
- The install, upgrade, and uninstall paths are stable across 2.2.x and 3.0.0 — upgrading in place preserves your settings, layouts, and shortcuts;

## [2.2.0] - July 2026

**Summary:** System clipboard integration with other apps, box selection, linked split view, link handling, password-protected ZIP archives, native Properties on Windows, extension API expansions, Hebrew language support, and navigator polish.

- [New Features](#new-features)
  - [System Clipboard Integration](#system-clipboard-integration)
  - [Box Selection](#box-selection)
  - [Linked Split View](#linked-split-view)
  - [Link Handling](#link-handling)
  - [Native Properties Window](#native-properties-window)
  - [List View Column Resizing And Reordering](#list-view-column-resizing-and-reordering)
  - [Root Locations Address](#root-locations-address)
- [Extensions](#extensions)
  - [Extension APIs And Views](#extension-apis-and-views)
- [New Settings](#new-settings)
- [New Shortcuts](#new-shortcuts)
- [New Languages](#new-languages)
- [UX Improvements](#ux-improvements)
  - [Archive Extraction](#archive-extraction)
  - [Grid Sorting](#grid-sorting)
  - [Shell Extensions](#shell-extensions)
  - [Session Memory](#session-memory)
  - [Navigator Performance](#navigator-performance)
  - [Home Page And Context Menus](#home-page-and-context-menus)
- [UI Improvements](#ui-improvements)
- [Bug Fixes](#bug-fixes)

### New Features

#### System Clipboard Integration

Copy and paste files, folders, and images between Sigma File Manager and other apps through the system clipboard.

- **Cross-app file transfer**: copy or cut items in SFM and paste them into apps like File Explorer, or paste paths and files copied from other apps into the navigator with `Ctrl+V`;
- **Image paste**: paste images copied from browsers and other apps directly into a folder;
- **Conflict dialogs**: when pasted items already exist, choose `Rename` or `Merge`, and resolve individual file conflicts with Replace, Skip, Keep both, or Apply to all;
- **Clipboard toolbar**: optional toolbar preview for images and file paths copied in other apps;

Toolbar visibility can be controlled in `Settings > UI appearance > Clipboard`. Paste with `Ctrl+V` still works when the toolbar is hidden.

![system-clipboard](./public/changelog/assets/2.2.0/system-clipboard.webp)

#### Box Selection

Drag on empty space in the navigator to select multiple items with a selection box.

- **Modifiers**: hold `Ctrl` or `Shift` to add to the current selection; hold `Alt` to invert;
- **Easier targeting**: optionally increase list padding and grid gaps for more room to start a drag;

Enable in `Settings > General > File view > Enable box selection`.

![box-selection](./public/changelog/assets/2.2.0/box-selection.webp)

#### Linked Split View

New `Linked` split view mode for a simpler column-style workflow: clicking a folder in the first pane shows that folder's contents in the second pane.

The existing independent `Split` mode is unchanged. Choose the mode from the navigator options menu under `Split view mode`, or toggle split view with `Ctrl+S`.

The info panel icon was also updated so it is easier to tell apart from the split view icon.

![linked-split-view](./public/changelog/assets/2.2.0/linked-split-view.webp)

#### Link Handling

Create and inspect filesystem links from the navigator.

- **Create link**: create symbolic links, shortcuts, hard links, and junctions from the context menu (`Create link`);
- **Link columns**: optional list columns for Kind, Links, Link target, and Link status (`Valid`, `Broken`, `Unknown`, `Unsupported`);
- **Open behavior**: directory shortcuts and symlink folders navigate to their targets; other link targets open with the default app;

![link-handling](./public/changelog/assets/2.2.0/link-handling.webp)

#### Native Properties Window

On Windows, open the native system Properties dialog for selected items from the context menu, actions menu, `Alt+Enter`, or `Alt` + double-click.

![native-properties](./public/changelog/assets/2.2.0/native-properties.webp)

#### List View Column Resizing And Reordering

List view columns can be resized and reordered to match how you work.

- **Resize**: drag column edges to change widths;
- **Reorder and visibility**: manage order and visibility from the list header `Columns` popover;
- **Width options**: `Fill available width` and `Set minimum widths`;

![list-column-resize](./public/changelog/assets/2.2.0/list-column-resize.webp)

#### Root Locations Address

A root `Locations` address lists drives and virtual locations for faster switching.

- **Address bar**: go up from a drive root or open `Locations` from the address bar / address editor;
- **Favorites and tags**: Locations can be added to favorites and tagged like other directories;
- **Split view**: especially useful for switching drives between panes without leaving the navigator;

![root-locations-address](./public/changelog/assets/2.2.0/root-locations-address.webp)

### Extensions

#### Extension APIs And Views

Extensions gain more host capabilities and UI building blocks.

- **Local binaries**: configure extension dependencies with auto setup or manually chosen local binaries (`Extensions > Dependencies`);
- **HTTP requests**: extensions can make HTTP requests to hosts allowed by their manifest;
- **View control**: extensions can apply navigator layout and sorting preferences (with the view permission);
- **Clipboard API**: extensions can read and write the clipboard (with permission);
- **List-detail view**: new extension UI pattern with a searchable list and a detail pane;

![extension-local-binaries](./public/changelog/assets/2.2.0/extension-local-binaries.webp)

![extension-dependency-config](./public/changelog/assets/2.2.0/extension-dependency-config.webp)

![extension-list-detail](./public/changelog/assets/2.2.0/extension-list-detail.webp)

![extension-http-api](./public/changelog/assets/2.2.0/extension-http-api.webp)

### New Settings

- **Enable box selection**: drag empty space to multi-select;
  `Settings > General > File view > Enable box selection`
- **Increase file view gaps**: add list padding and larger grid gaps for easier targeting;
  `Settings > General > File view > Increase file view gaps`
- **Keep Quick View window in memory**: keep Quick View loaded so it opens instantly (uses about 200 MB);
  `Settings > General > Performance > Keep Quick View window in memory`
- **Keep Print window in memory**: keep the Print window loaded so it opens instantly (uses about 200 MB);
  `Settings > General > Performance > Keep Print window in memory`
- **Clipboard toolbar for external images**: show the clipboard toolbar for images copied in other apps;
  `Settings > UI appearance > Clipboard`
- **Clipboard toolbar for external paths**: show the clipboard toolbar for file paths copied in other apps;
  `Settings > UI appearance > Clipboard`
- **Dynamic info panel size**: let the info panel size adapt, or turn this off by resizing manually;
  `Settings > UI appearance > Info panel > Dynamic info panel size`
- **Show full-size image in info panel preview**: show full-resolution images in the info panel;
  `Settings > UI appearance > Info panel > Show full-size image in info panel preview`
- **Mute video preview by default**: mute info panel video previews while browsing;
  `Settings > UI appearance > Info panel > Mute video preview by default`
- **Automatically play video previews**: autoplay videos in the info panel when selected;
  `Settings > UI appearance > Info panel > Automatically play video previews`

### New Shortcuts

- **Native Properties** (`Alt+Enter`): open the native Properties window for selected items on Windows;

### New Languages

- **Hebrew** (`עברית`): full translation with right-to-left layout support (`Settings > General > Language`);

### UX Improvements

#### Archive Extraction

ZIP extraction now supports encrypted archives and non-UTF-8 file names.

- **Password-protected ZIP**: enter an archive password when extraction requires it;
- **File name encoding**: choose encoding in `Archive extraction options`, with auto-detect preferred and grouped regional encodings as fallbacks;

![archive-extraction-options](./public/changelog/assets/2.2.0/archive-extraction-options.webp)

![archive-extraction-encoding](./public/changelog/assets/2.2.0/archive-extraction-encoding.webp)

#### Grid Sorting

Grid layout now has its own sort controls in the navigator options menu.

- **Sort by**: Name, Items, Size, Modified, Created, Tags, Kind, Links, and Link status;
- **Direction**: ascending or descending, stored separately from list-view sorting;

![grid-sorting](./public/changelog/assets/2.2.0/grid-sorting.webp)

#### Shell Extensions

The context menu can load modern shell extension actions registered by other apps under `Shell extensions`.

![shell-extensions](./public/changelog/assets/2.2.0/shell-extensions.webp)

#### Session Memory

Scroll positions and active tabs are restored when you switch away from a page or pane and come back during the same session.

#### Navigator Performance

Browsing large folders and media is faster and uses less memory.

- **Cold loading**: faster first load when opening directories;
- **Icon loading**: custom and system icons appear with less delay;
- **List scrolling**: smoother list scrolling in large directories;
- **Media previews**: image, GIF, and video previews are more responsive and use less memory;
- **Indexing**: more stable global search indexing;

#### Home Page And Context Menus

- **Disconnect**: disconnect network or removable mounts from the context menu when supported;
- **Close all duplicates**: tab menu `Close all duplicates` now closes every duplicate path in the workspace, not only duplicates of the current tab;
- **Right-click clear**: right-clicking empty navigator background clears the current selection before opening the background menu;
- **Home actions**: home page context menus close after action clicks, `Open in new tab` opens the navigator, and new tabs scroll into view;
- **Window drag region**: on Linux-style title bars, the drag region extends across toolbar buttons for easier window moving;

![window-drag-region](./public/changelog/assets/2.2.0/window-drag-region.webp)

### UI Improvements

- **Active pane indicator**: clearer active pane marker in the status bar when split view is on;
- **Resizable info panel**: drag to resize the info panel width and the preview/details split;
- **Compact info panel**: denser property layout in the info panel;
- **Context menu actions**: `Edit card` is shown as an action button, with smaller action buttons overall;
- **Navigator styling**: improved adaptive layout, tab active-state styles in split view, and command palette extension view design;
- **RTL layout**: cleaner alignment for right-to-left languages;

![resizable-info-panel](./public/changelog/assets/2.2.0/resizable-info-panel.webp)

![compact-info-panel](./public/changelog/assets/2.2.0/compact-info-panel.webp)

### Bug Fixes

- **Type-to-search**: fixed quick search not activating on non-Latin keyboard layouts;
- **Directory loading**: fixed entries reordering after a directory finishes loading;
- **Custom icons**: fixed custom icons loading with a noticeable delay;
- **Grid cards**: fixed grid layout cards changing size while loading;
- **Grid scrollbar**: fixed the grid scrollbar hiding behind sticky headers;
- **Quick selection**: fixed quick file selection sometimes opening the file;
- **Terminal shortcut**: fixed `Alt+T` opening a terminal for the current directory instead of the selected entry;
- **Open files**: fixed opened files launching from the wrong working directory;
- **SMB shares**: fixed inability to open files on SMB shares;
- **WSL paths**: fixed WSL host UNC path handling on Windows, including `//wsl.localhost` as a virtual distro list;
- **Default file manager**: kept the setting available for direct Windows installations; the Microsoft Store version now shows it as unavailable;
- **AppImage (Linux)**: fixed `Could not create default EGL display: EGL_BAD_PARAMETER`;
- **Extension install (Linux)**: fixed install failures for multi-file dist extensions;
- **Extension details**: fixed overview page alignment styles;
- **Device wake**: fixed the app getting stuck in a loading state after device wake-up;
- **Update notifications**: fixed update notifications appearing for unreleased versions;
- **RTL**: fixed right-to-left layout issues;
- **Translations**: fixed missing and incorrect translation strings;

---

## [2.1.0] - May 2026

**Summary:** Navigator performance improvements, generated thumbnails, extension themes, printing, file previews, new shortcuts, address editor improvements, status center redesign, and tab/navigation polish.

- [New Features](#new-features)
  - [Printing](#printing)
  - [File Drop To Tabs](#file-drop-to-tabs)
  - [File Preview In Info Panel](#file-preview-in-info-panel)
  - [Navigator List Columns](#navigator-list-columns)
- [Extensions](#extensions)
  - [App Themes From Extensions](#app-themes-from-extensions)
  - [Icon Themes From Extensions](#icon-themes-from-extensions)
- [New Settings](#new-settings)
- [New Shortcuts](#new-shortcuts)
- [UX Improvements](#ux-improvements)
  - [Large Directory Performance](#large-directory-performance)
  - [Quick Search](#quick-search)
  - [Address Editor](#address-editor)
  - [Status Center](#status-center)
  - [Navigation And Tabs](#navigation-and-tabs)
  - [Shortcut Management](#shortcut-management)
- [UI Improvements](#ui-improvements)
- [Bug Fixes](#bug-fixes)

### New Features

#### Printing

Print selected files directly from the navigator using the context menu, actions menu, or `Ctrl+O`.

- **Supported formats**: images, PDF, text formats;
- **Quick exit**: close the print view with `Escape`;

![printing](./public/changelog/assets/2.1.0/printing.webp)

#### File Drop To Tabs

Drag files or directories onto tabs to move or copy them into another tab's directory.

- **Drop target tabs**: tabs become drop targets while dragging files in the navigator;
- **Hover activation**: hovering over a tab while dragging can switch to that tab before dropping;
- **Split tabs**: directory tab groups keep their normal drop behavior while preserving split-view tab structure;

![file-drop-to-tabs](./public/changelog/assets/2.1.0/file-drop-to-tabs.webp)

#### File Preview In Info Panel

The info panel can now preview all Quick View-supported file types, not just images and videos.

- **Media previews**: images use generated thumbnails, videos and audio include native controls, and PDFs render inline;
- **Text previews**: text files show a compact decoded preview with a safe size limit;
- **Fallbacks**: unsupported files and folders keep simple icon placeholders;

![info-panel-file-preview](./public/changelog/assets/2.1.0/info-panel-file-preview.webp)

#### Navigator List Columns

List view has more optional columns and better inline metadata control.

- **Created column**: show and sort by creation date;
- **Tags column**: show tags directly in list view and add, remove, or edit tags from the column;

![navigator-list-columns](./public/changelog/assets/2.1.0/navigator-list-columns.webp)

### Extensions

#### App Themes From Extensions

Extensions can now contribute full app color themes. Installed theme extensions appear in the theme selector.

#### Icon Themes From Extensions

Extensions can now contribute navigator icon themes for folders and files.

- **Separate choices**: choose folder and file icon themes independently in `Settings > UI appearance > Icon Theme`;
- **Built-in and extension themes**: use the built-in default/system icon themes or any enabled extension-provided theme;
- **Theme matching**: contributed themes can define icons by file extension, file name, folder name, and expanded folder state;

### New Settings

- **Bold active tab text**: make the active tab title bold (`Settings > Tabs > Tab appearance > Bold active tab text`);

![bold-active-tab-text-setting](./public/changelog/assets/2.1.0/bold-active-tab-text-setting.webp)

### New Shortcuts

- **Toggle split view** (`Ctrl+S`): show or hide split view in the navigator;
- **Restore closed tab** (`Ctrl+Shift+T`): restore the most recently closed tab group;
- **Create file / directory** (`Ctrl+Shift+M` / `Ctrl+Shift+N`): create a new file or directory in the current directory;
- **Print selected file** (`Ctrl+O`): print the selected file;
- **Open copied path** (`Ctrl+Shift+V`): open a valid path from the clipboard;
- **Switch pages** (`Alt+1` - `Alt+5`): switch between Home, Navigator, Dashboard, Settings, and Extensions;
- **Navigate directory history** (`Alt+Left` / `Alt+Right`): go back or forward in navigator history;
- **Navigate to parent directory** (`Alt+Up`): go to the parent directory;
- **Mouse history buttons** (`Mouse Button 4` / `Mouse Button 5`): navigate back and forward with mouse side buttons;

![create-file-directory-shortcuts](./public/changelog/assets/2.1.0/create-file-directory-shortcuts.webp)

![navigator-shortcuts](./public/changelog/assets/2.1.0/navigator-shortcuts.webp)

### UX Improvements

#### Large Directory Performance

Navigation, quick search, and media-heavy folders are more responsive and use less memory.

- **Generated thumbnails**: image and video thumbnails are generated at smaller sizes instead of loading full media into every file card;
- **Progressive images**: grid image cards can show a blurred low-resolution thumbnail before the final thumbnail is ready;
- **Thumbnail cancellation**: thumbnail generation can be cancelled when the folder or visible entries change;
- **Rendering performance**: large directory entries use more efficient rendering and Quick View uses generated thumbnails with a virtual list;

![low-res-image-thumbnail-preview](./public/changelog/assets/2.1.0/low-res-image-thumbnail-preview.webp)

#### Quick Search

Quick search now has 2 modes: passive and active:

- **Passive mode**: acitvates automatically when you start typing. It filters entries without focusing search input and doesn't prevent navigation. 
- **Active mode**: activates with `Ctrl+F`. It focuses search input and prevents navigation but allows more fine-grained control over entered query.

Other changes:

- **Type to filter**: typing alphanumeric keys now always starts quick search (passive mode) in the active pane;
- **Keyboard navigation**: the first matching item is auto-selected;
- **Popover design**: the quick search popover is more compact and avoids covering directory items;

![quick-search](./public/changelog/assets/2.1.0/quick-search.webp)

#### Address Editor

The address editor can now be used as a broader path launcher.

- **Files and directories**: open files as well as directories from the address editor;
- **Frequent paths**: switch to a mode focused on quickly opening frequently used paths;
- **Suggestions**: browse directory entries, exact matches, recent paths, tagged items, user folders, and system drives;
- **Keyboard actions**: navigate backward, forward, upward, and reveal an entry in its parent directory from the editor;

![address-editor](./public/changelog/assets/2.1.0/address-editor.webp)

#### Status Center

The status center is now a compact toolbar widget with clearer operation groups.

- **Active count**: the toolbar button expands into a pill that shows active operation count;
- **Operation groups**: active and completed operations are separated, with completed operations in a collapsible section;
- **Cancel all**: cancel active operations in parallel from the section header;
- **Job cards**: operation cards show clearer type and status labels such as `Copy | Success` or `Archive | Error`;
- **Clipboard recovery**: paste clears the clipboard as soon as a job is queued and restores it if the job fails;

![status-center](./public/changelog/assets/2.1.0/status-center.webp)

#### Navigation And Tabs

Navigator movement and tab behavior are more predictable.

- **Sidebar drives**: clicking a drive in the navigation sidebar opens it in the current tab;
- **Current directory**: the current address part is more pronounced, and its context menu opens from right click on the last address part;
- **Closed tabs**: restored tabs return to their previous position, preserve renamed paths, and redirect deleted paths to home;
- **Responsive layout**: toolbar navigation buttons collapse earlier, split-view address bars move to a second row in very narrow panes, and compact tabs keep consistent height;

![nav-sidebar-drive-current-tab](./public/changelog/assets/2.1.0/nav-sidebar-drive-current-tab.webp)

![current-directory-address-bar](./public/changelog/assets/2.1.0/current-directory-address-bar.webp)

#### Shortcut Management

Shortcut editing now handles conflicts and customization more clearly.

- **Multiple bindings**: assign multiple shortcuts to one action;
- **Unassigned shortcuts**: unassign shortcuts;
- **Conflict replacement**: replace a conflicting shortcut directly from the conflict prompt;
- **Shortcut list menu**: manage shortcuts from a context menu in the shortcuts list;

![shortcut-editor](./public/changelog/assets/2.1.0/shortcut-editor.webp)

#### Drag-and-drop

Allow to start outbound drag by switching apps. Now files can be dragged out with Alt+Tab (not only by cursor leaving window);

### UI Improvements

- **Selection ring**: improved navigator selection ring opacity, offset, pane-header styling, and keyboard focus behavior;
- **Tab bar**: improved tab bar styles and active tab readability;
- **Theme selection**: improved theme selection design;
- **Quick access**: refined quick access panel styling;
- **Splash screen**: added an app splash screen during startup;
- **Popover visibility**: improved visibility for translucent popover elements;
- **Tooltips**: added tooltips to more toolbar buttons;
- **Translations**: improved Japanese and Vietnamese language strings and cleaned up locale structure;

![selection-ring](./public/changelog/assets/2.1.0/selection-ring.webp)

![tab-bar-styles](./public/changelog/assets/2.1.0/tab-bar-styles.webp)

![narrow-window-layout](./public/changelog/assets/2.1.0/narrow-window-layout.webp)

### Bug Fixes

- **Mapped drives**: fixed mapped network drive dnd out is not working;
- **Keyboard scrolling**: fixed the issue with the first row hiding behind the sticky header;
- **Startup freeze**: fixed rare multi-minute startup freezes on Windows caused by slow synchronous system calls during startup and update checks;
- **Archive extraction**: preserved Unix file modes when extracting archives;
- **Extension HTTP**: restored permanent non-2xx response handling and made retry waits cancellable;
- **Command palette**: fixed the command palette toolbar button when its shortcut is customized;
- **Grid range selection**: fixed range selection in grid view selecting entries outside its scope;
- **Context menus**: fixed selected-item and current-directory context menus staying open after action clicks;
- **Shortcut registration**: fixed shortcut registration errors after window reload;
- **Theme application**: fixed selected themes not applying in all windows;
- **macOS moves**: fixed cross-volume move handling on macOS and enabled bundle targets;
- **Default file manager**: made Windows default file manager registry restore safer when enabling fails or when restoring previous system values;

![keyboard-scroll-floating-header](./public/changelog/assets/2.1.0/keyboard-scroll-floating-header.webp)

---

## [2.0.0-beta.3] - April 2026

**Summary:** Extensions system with marketplace, LAN file sharing, quick access menu, zip archives, WSL drives, tag editing, enhanced quick view and search, visual effects improvements, and many UX and stability improvements.

- [New Features](#new-features)
  - [Extensions System](#extensions-system)
  - [Default file manager](#default-file-manager)
  - [LAN Sharing](#lan-sharing)
  - [Quick Access Menu](#quick-access-menu)
  - [Zip Archives](#zip-archives)
  - [WSL Drives Detection](#wsl-drives-detection)
  - [Tag Editing](#tag-editing)
  - [In-App Updates](#in-app-updates)
  - [Copy Path](#copy-path)
  - [Close Duplicate Tabs](#close-duplicate-tabs)
  - [Home & Dashboard Context Menus](#home--dashboard-context-menus)
  - [Visual Effects Mix Blend Mode](#visual-effects-mix-blend-mode)
- [New Settings](#new-settings)
- [New Shortcuts](#new-shortcuts)
- [New Languages](#new-languages)
- [UX Improvements](#ux-improvements)
  - [Quick View Enhancements](#quick-view-enhancements)
  - [Quick Search Enhancements](#quick-search-enhancements)
  - [File Operations](#file-operations)
  - [Visual Effects](#visual-effects)
- [UI Improvements](#ui-improvements)
- [Bug Fixes](#bug-fixes)

### New Features

#### Extensions System

Full extension system with open marketplace.

- **Marketplace**: browse, install, and manage extensions from the marketplace;
- **Local installation**: you can install extensions from local folder;
- **Command palette**: new way to activate app and extension commands;
- **Capabilities**: extensions can register local and global shortcuts, context menu items, settings, whole pages, and commands;
- **Versioning**: you can install different versions of extensions and enable auto update;
- **Localization**: extensions can provide translations for different langauges;
- **Binary management**: extensions can use binaries (ffmpeg, deno, node, yt-dlp, 7z, and any other existing binary);
- **Sandboxed execution**: extensions run in isolated ESM sandboxes with granular permissions;

![extensions-1](./public/changelog/assets/beta-3/extensions.jpg)

#### Default file manager

You can now make SFM the default file manager on Windows (`Settings > Experimental`). When this setting is enabled, most system file actions will be routed to SFM:

- File Explorer app icon;
- `Ctrl+E` shortcut;
- Reveal file in folder;
- Show downloads (when you download a file in browser);
- Terminal commands: "start {path}", "code {path}", etc.
- And more;

Native system views like "Recycle Bin", "Control panel", and such deeply integrated programs are delegated back to native File Explorer. 

#### LAN Sharing

Share and stream files and directories over your local network directly from the app.

Access LAN sharing from the toolbar button in the navigator or from the context menu on any file or directory. When a share is active, a QR code and shareable URLs are displayed. Two modes are available:

- **Stream**: stream files and directories to any device on your network via a web browser;
- **FTP**: share files over FTP for direct access from other apps. You can both download and upload files from and to the computer from other device;

![lan-sharing](./public/changelog/assets/beta-3/lan-sharing.jpg)

#### Quick Access Menu

The "Dashboard" button in the sidebar now acts as a quick access menu. Hovering over it opens a panel showing your Favorites and Tagged items.

All items in the panel are real directory entries - you can drag and drop items in and out, open context menus with right click, and perform any standard file operations.

Can be disabled in `Settings > UI appearance > Open quick access panel on hover`.

![quick-access.jpg](./public/changelog/assets/beta-3/quick-access.jpg)

#### Zip Archives

Compress and extract zip archives directly from the file browser actions menu:

- **Extract**: extract a `.zip` file to the current directory or to a named folder;
- **Compress**: compress selected files and directories into a `.zip` archive;

![archiver.jpg](./public/changelog/assets/beta-3/archiver.jpg)

#### WSL Drives Detection

On Windows, the app now automatically detects installed WSL distributions and displays their drives in the navigator, allowing you to browse WSL file systems natively.

![wsl.jpg](./public/changelog/assets/beta-3/wsl.jpg)

#### Tag Editing

You can now edit tag names and colors. Open the tag selector on any file or directory to rename tags, change their color, or delete them.

![tag-editor.jpg](./public/changelog/assets/beta-3/tag-editor.jpg)

#### In-App Updates

You can now download and install updates directly from the update notification without leaving the app.

#### Copy Path

Added "Copy path" option to the file and directory context menu.

#### Close Duplicate Tabs

Added the ability to close duplicate tabs from the tab bar, removing all tabs that point to the same directory.

#### Home & Dashboard Context Menus

Items on the home page and dashboard now have full context menus, matching the functionality available in the navigator.

### New Settings

- **Show home media banner**: show or hide the home page media banner (`Settings > UI appearance > Home page media banner`);
- **Tooltip delay**: configure the delay before tooltips appear (`Settings > UI appearance > Tooltips`);
- **Relative time**: display recent timestamps in relative format, e.g. "5 min ago" (`Settings > General > Date / time`);
- **Date and time format**: configure month format, regional format, 12-hour clock, seconds, and milliseconds (`Settings > General > Date / time`);
- **Dialog backdrop blur**: set the blur intensity for dialog backdrops (`Settings > UI appearance > Style settings`);
- **Brightness and contrast filters**: adjust brightness and contrast style filters for the app UI (`Settings > UI appearance > Style settings`);
- **Overlay media brightness**: adjust brightness of the visual effects overlay media (`Settings > UI appearance > Visual effects`);
- **Visual Effects Mix Blend Mode**: adjust mix blend mode for visual effects, letting you choose how background media blends with the app UI (`Settings > UI appearance > Visual effects`);
- **Pause background video**: pause the home banner and background video when the app is idle or minimized (`Settings > UI appearance > Visual effects`);
- **Default file manager**: set Sigma File Manager as the default file explorer on Windows (`Settings > Experimental`);
- **Launch on system login**: automatically launch the app when you log into your system (`Settings > General > Startup behavior`);

### New Shortcuts

- **Copy current directory path** (`Ctrl+Shift+C`): copy the current directory path to clipboard;
- **Reload current directory** (`F5`): refresh the navigator file list;
- **Zoom in / out** (`Ctrl+=` / `Ctrl+-`): increase or decrease UI zoom;
- **Fullscreen** (`F11`): toggle full screen mode;

### New Languages

- **Hindi**;
- **Urdu**;

### UX Improvements

#### Quick View Enhancements

- **Media navigation**: navigate between files in the current directory without closing quick view;
- **Text file preview**: improved text file preview with proper encoding detection, inline editing, and parsed markdown rendering;

![quick-view.jpg](./public/changelog/assets/beta-3/quick-view.jpg)

#### Quick Search Enhancements

- **All properties**: search by any file property - name, size, item count, modified, created, accessed, path, or MIME type (e.g. `modified: today`, `mime: image`);
- **Size ranges**: filter by size using comparisons and ranges (e.g. `size: >=2mb`, `size: 1mb..10mb`);

![quick-search.jpg](./public/changelog/assets/beta-3/quick-search.jpg)

#### File Operations

- **Conflict resolution safety**: improved file safety within the conflict resolution modal to prevent accidental data loss;
- **Single-use paste**: copied items can only be pasted once, preventing accidental duplicate pastes;
- **Copy text**: allow copying UI text with `Ctrl+C` when no files are selected;

#### Visual Effects

- **Background manager**: added background manager to the settings page for centralized background customization;
- **Background effects reset**: added a reset button to background effects settings;

#### Other

- **App size reduction**: reduced app bundle size from 32 MB to 12 MB;
- **Global search**: display a "show settings" button in empty state and increased default search depth;
- **Windows shortcuts**: `.lnk` files now open their target in the navigator instead of launching externally;
- **Dashboard**: improved tagged section layout;
- **Address bar context menu**: added context menu to address bar items;
- **Navigator context menu**: show context menu when clicking empty area in the navigator;
- **Open in new tab**: open directories in a new tab with middle mouse click;
- **Tab scroll**: scroll newly added tabs into view automatically;
- **Menu focus**: menus no longer return focus to their trigger button when closed with a click outside;
- **Close search**: close global search with `Escape`;
- **Faster launch**: slightly improved app launch speed by preloading settings in Rust;
- **User directories**: added ability to add and remove user directories on the home page;
- **List limits**: decreased limits for frequent and history list entries to improve performance;

### UI Improvements

- **Toolbar icons**: unified toolbar icon colors across the app;
- **Card animations**: added stagger and fade-in effects to cards;
- **Light theme**: improved light theme colors and contrast;
- **Launch stability**: improved visual stability during app launch to reduce flickering;
- **Notifications**: improved notification design for better consistency;
- **Tab auto-scroll**: auto scroll the selected tab into view when opening the navigator page;
- **Root path labels**: normalized root path labels across tabs and info panel;
- **Translations**: improved translations across the app;

### Bug Fixes

- Fixed copying or moving many items freezing the UI; added file operation progress to the status center;
- Fixed deleting many items freezing the UI; added deletion progress to the status center;
- Fixed context menu in grid layout not opening for the current directory when another item already has a menu open;
- Fixed info panel not displaying all information for the current directory;
- Fixed app shortcuts being registered on the quick view window instead of only the main window;
- Fixed files dragged from web browsers not being handled;
- Fixed filenames from external URL drops not keeping valid segments;
- Fixed home banner being draggable;
- Fixed system icon cache not being keyed by file path, causing incorrect icons;
- Fixed inaccessible Windows root entries showing in the navigator;
- Fixed custom shortcuts being unidentified on some keyboard layouts;
- Fixed SSHFS connections on Linux;
- Fixed address bar creating duplicate history entries on breadcrumb click;
- Fixed global search results not responding to keyboard navigation;
- Fixed global search results not opening on click;
- Fixed global search status not syncing after incremental indexing;
- Fixed outbound file drag-and-drop not working in some applications;
- Fixed inconsistent shortcut badge design across the app;
- Fixed navigator column visibility in narrow panes;

---

## [2.0.0-beta.2] - February 2026

**Summary:** Global shortcuts, new settings, new features, improved file filtering, improved address bar, home banner improvements, and bug fixes.

### Global Shortcuts

You can now use keyboard shortcuts to interact with the app even when it's not in focus.

Added shortcuts:

- `Win+Shift+E` to show and focus the app window;

### New settings

Added setting to choose what happens when the last tab is closed.

![Setting close last tab](./public/changelog/assets/beta-2/setting-close-last-tab.png)

### New features

Added new early preview features:

- Network locations: allows you to connect a network location (SSHFS (SSH) / NFS / SMB / CIFS);
- [Linux] Drive mounting: allows you to unmount locations;

### File Filter

The file filter was improved:
- Now when you change directory, it clears and closes automatically;
- The "filter on type" feature activates in the selected pane, not the first one; 

### Address Bar

- Improved design and autocomplete logic;
- The path dividers are now dropdown menus that provide quick navigation to any parent directory;

![Divider menus](./public/changelog/assets/beta-2/divider-menus.png)

### Home Banner / Background effects

- Improved media banner editor design: 
  - Media banner options menu now opens to the bottom to avoid obscuring the view; 
  - You can now click outside to close the background position editor;
  - URL input moved above custom backgrounds; 
- Custom images/videos can be used in background visual effects;
- Removed some default media banner images;
- Added new banner image "Exile by Aleksey Hoffman";

### UX Improvements

- App restores previous window position on launch;
- The current tab can now be closed with shortcut `Ctrl+W` or middle mouse click;
- Increased file icon size in grid layout view;

### Bug Fixes

- Fixed moving files between tabs sometimes moving them to the wrong location;
- Fixed navigator sometimes showing wrong system icons for directories;
- Fixed multiple app and tray instances being created;
- Fixed shell extensions menu refetching data periodically which was forcing the list to scroll top all the time;

## [2.0.0-beta.1] - February 2026

**Summary:** Major usability and design improvements including keyboard navigation, new shortcuts, open in terminal, directory auto-refresh, drag and drop, and enhanced search and list views.

### Keyboard Navigation

Navigate files using the keyboard with full support for grid and list layouts and split view.

- Arrow keys for spatial navigation in grid view and sequential navigation in list view;
- Enter to open selected directory or file, Backspace to navigate back;
- Ctrl+Left / Ctrl+Right to switch focus between split view panes;
- Ctrl+T to open the current directory in a new tab;
- All navigation shortcuts are customizable in Settings > Shortcuts;

### Directory Auto-Refresh

The navigator view automatically refreshes when files are created, deleted, renamed, or modified in the current directory.

- File sizes update automatically when changed by external applications;
- Efficient file system watching with debouncing to avoid excessive refreshes;
- Smart diff-based updates only change affected items, preserving scroll position and selection;

### Drag and Drop

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/beta-1/drag-and-drop.mp4"></video>

You can now drag files and folders around to copy/move them with ease. Drag between panes, from or to search results lists, from or to external apps.

### Copy conflicts

Added modal window for easy copy/move conflict resolution.

### Auto Update

Added automatic checking for updates (can be controlled from settings).

### Home Banner Media Editor

Added editor for home page banner customization. You can now upload custom images and videos (both local and remote URL files are supported) 

### List View Enhancements

- Improved design and fixed little annoyances;
- Added column visibility customization: choose which columns to display;
- Added column sorting: click column headers to sort entries;
- Default navigator layout changed to list view;

### Global Search Improvements

- Updated layout and design with drag and drop support;
- Search is now available while drives are still being indexed;

### Open in Terminal

Open directories in your preferred terminal directly from the context menu.

- Automatic detection of installed terminals on Windows, macOS, and Linux;
- Windows Terminal shows all configured shell profiles with executable icons;
- Linux default terminal auto-detected and shown first;
- Includes normal and admin/elevated modes;
- Default shortcut: Alt+T;

### Localization

- Added Slovenian language (thanks to: @anderlli0053);

### UI / UX Improvements

- Added font selector: choose UI font from installed system fonts;
- Added "Create new" menu for quickly creating files or directories;
- Showing empty state view when navigating to empty directories;
- Status bar shows total items with hidden count when list is filtered;
- Newly created, copied, and moved items auto-scroll into view;
- Clipboard toolbar displayed once below panes instead of in each pane;
- Simplified rename modal design;
- Responsive toolbar icons that collapse into dropdown on small window sizes;
- Removed empty "Navigation" tab from settings;
- Renaming a directory now updates its path across all tabs, workspaces, favorites, tags, history, and frequent items;
- Deleting a file or directory now removes it from all stored lists and navigates affected tabs to home;
- Non-existent paths in favorites, tags, history, and frequent items are now auto-cleaned on startup;

### Bug Fixes

- Fixed global search indexing status not updating in real-time;
- Fixed split view pane not updating when its directory is deleted or renamed from the other pane;
- Fixed tabs loading with an error when their stored path no longer exists;
- Fixed system icons showing the same icon for all files of the same type instead of unique per-file icons;
- Fixed keyboard shortcuts not working in the second pane of split view;
- Fixed keyboard shortcuts stopping to work after page navigation;
- Fixed memory leak with filter keydown listeners not cleaned up on unmount;
- Linux: added support for default app retrieval in "open with" menu;

---

## [2.0.0-alpha.6] - January 2026

**Summary:** What's New window, Quick View, context menu enhancements, and new settings.

### What's New window

A changelog window that shows new features and improvements for each release.

- Automatically appears after updates (can be disabled);
- Browse through all releases;
- See detailed descriptions and screenshots for each feature;

### Quick View

Preview files without fully opening them using a lightweight preview window.

- Press `Space` or "Quick view" option in the context menu to quickly view files;
- Close instantly with `Space` or `Escape`.
- Supports images, videos, audio, text files, PDFs, and more;

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/alpha-6/quick-view.mp4"></video>

### Directory Size Calculation

- The size of directories is now auto calculated;
- You can see the total size of all directories, including all subdirectories and files, as soon as you open any directory;

![Open With](./public/changelog/assets/alpha-6/size.png)

### New Context Menu Options

#### Open With

- Choose which application to open a file with;
- Setup custom presets to open files in applications with flags;
- View all compatible applications for any file type;
- Set default applications for specific file types;

![Open With](./public/changelog/assets/alpha-6/open-with.png)

#### Shell Extensions

- Access Windows shell context menu items;
- Access third-party shell extensions (7-Zip, Git, etc.);

![Shell Extensions](./public/changelog/assets/alpha-6/shell-extensions.png)

### New Settings

#### Drive Detection

- Focuses the app when removable drives are connected (can be disabled);
- Control Windows Explorer auto-open behavior for removable drives;

#### Filter on Typing

Start typing anywhere in the navigator to instantly filter items in the current directory;

#### Settings Search Shortcut

New keyboard shortcut for quick access to settings search;

#### User Statistics Data

- Added statistics settings section;
- On dahsboard page you can see, navigate, clear history, favorites, and frequently used items;

### Search Improvements

Improved global search with a hybrid indexed + direct search system for more reliable and up-to-date results.

- Searches now consistently take less than 1 second (~1 TB fully filled drive), no matter where the files are on your drives; 
- When you search your "priority paths" (the ones that you open often), you get results instantly and it finds the files even if they were just created and weren't indexed yet.

#### Priority paths include: 
- User directories: Downloads, Documents, Desktop, Pictures, Videos, Music;
- Favorites;
- Recently opened;
- Frequently used;
- Tagged;

---

## [2.0.0-alpha.5] - January 2026

**Summary:** File operations, global search, and shortcut customization.

### Global Search

Powerful full-disk search that indexes and searches files across all your drives. Features fuzzy matching to find files even with typos, automatic periodic re-indexing, priority indexing for frequently used directories, and optional parallel scanning for faster indexing.

![Global Search](./public/changelog/assets/alpha-5/search.png)

### File Operations

Full file operation support with copy, move, and delete functionality including progress tracking. Also includes in-place file and folder renaming.

### Shortcut Editor

Customize all keyboard shortcuts in the app. View current bindings, detect conflicts, and reset to defaults.

### Navigator Enhancements

Added option to display native system icons for files and directories instead of minimalistic glyphs. Settings navigation tabs now stick to the page when scrolling.

---

## [2.0.0-alpha.4] - January 2026

**Summary:** Home page, visual effects, and user customization options.

### Home Page

A beautiful home page featuring an animated media banner, drive list, and quick access to common user directories like Documents, Downloads, Pictures, and more.

### Visual Effects

Customizable visual effects section in settings that adds blur, opacity, and noise effects to the app background. Supports different settings for each page.

### User Directories Editor

Customize your user directory cards with custom titles, icons, and paths. Personalize how your quick access directories appear on the home page.

### Banner Position Editor

Fine-tune the position of your home page banner backgrounds. Adjust zoom, horizontal and vertical positioning for the perfect look.

### Settings Improvements

- Settings search now works in any language, not just the current one;
- The app will restore the last visited settings tab on reload instead of opening the first one every time;

---

## [2.0.0-alpha.3] - December 2025

**Summary:** Navigator view with tabs, workspaces, and a new design system.

### Navigator View

The core file browsing experience with a modern tab system supporting workspaces, a new window toolbar design with integrated controls, and dual-pane navigation for efficient file management.

### Video Thumbnails

Added preview thumbnails for video files in the navigator.

### Design System Migration

Migrated the app from Vuetify to Sigma-UI for a more spacious, modern design with improved code quality.

---

## [2.0.0-alpha.1] - January 2024

**Summary:** Complete rewrite using modern technologies.

### Tauri Migration

Sigma File Manager v2 has been rebuilt from the ground up using Vue 3 Composition API, TypeScript, and Tauri v2. App installation size reduced from 153 MB to just 4 MB on Windows. Installed app size reduced from 419 MB to 12 MB.

### Resizable Panes

Added resizable panes feature which lets you split the navigator view in half and work with 2 directories side by side.

### Initial Features

Basic file navigation with directory listing, window management with minimize, maximize, and close controls, and an initial settings page structure.
