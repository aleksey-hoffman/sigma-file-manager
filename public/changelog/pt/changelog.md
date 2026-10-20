# Registro de alterações

## [3.2.11] - October 2026

**Summary:** Alpha File Manager can browse remote servers for real. SFTP, FTP and FTPS connections open a remote folder tree you can walk, the two panes can be told to browse together, files and folders can be uploaded and downloaded, and remote files can be deleted. On top of that, seven rounds of local work landed: a new tab opens on your drives, the drives page shows how full each drive is, columns that have nothing to say were dropped, the remote tree follows the pane you are working in, the delete options became a real menu, and the pane that receives a transfer now shows the result straight away.

### What changed

**Changed: a new tab opens on your drives.** Clicking + used to open your home folder, which is rarely where you want to be. It now opens the locations page -- your drive list -- which is also where you start from when you only want to go somewhere else. The setting still chooses between your drives, your home folder and a folder you pick; only the default moved. Anything you have already chosen yourself is left alone.

**Added: the drives page shows how full each drive is.** In the grid view every drive card is filled from the left in proportion to how much of it is used. The fill comes in three strengths rather than one continuous colour: a faint wash while there is room to spare, a stronger one past 60% used, and a light red, no louder than it needs to be, once less than 20% of the drive is left -- the point at which you start running out. Exactly 20% left is not counted as low. A drive whose size cannot be read is left plain instead of being drawn as an empty one, because "cannot tell" and "empty" are not the same thing.

**Added: a free space column in the list view.** The list view has a Free space column sitting to the right of Size, showing how much room is left on each drive. It is on by default, can be hidden and dragged into place like the other columns, and reads `--` for anything that is not a drive -- "this does not apply" and "there is no room left" are different things, and only one of them should look urgent.

**Changed: the locations page no longer shows a modified time column.** The locations page lists **drives**, and a drive has neither a modified time nor a creation time -- both columns are nothing but dashes, taking up room without saying anything. They are now left out of that page, and "Created" stays out of it even if you turn it on yourself. This is **only for that page**: the global column preferences are untouched, so a normal folder still shows the date columns.

**Changed: the free space column only appears on the locations page.** The free space column added in the previous round shows a dash for every row in **any other folder** -- there are no drive entries there -- so it takes up room without saying anything. It now appears only on the locations page, which really does list drives. Ordinary folders keep their date columns, and the two rules are complementary.

**Fixed: the size column rendered its title twice.** The header read "Size ⓘSize" -- the title was rendered twice, with the icon that explains how size is worked out in between. The cause was a mis-paired `v-if` / `v-else` in the template: the `v-else` on the last button paired with the `<span v-if>` above it rather than with the branch holding the icon, so the size column rendered both the button with the icon and the one without it. The three branches are now mutually exclusive: the title appears once, and the icon and the sort arrows are unchanged.

**Added: remote files can be deleted.** A remote file had no delete entry at all -- the row of quick-action icons was empty for it and there was no "Delete" in the right-click menu, so it could only be looked at. There is now a trash button in that row and a "Delete" entry in the right-click menu. There is no recycle bin on a remote server, so a remote entry gets one "Delete" rather than a "Move to recycle bin" that could not work. It asks once first, and says plainly that there is no recycle bin and the file cannot be recovered. A directory has to be empty first -- neither protocol deletes recursively, and the server refuses a directory that still has things in it; the message then says to empty the directory first. If your account is not allowed to delete, the menu entry is **still there** -- it is never hidden -- and the server's refusal is reported as it is. Whether the delete can happen depends on whether your account is the owner, in the group, or "other" on the server; the front end cannot work that out, and guessing wrong would grey out an entry that would have worked.

**Fixed: the pane you transfer to did not show what you just transferred.** After downloading a remote file to the local pane, or uploading a file or a folder to the remote pane, the pane that **received** the files kept showing what it had before -- the new file only turned up after you refreshed by hand. The receiving pane now reads its directory again as soon as the transfer finishes, so the file is there straight away. It is the pane that refreshes **itself**, and only when the directory it is showing is the one that received the files: if you moved that pane somewhere else in the meantime, it is left alone rather than being re-read into the wrong place. A transfer that was skipped because the target already had a file of that name changed nothing, so nothing is re-read for it.

**Fixed: the tree showed an expanded root with nothing under it.** Switching between a local and a remote pane rebuilds the tree's rows from scratch, and a rebuilt row starts out empty. The record of which directories had already been read, however, was never cleared to match -- so the second time you arrived at the remote tree, the tree believed it had already read that folder and never read it again. The row was expanded, the children were never filled in, and it looked like the remote directory could not be read at all. The record is now cleared whenever a row is rebuilt empty.

**Fixed: the tree did not scroll to the directory you were in.** Choosing a directory is supposed to bring it into view: the row is highlighted, and the tree scrolls to it. The scrolling half never ran. The element that was supposed to be scrolled was the one carrying the right-click menu trigger, and the menu library rebuilds that element in a way that discards the reference to it -- so the code that was meant to move it had nothing to move, and returned quietly instead of failing. The scrolling container is now a separate element the menu library leaves alone, the current directory is read before its position is worked out, and the tree scrolls by the smallest amount that brings the row into view. A row that is already in view is left alone, so a tree you have expanded by hand is not scrolled out from under you.

**Fixed: the tree could sprout extra roots of its own.** When the directory you were in sat more than one level below the tree's root, the folders in between were never read, so the directory you were in could not be found among the tree's rows and was added as a root of its own. The chain of folders between the root and your directory is now read in order, so the tree keeps a single root and your directory stays where it belongs.

**Fixed: the tree kept the local drive list after you moved to a remote pane.** The tree's roots and its highlighted row were being read from two different places. The roots came from the path saved for the tab, which is the local folder you started from; the highlighted row came from the path the pane is actually showing. Once you navigated the remote pane, the two disagreed: the tree still showed `Win (C:)`, `Program (D:)` and the rest, all folded, while the pane was somewhere else entirely. Both now come from the same place, so a remote pane gets a remote tree.

**Fixed: the non-focused pane could steal the tree's selection.** With the window split in two, both panes reported their current directory, and the tree took whichever report arrived last. The remote pane is slower to connect and to read, so its report arrived after the local pane's and replaced the selection with a remote path, while the roots stayed local. Nothing in the remote tree was reachable, so it expanded nothing. Only the pane you are actually working in can change the tree's selection now.

**Fixed: the tree scrolled before the row it was aiming at existed.** The scroll ran as soon as the selected path changed, but at that moment the tree was still the old one -- the remote row had not been drawn yet, so there was nothing to scroll to and the code returned without doing anything, silently. When you came back later and the row was there, nothing scrolled to it. The tree now watches where the selected row sits among the visible rows, and scrolls when that row appears or moves. Scrolling the tree by hand does not move the row, so your own scrolling is not undone.

**Fixed: two features disappeared depending on where you had been.** The list of saved remote connections was only read when the sidebar's remote panel or the settings page happened to open first. Open the navigator straight away and that list was still empty, which took two things with it: the **Permissions** entry in the right-click menu decides whether to show itself by asking which protocol the connection uses, and the tree root labels a remote connection by its name -- with no connection to look up, the menu entry vanished and the root fell back to showing the 32-character connection id instead of the connection's name. Neither reported an error; they just quietly stopped working until you visited a screen that happened to load the list. Connections are now read as part of startup, before the window is shown.

**Fixed: the two delete options could not be clicked.** After you select a file or a folder, the trash icon in the top right used to float out two lines of text -- "Move to recycle bin" and "Delete from drive" -- but they were only a *tooltip*, not a menu: they vanished as soon as the pointer moved away, and there was nothing to click. They are now a real dropdown, with one entry per operation and the keyboard shortcut shown next to each. The Del and Shift+Del shortcuts are unchanged.

**Changed: permissions are picked from a list.** Setting permissions asked you to type the octal digits yourself, where one wrong digit either widens or narrows someone else's access to the file. The field is now a list of the usual modes, each shown with its `rwxr-xr-x` form so you can tell 640 from 644 without leaving the list. Whichever mode the file already has is always in the list, even when it is not one of the usual ones -- opening the dialog and pressing Apply without changing anything leaves the mode exactly as it was. The owner / group / others breakdown below updates as you pick, as before.

**Changed: the remote tree is rooted at the folder you configured.** When you focus a remote pane, the tree now starts at that connection's configured directory rather than at the connection itself, so you see the project you set up rather than having to walk down through the parent folders. The root follows the connection's setting, so it does not move as you navigate -- which is what keeps the tree from rebuilding under you.

**Fixed: the root was labelled with the connection's identifier.** The name shown for a root row was decided once, when the row was built. The tree's root can be worked out immediately, but the label has to wait for the connection list, which loads asynchronously -- and the two do not change the tree's roots, so the row was never rebuilt and the name stayed on the path's last component. For a remote root that last component is the 32-character identifier. Root names are now recalculated once the labels arrive, and are also refreshed if you rename the connection.

**Fixed: three phantom roots appeared above the real one.** Selecting a directory expands the whole chain of ancestors, and that code does not know where the tree's roots are. With the root now being the configured folder, that chain included folders *above* it, and each one that was not already in the tree was added as a root of its own. A path that sits above a root is now left out -- the tree starts at its root, and what is above it is not part of the tree.

**Fixed: going up a level did not move the other pane.** The two panes were lined up by directory name, which works while you are going *down* into a folder that happens to share a name. Going *up* is the case where the names differ: the parent of a local `wp-content` is `E:\website_sbt`, the parent of a remote `wp_root\wp-content` is `…\wp_root`, and no amount of name matching reconciles those. Every time a synchronization has actually succeeded, the pair is now remembered, along with its parent; moving up then follows what was established rather than what is spelled alike. The correspondence is built from what really happened, not from configuration -- a pair is only remembered once the two panes have genuinely agreed on it.

**Fixed: the folder tree did not follow the panes, at all.** The watch that was supposed to mirror the focused pane's path into the folder tree had been referring to a value declared fifty-odd lines further down, with the watch set to run immediately. Vue evaluates such a getter straight away, which meant an error before initialisation was raised and then *swallowed* -- the page kept working, but the watch never recorded a single dependency and so never fired again. The tree has therefore not followed the panes since it was written, for local paths as much as remote ones. It is now declared after what it depends on, and it watches the path rather than the pane's identity, which does not change when the pane navigates on its own.

**Fixed: opening a connection dragged both panes off their configured directories.** Both panes mount and load on their own, in an order that is not fixed. Because synchronized browsing is a saved setting and was on, whichever pane finished first reported "I opened where I was told to" -- and synchronized browsing read that as a deliberate move, sending the other pane to the last segment of its own path. Neither pane ended up where the connection said it should be, and the local one landed on a directory that does not exist. Each pane's first report is now treated as settling rather than as a move, and synchronization only begins once both have settled.

**Fixed: a missing folder on the other side produced an error.** The two panes line up by name, and a matching name is common rather than guaranteed -- a WordPress image ships a stub `wp-content` inside its document root that nothing local corresponds to. The target is now checked before the other pane moves; if it is not there, that pane simply stays put and says nothing.

**Fixed: the remote folder tree never opened.** The ancestor chain walked straight past the connection root and on into paths the tree does not have, so nothing the tree was asked to expand actually existed. The chain now stops at the connection.

**Fixed: synchronized browsing never did anything.** The toggle was wired to a guard meant for the settings menu, one that latches off once you have opened that menu on a folder that has its own settings. Clicking the button did nothing and wrote nothing to disk. It now writes the setting directly.

**Synchronized browsing is now triggered by entering a directory, in either pane.** It used to fire on *selection* in the left pane only. Double-clicking into a folder cleared the selection before it could be read, and the right pane ignored you entirely. Whichever pane you move is the one that drives; the other follows.

**The button moved next to the left/right swap button,** where you asked for it. Both appear only while split view is on.

**The folder tree switches to the remote tree when focus is in a remote directory.** It already knew how to read over SSH -- the only thing missing was a root. The tree is now rooted at the connection, labelled with the connection name rather than its identifier.

**Fixed: opening a connection ignored the path you gave it.** Every connection has an "initial path" field, and it was saved, validated and shown back to you correctly -- but nothing ever read it. Opening a connection built its path from the connection id alone, so the remote pane always landed on the remote root and you had to walk down to your folder by hand every single time. It now opens on the configured path. An initial path of `/` behaves exactly as before.

**A "synchronized browsing" button in the navigator toolbar.** Linked browsing already worked -- select a single folder in the left pane and the right pane follows -- but the only way to reach it was a setting buried at the bottom of the navigator options menu, which is not somewhere you would look after connecting to a remote machine. There is now a button next to the split-view toggle, and it only appears while split view is on, because with a single pane there is nothing to synchronise with.

**Fixed: synchronized browsing dragged the remote pane back to the local machine.** When one pane showed a local folder and the other a remote one, following along handed the remote pane a local path, so the remote pane quietly turned into a local directory. The two panes now line up by folder name when they are on opposite sides, so entering `wp-content` on the local side opens `wp-content` on the remote side. Two local panes, or two remote panes, keep behaving exactly as they did.

**SFTP, FTP and FTPS all read remote directories for real.** Three protocols, one code path per protocol, each building a fresh connection per operation. The remote root of a saved connection is now a real folder listing rather than the local home directory.

**Host keys and certificates are pinned, and the first sighting asks.** The first time you reach a machine you get a prompt showing its fingerprint before anything is trusted -- never silent trust-on-first-use. SSH public keys and X.509 certificates are stored as separate records for the same host and port, so trusting one never implies the other. For FTPS the fingerprint is the certificate's SHA-256 in the same colon-hexadecimal form OpenSSL prints, so you can compare it against what your administrator gave you.

**A certificate that changes is reported as a change, not as a network failure.** A refused certificate reaches you as "you have not trusted this certificate yet" or "this certificate changed", naming the fingerprint you had trusted before, instead of a generic TLS handshake error that sends you off to debug the network.

**Settings gained a "Trusted hosts" section.** Every remembered host is listed with its kind and fingerprint, and each one can be revoked from there. Revoking an FTPS certificate leaves any SSH record for the same machine untouched.

**Fixed: FTPS could crash the app on first use.** Building the TLS client configuration needed a process-level crypto provider. This repository enables two rustls providers at once, which leaves rustls unable to pick one on its own, so the very first FTPS connection panicked before it could report anything. It now installs the provider it uses everywhere it needs one. Connections tested through the "Test connection" button were affected by the same thing.

### Known limits

**Copying into a remote location is not implemented.** The file operation engine still works entirely against the local filesystem, so a remote path handed to it is reported as missing even when it is there and can be browsed. Uploading and downloading are separate entries of their own and they work; what is missing is the everyday vocabulary around them -- copy, cut and paste across the boundary, renaming a remote entry, and creating a new file or folder there. There is no code path for those yet, and the entries that would use one are not offered in a remote location rather than being offered and then failing.

**FTPS file contents are not encrypted yet.** The control channel is protected by certificate pinning, but the data channel uses the server's default, which for explicit FTPS means plaintext file contents in transit. RFC 2228's `PBSZ` / `PROT P` is not sent. This is a recorded trade-off, not an oversight; when it is added it will refuse loudly rather than falling back to plaintext.

**FTPS has never been run against a real server.** It is covered end to end by a stub server that signs a real certificate and upgrades the connection on `AUTH TLS`, which catches the protocol sequencing but not any wording a real server happens to use. SFTP has been run against a real server; FTP and FTPS have not.

### How this release was verified

**The last round was checked on an installed build.** Everything in the 3.2.11 round was measured on a packaged release build rather than a development build: the new tab opening on the drives page, the drive cards showing their fill, the columns that were dropped and the ones kept, the remote file delete and the delete dropdown, and the pane that refreshes itself after a transfer. The last of those was measured against a real SFTP server -- uploading a file, uploading a folder, downloading a file -- and watching the receiving pane pick each one up. The tree work was checked on a packaged build as well: switching to a remote pane replaces the drive list with the remote tree, expands it down to the directory you are in, and scrolls that row into view.

**The earlier rounds were covered by unit tests and fault injection.** The remote browsing work (3.2.5), the connection's initial path and the synchronized-browsing button (3.2.6), the tree following the panes (3.2.7), the races when a connection opens (3.2.8), going up a level (3.2.9) and the remote tree's root (3.2.10) were each written with tests that fail when the behavior breaks, and each one was then checked by deliberately breaking it. They were not each verified one by one on an installed build, and this release does not claim that they were.

**One defect is still open.** Switching to another tab and back could leave the remote tree with nothing but its root. It could not be reproduced on an instrumented build: with a read counter on each row, the whole chain came back intact (`vol1` 16 folders, `@team` 5, `study_platform` 27, `wp_root` 28, `wp-content` 1). Coming back from the remote tab changes which pane is active, and the tree follows the pane you are actually in -- so what was on screen was the local tree, which is the right answer, not a broken remote one. That is one round without a failure, not a fix, and it is not claimed as one.

## [3.2.4] - October 2026

**Summary:** The first stable build of the 3.2 line. The address bar behaves the way Windows Explorer does, split view can swap its two panes, and the thumbnail size control survives a narrow window. This replaces 3.2.1-beta, which was the last published test build.

### The address bar now works the way you expect

Click the address bar and it turns into an edit box with the current path already selected — paste a new path and press Enter to go there. Previously the caret sat at the end, so pasting appended to the old path and produced a mashed-together string. Press End if you would rather extend the existing path, exactly as in Explorer.

Three defects are fixed together, and any one of them on its own is enough to make pasting a path unreliable:

- **A path was only treated as a folder if it ended with a slash.** Paste `D:\photos\2026` without the trailing slash and you got a single search result back instead of the folder. A bare word such as `photos` is still treated as a search term, so name-based lookup keeps working.
- **Enter no longer depends on the list catching up.** Right after you paste, the suggestion list needs a moment to refresh; pressing Enter during that window used to do nothing at all. It now acts on what is in the input box, immediately.
- **Arrow keys still win.** If you arrow down to a particular file and press Enter, that file is what opens — the typed path does not override your choice.

### The suggestion list reads as a small tree

The first row is the directory you are pointing at: flush left, in a heavier weight, and selected when the list opens, so pressing Enter goes straight into it. Subfolders and files sit one indent in, level with each other, connected by a vertical line with a short dash into each icon and closed off at the last row. Subfolders are listed before files, each sorted by name.

### Swap the two panes in split view

With two panes open, a swap button appears to the right of the search box in each pane's toolbar. Click it and the panes trade folders: whatever the left one was showing, the right one shows now, and vice versa. Each pane keeps its own width and its own place in the tab order — only the folder changes. The button is not there with a single pane, because there would be nothing to swap.

If both panes already show the same folder, nothing happens, and that is deliberate: swapping two identical folders is a no-op, and making the panes flicker through a change you cannot see is worse than doing nothing.

### The thumbnail size control survives a narrow window

On a narrow window the toolbar buttons collapse into a single "..." menu holding back, forward, up, locations, refresh, the list/grid toggle and the two create commands. The thumbnail size control had only ever been added to the wide-screen row of icons, so once the window narrowed below 600px there was no way to reach it at all — not hidden, simply absent.

It is now in both places, in the same order: after the list/grid button on the wide toolbar, and after the matching list/grid item in the "..." menu. Both open the same dialog.

### What this release is

3.2.4 is the first stable build of the 3.2 line. The MCP server introduced in 3.2.1-beta comes along unchanged, still read-only. Nothing in this release can move, rename or delete your files.

## [3.1.3] - October 2026

**Summary:** Directory search had two defects that made recursion look unimplemented; both are fixed. Search options now sit where you can watch results change, and split view keeps directories on the left.

### Directory search: recursion genuinely was not working

The most important fix here, caused by two independent problems stacked on top of each other:

- **The traversal cap counted the wrong thing.** The recursive walk had a "stop once we have seen enough" limit, but it counted **entries scanned**, not entries matched, and the limit was 20× the result limit (50 × 20 = 1000 by default). In a photo directory with 43,167 entries the walk therefore stopped at entry 1000 — indistinguishable from "current layer only". It now stops on match count, with the scan-volume safety valve widened separately.
- **Short queries were discarded by the score threshold.** After a filename substring matched, a score gate still applied, and three-character queries demanded 0.9: searching `095` against `20251009_0095_27.jpg` scores only 0.82, so it was **thrown away on the spot**. This was independent of directory size — small directories failed the same way. The score now only ranks results; it no longer gates them.

The previous release note claiming "directory search is now recursive" was therefore not true at the time.

### Search options moved above the results

Show files / show directories / exact match / typo tolerance / result limit used to live in a button plus popover inside the filter box — but the point of adjusting options is to **watch the results change**, and hiding them behind a popover means opening and closing a floating layer on every adjustment. They are now permanently visible above the search results, so ticking one box updates the list below in view.

**Typo tolerance now actually does something** rather than being decoration: the recursive scan also computes a similarity score when the substring misses. With it off, a misspelled query still finds nothing; with it on, it matches — both directions are covered by tests.

Directory search and global search now **use the same set of options**, instead of each behaving its own way.

### Split view after search: directories on the left, search on the right

Opening global search previously pushed the search UI to the left and shoved directories to the right. It is now the other way round: **the left pane keeps the directory view and the right pane switches to search**, matching the "open containing directory" layout.

### Default search depth 7 → 9 levels

Existing installations are migrated to 9 as well — changing only the default has no effect on people who already have 7 written in their local settings. A depth you set yourself is never overwritten.

### Also

- **Right-click "Add to favorites" now asks for a category**: pick an existing one or create one on the spot.

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

**Resumo:** Integração da área de transferência do sistema com outros aplicativos, seleção por caixa, visualização dividida vinculada, gerenciamento de links, arquivos ZIP protegidos por senha, propriedades nativas no Windows, novas APIs para extensões, suporte ao hebraico e melhorias na navegação.

- [Novos recursos](#novos-recursos)
  - [Integração da área de transferência do sistema](#integração-da-área-de-transferência-do-sistema)
  - [Seleção por caixa](#seleção-por-caixa)
  - [Visualização dividida vinculada](#visualização-dividida-vinculada)
  - [Manipulação de links](#manipulação-de-links)
  - [Janela de Propriedades nativa](#janela-de-propriedades-nativa)
  - [Redimensionamento e reordenação de colunas na lista](#redimensionamento-e-reordenação-de-colunas-na-lista)
  - [Endereço Locais na raiz](#endereço-locais-na-raiz)
- [Extensões](#extensões)
  - [APIs e visualizações de extensões](#apis-e-visualizações-de-extensões)
- [Novas configurações](#novas-configurações)
- [Novos atalhos](#novos-atalhos)
- [Novos idiomas](#novos-idiomas)
- [Melhorias de UX](#melhorias-de-ux)
  - [Extração de arquivos](#extração-de-arquivos)
  - [Ordenação em grade](#ordenação-em-grade)
  - [Extensões shell](#extensões-shell)
  - [Memória da sessão](#memória-da-sessão)
  - [Desempenho do navegador](#desempenho-do-navegador)
  - [Página inicial e menus de contexto](#página-inicial-e-menus-de-contexto)
- [Melhorias na interface](#melhorias-na-interface)
- [Correções de bugs](#correções-de-bugs)

### Novos recursos

#### Integração da área de transferência do sistema

Copie e cole arquivos, pastas e imagens entre o Sigma File Manager e outros aplicativos pela área de transferência do sistema.

- **Transferência entre aplicativos**: copie ou recorte itens no SFM e cole-os em aplicativos como o Explorador de Arquivos, ou cole no navegador caminhos e arquivos copiados de outros aplicativos com `Ctrl+V`;
- **Colar imagens**: cole diretamente em uma pasta as imagens copiadas de navegadores e outros aplicativos;
- **Resolução de conflitos**: quando os itens colados já existem, escolha `Renomear` ou `Mesclar` e resolva cada conflito com Substituir, Ignorar, Manter ambos ou Aplicar a todos;
- **Barra da área de transferência**: exibe opcionalmente uma prévia das imagens e dos caminhos de arquivos copiados de outros aplicativos;

A visibilidade da barra pode ser controlada em `Configurações > Aparência da interface > Área de transferência`. Colar com `Ctrl+V` continua funcionando quando a barra está oculta.

![system-clipboard](./public/changelog/assets/2.2.0/system-clipboard.webp)

#### Seleção por caixa

Arraste em um espaço vazio no navegador para selecionar vários itens com um retângulo de seleção.

- **Modificadores**: mantenha `Ctrl` ou `Shift` para adicionar à seleção atual; mantenha `Alt` para inverter;
- **Seleção mais fácil**: aumente opcionalmente o espaçamento das listas e grades para ter mais espaço onde iniciar o arraste;

Ative em `Configurações > Geral > Visualização de arquivos > Ativar seleção por caixa`.

![box-selection](./public/changelog/assets/2.2.0/box-selection.webp)

#### Visualização dividida vinculada

O novo modo de visualização dividida `Vinculada` oferece um fluxo de trabalho em colunas mais simples: ao clicar em uma pasta no primeiro painel, seu conteúdo aparece no segundo.

O modo independente `Dividida` permanece inalterado. Escolha o modo na opção `Modo de visualização dividida` do menu do navegador ou ative e desative a visualização dividida com `Ctrl+S`.

O ícone do painel de informações também foi atualizado para diferenciá-lo melhor do ícone da visualização dividida.

![linked-split-view](./public/changelog/assets/2.2.0/linked-split-view.webp)

#### Manipulação de links

Crie e inspecione links do sistema de arquivos a partir do navegador.

- **Criar link**: crie links simbólicos, atalhos, links físicos e pontos de junção pelo menu de contexto (`Criar link`);
- **Colunas de links**: colunas opcionais na visualização em lista para Tipo, Links, Destino do link e Status do link (`Válido`, `Quebrado`, `Desconhecido`, `Não suportado`);
- **Comportamento ao abrir**: atalhos de diretórios e pastas com links simbólicos levam aos respectivos destinos; os demais destinos abrem com o aplicativo padrão;

![link-handling](./public/changelog/assets/2.2.0/link-handling.webp)

#### Janela de Propriedades nativa

No Windows, abra a caixa de diálogo nativa de propriedades do sistema para os itens selecionados pelo menu de contexto, pelo menu de ações, com `Alt+Enter` ou com `Alt` + clique duplo.

![native-properties](./public/changelog/assets/2.2.0/native-properties.webp)

#### Redimensionamento e reordenação de colunas na lista

As colunas da visualização em lista podem ser redimensionadas e reordenadas conforme o seu fluxo de trabalho.

- **Redimensionar**: arraste as bordas das colunas para alterar as larguras;
- **Ordem e visibilidade**: gerencie a ordem e a visibilidade no menu `Colunas` do cabeçalho da lista;
- **Opções de largura**: `Preencher largura disponível` e `Definir larguras mínimas`;

![list-column-resize](./public/changelog/assets/2.2.0/list-column-resize.webp)

#### Endereço Locais na raiz

O endereço raiz `Locais` mostra as unidades e os locais virtuais para que você alterne entre eles com mais rapidez.

- **Barra de endereços**: suba um nível a partir da raiz de uma unidade ou abra `Locais` pela barra ou pelo editor de endereços;
- **Favoritos e etiquetas**: `Locais` pode ser adicionado aos favoritos e receber etiquetas como qualquer outro diretório;
- **Visualização dividida**: especialmente útil para trocar unidades entre painéis sem sair do navegador;

![root-locations-address](./public/changelog/assets/2.2.0/root-locations-address.webp)

### Extensões

#### APIs e visualizações de extensões

As extensões ganham mais recursos de integração com o aplicativo e novos componentes de interface.

- **Binários locais**: configure as dependências das extensões pela instalação automática ou selecionando manualmente os binários locais (`Extensões > Dependências`);
- **Requisições HTTP**: as extensões podem fazer requisições HTTP aos servidores permitidos pelo manifesto;
- **Controle da visualização**: as extensões podem aplicar preferências de disposição e ordenação no navegador (com a permissão de visualização);
- **API da área de transferência**: extensões podem ler e escrever na área de transferência (com permissão);
- **Visualização em lista e detalhes**: novo padrão de interface para extensões com uma lista pesquisável e um painel de detalhes;

![extension-local-binaries](./public/changelog/assets/2.2.0/extension-local-binaries.webp)

![extension-dependency-config](./public/changelog/assets/2.2.0/extension-dependency-config.webp)

![extension-list-detail](./public/changelog/assets/2.2.0/extension-list-detail.webp)

![extension-http-api](./public/changelog/assets/2.2.0/extension-http-api.webp)

### Novas configurações

- **Ativar seleção por caixa**: arraste em espaço vazio para seleção múltipla;
  `Configurações > Geral > Visualização de arquivos > Ativar seleção por caixa`
- **Aumentar espaços na visualização de arquivos**: adiciona mais espaço às listas e grades para facilitar a seleção;
  `Configurações > Geral > Visualização de arquivos > Aumentar espaços na visualização de arquivos`
- **Manter a janela de Visualização rápida na memória**: mantém a Visualização rápida carregada para abrir instantaneamente (usa cerca de 200 MB);
  `Configurações > Geral > Desempenho > Manter a janela de Visualização rápida na memória`
- **Manter a janela de impressão na memória**: mantém a janela de Impressão carregada para abrir instantaneamente (usa cerca de 200 MB);
  `Configurações > Geral > Desempenho > Manter a janela de impressão na memória`
- **Barra da área de transferência para imagens externas**: mostra a barra da área de transferência para imagens copiadas em outros aplicativos;
  `Configurações > Aparência da interface > Área de transferência`
- **Barra da área de transferência para caminhos externos**: mostra a barra da área de transferência para caminhos de arquivos copiados em outros aplicativos;
  `Configurações > Aparência da interface > Área de transferência`
- **Tamanho dinâmico do painel de informações**: adapta automaticamente o tamanho do painel; para desativar esta opção, redimensione-o manualmente;
  `Configurações > Aparência da interface > Painel de informações > Tamanho dinâmico do painel de informações`
- **Mostrar imagem em tamanho completo na pré-visualização do painel de informações**: mostra imagens em resolução completa no painel de informações;
  `Configurações > Aparência da interface > Painel de informações > Mostrar imagem em tamanho completo na pré-visualização do painel de informações`
- **Silenciar a pré-visualização de vídeo por padrão**: silencia as pré-visualizações de vídeo do painel de informações ao navegar;
  `Configurações > Aparência da interface > Painel de informações > Silenciar a pré-visualização de vídeo por padrão`
- **Reproduzir automaticamente as pré-visualizações de vídeo**: reproduz automaticamente vídeos no painel de informações quando selecionados;
  `Configurações > Aparência da interface > Painel de informações > Reproduzir automaticamente as pré-visualizações de vídeo`

### Novos atalhos

- **Propriedades nativas** (`Alt+Enter`): abre a janela nativa de Propriedades para os itens selecionados no Windows;

### Novos idiomas

- **Hebraico** (`עברית`): tradução completa com suporte a interfaces da direita para a esquerda (`Configurações > Geral > Idioma`);

### Melhorias de UX

#### Extração de arquivos

A extração de arquivos ZIP agora oferece suporte a arquivos criptografados e nomes de arquivo em codificações diferentes de UTF-8.

- **ZIP protegido por senha**: informe a senha do arquivo quando a extração exigir;
- **Codificação de nomes de arquivo**: escolha a codificação em `Opções de extração do arquivo`; a detecção automática tem prioridade e os grupos de codificações regionais ficam disponíveis como alternativas;

![archive-extraction-options](./public/changelog/assets/2.2.0/archive-extraction-options.webp)

![archive-extraction-encoding](./public/changelog/assets/2.2.0/archive-extraction-encoding.webp)

#### Ordenação em grade

A visualização em grade agora tem seus próprios controles de ordenação no menu de opções do navegador.

- **Ordenar por**: Nome, Itens, Tamanho, Modificado, Criado, Etiquetas, Tipo, Links e Status do link;
- **Direção**: crescente ou decrescente, armazenada separadamente da ordenação da lista;

![grid-sorting](./public/changelog/assets/2.2.0/grid-sorting.webp)

#### Extensões shell

O menu de contexto pode carregar em `Extensões shell` as ações modernas do shell registradas por outros aplicativos.

![shell-extensions](./public/changelog/assets/2.2.0/shell-extensions.webp)

#### Memória da sessão

As posições de rolagem e as abas ativas são restauradas quando você volta a uma página ou painel durante a mesma sessão.

#### Desempenho do navegador

A navegação por pastas grandes e conteúdos de mídia ficou mais rápida e consome menos memória.

- **Carregamento inicial**: os diretórios são exibidos mais rapidamente na primeira abertura;
- **Carregamento de ícones**: ícones personalizados e do sistema aparecem com menos atraso;
- **Rolagem da lista**: rolagem mais suave da lista em diretórios grandes;
- **Pré-visualizações de mídia**: pré-visualizações de imagem, GIF e vídeo são mais responsivas e usam menos memória;
- **Indexação**: indexação da pesquisa global mais estável;

#### Página inicial e menus de contexto

- **Desconectar**: desconecte unidades de rede ou removíveis pelo menu de contexto quando houver suporte do sistema;
- **Fechar todos os duplicados**: a opção `Fechar todos os duplicados` do menu de abas agora fecha todos os caminhos duplicados no espaço de trabalho, não apenas os duplicados da aba atual;
- **Desmarcar com o botão direito**: clicar com o botão direito em uma área vazia do navegador desfaz a seleção atual antes de abrir o menu de contexto do plano de fundo;
- **Ações da página inicial**: os menus de contexto da página inicial fecham após a escolha de uma ação, `Abrir em nova aba` abre o navegador e as novas abas rolam até ficarem visíveis;
- **Área de arraste da janela**: nas barras de título no estilo Linux, a área de arraste se estende sobre os botões da barra de ferramentas para facilitar o movimento da janela;

![window-drag-region](./public/changelog/assets/2.2.0/window-drag-region.webp)

### Melhorias na interface

- **Indicador do painel ativo**: indicação mais clara do painel ativo na barra de status quando a visualização dividida está ativa;
- **Painel de informações redimensionável**: arraste para redimensionar a largura do painel de informações e a divisão entre a pré-visualização e os detalhes;
- **Painel de informações compacto**: disposição mais compacta das propriedades no painel de informações;
- **Ações do menu de contexto**: `Editar cartão` é mostrado como botão de ação, com botões de ação menores no geral;
- **Estilo do navegador**: melhorias na disposição adaptativa, no estado ativo das abas na visualização dividida e na visualização de extensões da paleta de comandos;
- **Disposição RTL**: alinhamento mais limpo para idiomas da direita para a esquerda;

![resizable-info-panel](./public/changelog/assets/2.2.0/resizable-info-panel.webp)

![compact-info-panel](./public/changelog/assets/2.2.0/compact-info-panel.webp)

### Correções de bugs

- **Pesquisa por digitação**: corrigido um problema que impedia a ativação da pesquisa rápida em layouts de teclado não latinos;
- **Carregamento de diretórios**: corrigida a reordenação das entradas após o término do carregamento de um diretório;
- **Ícones personalizados**: eliminado o atraso perceptível no carregamento de ícones personalizados;
- **Cartões da grade**: corrigida a mudança de tamanho dos cartões durante o carregamento;
- **Barra de rolagem da grade**: corrigido um problema que deixava a barra de rolagem oculta atrás dos cabeçalhos fixos;
- **Seleção rápida**: corrigido um problema que às vezes abria o arquivo durante a seleção rápida;
- **Atalho do terminal**: corrigido um problema que fazia `Alt+T` abrir o terminal no diretório atual em vez da entrada selecionada;
- **Abrir arquivos**: corrigida a abertura de arquivos a partir do diretório de trabalho errado;
- **Compartilhamentos SMB**: corrigido um problema que impedia a abertura de arquivos em compartilhamentos SMB;
- **Caminhos WSL**: corrigido o tratamento dos caminhos UNC do host WSL no Windows, incluindo `//wsl.localhost` como lista virtual de distribuições;
- **Gerenciador de arquivos padrão**: a opção continua disponível em instalações diretas do Windows; a versão da Microsoft Store agora a mostra como indisponível;
- **AppImage (Linux)**: corrigido `Could not create default EGL display: EGL_BAD_PARAMETER`;
- **Instalação de extensões (Linux)**: corrigidas falhas ao instalar extensões distribuídas em vários arquivos;
- **Detalhes da extensão**: corrigido o alinhamento da página de visão geral;
- **Retomada do dispositivo**: corrigido um problema que deixava o aplicativo preso no estado de carregamento após a retomada do dispositivo;
- **Notificações de atualização**: corrigidas as notificações de versões ainda não lançadas;
- **RTL**: corrigidos vários problemas na disposição da direita para a esquerda;
- **Traduções**: corrigidos textos de tradução ausentes ou incorretos;

---

## [2.1.0] - May 2026

**Resumo:** Melhorias de desempenho do navegador, geração de miniaturas, temas fornecidos por extensões, impressão, pré-visualizações de arquivos, novos atalhos, melhorias no editor de endereços, reformulação do centro de status e aperfeiçoamento das abas e da navegação.

- [Novos recursos](#novos-recursos)
  - [Impressão](#impressão)
  - [Soltar arquivos nas abas](#soltar-arquivos-nas-abas)
  - [Pré-visualização de arquivos no painel de informações](#pré-visualização-de-arquivos-no-painel-de-informações)
  - [Colunas da lista do navegador](#colunas-da-lista-do-navegador)
- [Extensões](#extensões)
  - [Temas do app a partir de extensões](#temas-do-app-a-partir-de-extensões)
  - [Temas de ícones a partir de extensões](#temas-de-ícones-a-partir-de-extensões)
- [Novas configurações](#novas-configurações)
- [Novos atalhos](#novos-atalhos)
- [Melhorias de UX](#melhorias-de-ux)
  - [Desempenho em diretórios grandes](#desempenho-em-diretórios-grandes)
  - [Pesquisa rápida](#pesquisa-rápida)
  - [Editor de endereço](#editor-de-endereço)
  - [Centro de status](#centro-de-status)
  - [Navegação e abas](#navegação-e-abas)
  - [Gerenciamento de atalhos](#gerenciamento-de-atalhos)
- [Melhorias na interface](#melhorias-na-interface)
- [Correções de bugs](#correções-de-bugs)

### Novos recursos

#### Impressão

Imprima arquivos selecionados diretamente do navegador pelo menu de contexto, menu de ações ou `Ctrl+O`.

- **Formatos suportados**: imagens, PDF, formatos de texto;
- **Saída rápida**: feche a visualização de impressão com `Escape`;

![printing](./public/changelog/assets/2.1.0/printing.webp)

#### Soltar arquivos nas abas

Arraste arquivos ou pastas para as abas para movê-los ou copiá-los para o diretório de outra aba.

- **Abas como destino**: as abas se tornam destinos de soltar ao arrastar arquivos no navegador;
- **Ativação ao passar o mouse**: mantenha o ponteiro sobre uma aba durante o arraste para ativá-la antes de soltar os itens;
- **Abas divididas**: os grupos de abas de diretórios mantêm o comportamento normal como destino sem alterar a estrutura da visualização dividida;

![file-drop-to-tabs](./public/changelog/assets/2.1.0/file-drop-to-tabs.webp)

#### Pré-visualização de arquivos no painel de informações

O painel de informações agora pode mostrar pré-visualizações de todos os tipos de arquivo compatíveis com a Visualização rápida, não apenas de imagens e vídeos.

- **Pré-visualizações de mídia**: as imagens usam miniaturas geradas, os vídeos e áudios incluem controles nativos, e os PDFs são exibidos diretamente no painel;
- **Pré-visualizações de texto**: os arquivos de texto mostram uma pré-visualização compacta do texto decodificado, com um limite seguro de tamanho;
- **Alternativas**: os arquivos e pastas não compatíveis continuam exibindo ícones genéricos;

![info-panel-file-preview](./public/changelog/assets/2.1.0/info-panel-file-preview.webp)

#### Colunas da lista do navegador

A visualização em lista oferece mais colunas opcionais e um controle mais preciso dos metadados exibidos.

- **Coluna Criado**: mostrar e ordenar por data de criação;
- **Coluna Etiquetas**: mostrar etiquetas diretamente na lista e adicionar, remover ou editar etiquetas pela coluna;

![navigator-list-columns](./public/changelog/assets/2.1.0/navigator-list-columns.webp)

### Extensões

#### Temas do app a partir de extensões

As extensões agora podem fornecer temas de cores completos para o aplicativo. Os temas instalados por extensões aparecem no seletor de temas.

#### Temas de ícones a partir de extensões

As extensões agora podem fornecer temas de ícones do navegador para pastas e arquivos.

- **Escolhas separadas**: escolha temas de ícones de pastas e arquivos independentemente em `Configurações > Aparência da interface > Tema de ícones`;
- **Temas integrados e de extensões**: use os temas de ícones padrão do sistema ou qualquer tema fornecido por uma extensão ativada;
- **Correspondência de temas**: os temas fornecidos podem definir ícones conforme a extensão ou o nome do arquivo, o nome da pasta e seu estado expandido;

### Novas configurações

- **Texto da aba ativa em negrito**: deixa o título da aba ativa em negrito (`Configurações > Abas > Aparência das abas > Texto da aba ativa em negrito`);

![bold-active-tab-text-setting](./public/changelog/assets/2.1.0/bold-active-tab-text-setting.webp)

### Novos atalhos

- **Alternar visualização dividida** (`Ctrl+S`): mostrar ou ocultar a visualização dividida no navegador;
- **Restaurar aba fechada** (`Ctrl+Shift+T`): restaurar o grupo de abas fechado mais recentemente;
- **Criar arquivo / diretório** (`Ctrl+Shift+M` / `Ctrl+Shift+N`): criar um novo arquivo ou diretório no diretório atual;
- **Imprimir arquivo selecionado** (`Ctrl+O`): imprimir o arquivo selecionado;
- **Abrir caminho copiado** (`Ctrl+Shift+V`): abrir um caminho válido da área de transferência;
- **Trocar páginas** (`Alt+1` - `Alt+5`): alternar entre Início, Navegador, Painel, Configurações e Extensões;
- **Navegar no histórico do diretório** (`Alt+Left` / `Alt+Right`): voltar ou avançar no histórico do navegador;
- **Navegar para o diretório pai** (`Alt+Up`): ir para o diretório pai;
- **Botões de histórico do mouse** (`Mouse Button 4` / `Mouse Button 5`): navegar para trás e para frente com os botões laterais do mouse;

![create-file-directory-shortcuts](./public/changelog/assets/2.1.0/create-file-directory-shortcuts.webp)

![navigator-shortcuts](./public/changelog/assets/2.1.0/navigator-shortcuts.webp)

### Melhorias de UX

#### Desempenho em diretórios grandes

A navegação, a pesquisa rápida e as pastas com muitos arquivos de mídia ficam mais responsivas e consomem menos memória.

- **Miniaturas geradas**: as miniaturas de imagens e vídeos são geradas em tamanhos menores, em vez de carregar o arquivo de mídia completo em cada cartão;
- **Imagens progressivas**: os cartões de imagem na grade podem mostrar uma miniatura borrada de baixa resolução antes que a miniatura final esteja pronta;
- **Cancelamento de miniaturas**: a geração de miniaturas pode ser cancelada quando a pasta ou as entradas visíveis mudam;
- **Desempenho de renderização**: entradas de diretórios grandes usam renderização mais eficiente e a Visualização rápida usa miniaturas geradas com uma lista virtual;

![low-res-image-thumbnail-preview](./public/changelog/assets/2.1.0/low-res-image-thumbnail-preview.webp)

#### Pesquisa rápida

A pesquisa rápida agora tem dois modos: passivo e ativo:

- **Modo passivo**: é ativado automaticamente quando você começa a digitar, filtra as entradas sem mover o foco para o campo de pesquisa e permite continuar navegando;
- **Modo ativo**: é ativado com `Ctrl+F`, move o foco para o campo de pesquisa e impede a navegação, mas permite controlar com mais precisão o texto digitado;

Outras alterações:

- **Digitar para filtrar**: digitar teclas alfanuméricas agora sempre inicia a pesquisa rápida (modo passivo) no painel ativo;
- **Navegação por teclado**: o primeiro item correspondente é selecionado automaticamente;
- **Painel flutuante**: o painel de pesquisa rápida está mais compacto e não encobre os itens do diretório;

![quick-search](./public/changelog/assets/2.1.0/quick-search.webp)

#### Editor de endereço

O editor de endereços agora funciona como uma ferramenta mais versátil para abrir caminhos.

- **Arquivos e diretórios**: abra arquivos e também diretórios pelo editor de endereços;
- **Caminhos frequentes**: mude para um modo voltado à abertura rápida dos caminhos usados com frequência;
- **Sugestões**: navegue por entradas de diretório, correspondências exatas, caminhos recentes, itens etiquetados, pastas do usuário e unidades do sistema;
- **Ações do teclado**: navegue para trás, para a frente ou para o diretório pai e mostre uma entrada na pasta que a contém;

![address-editor](./public/changelog/assets/2.1.0/address-editor.webp)

#### Centro de status

O centro de status agora é um controle compacto da barra de ferramentas que organiza as operações com mais clareza.

- **Contagem de operações ativas**: o botão da barra de ferramentas se expande para mostrar quantas operações estão em andamento;
- **Grupos de operações**: operações ativas e concluídas são separadas, com as concluídas em uma seção recolhível;
- **Cancelar tudo**: cancele operações ativas em paralelo pelo cabeçalho da seção;
- **Cartões de operações**: os cartões mostram com mais clareza o tipo e o status, como `Copiar | Sucesso` ou `Arquivo | Erro`;
- **Recuperação da área de transferência**: ao colar, a área de transferência é limpa assim que a operação entra na fila e restaurada se ela falhar;

![status-center](./public/changelog/assets/2.1.0/status-center.webp)

#### Navegação e abas

A navegação e o comportamento das abas ficam mais previsíveis.

- **Unidades da barra lateral**: clicar em uma unidade na barra lateral de navegação a abre na aba atual;
- **Diretório atual**: o segmento do endereço que corresponde ao diretório atual fica mais destacado e permite abrir o menu de contexto com o botão direito;
- **Abas fechadas**: as abas restauradas voltam à posição anterior, preservam caminhos renomeados e redirecionam para a página inicial se o caminho tiver sido excluído;
- **Disposição responsiva**: os botões de navegação da barra de ferramentas recolhem mais cedo, as barras de endereço da visualização dividida passam para uma segunda linha em painéis muito estreitos e as abas compactas mantêm uma altura consistente;

![nav-sidebar-drive-current-tab](./public/changelog/assets/2.1.0/nav-sidebar-drive-current-tab.webp)

![current-directory-address-bar](./public/changelog/assets/2.1.0/current-directory-address-bar.webp)

#### Gerenciamento de atalhos

O editor de atalhos agora permite gerenciar conflitos e personalizações com mais clareza.

- **Vários atalhos**: atribua vários atalhos a uma ação;
- **Atalhos não atribuídos**: remova a atribuição de atalhos;
- **Substituição em caso de conflito**: substitua um atalho em conflito diretamente no aviso;
- **Menu da lista de atalhos**: gerencie atalhos por um menu de contexto na lista de atalhos;

![shortcut-editor](./public/changelog/assets/2.1.0/shortcut-editor.webp)

#### Arrastar e soltar

Agora é possível iniciar o arraste para outro aplicativo mesmo alternando entre janelas com `Alt+Tab`; não é mais necessário mover o ponteiro para fora da janela.

### Melhorias na interface

- **Anel de seleção**: melhoradas a opacidade e a distância do anel de seleção, o estilo do cabeçalho do painel e a indicação de foco pelo teclado;
- **Barra de abas**: melhorados os estilos da barra de abas e a legibilidade da aba ativa;
- **Seleção de tema**: melhorada a aparência do seletor de temas;
- **Acesso rápido**: refinado o estilo do painel de acesso rápido;
- **Tela de inicialização**: adicionada uma tela de abertura durante a inicialização do aplicativo;
- **Visibilidade dos painéis flutuantes**: melhorada a visibilidade dos elementos translúcidos;
- **Dicas**: adicionadas dicas a mais botões da barra de ferramentas;
- **Traduções**: melhorados os textos em japonês e vietnamita e reorganizada a estrutura dos idiomas;

![selection-ring](./public/changelog/assets/2.1.0/selection-ring.webp)

![tab-bar-styles](./public/changelog/assets/2.1.0/tab-bar-styles.webp)

![narrow-window-layout](./public/changelog/assets/2.1.0/narrow-window-layout.webp)

### Correções de bugs

- **Unidades mapeadas**: corrigido o arraste de arquivos de unidades de rede mapeadas para outros aplicativos;
- **Rolagem por teclado**: corrigido um problema que deixava a primeira linha oculta atrás do cabeçalho fixo;
- **Congelamento na inicialização**: corrigidos congelamentos raros de vários minutos no Windows, causados por chamadas síncronas lentas ao sistema durante a inicialização e a verificação de atualizações;
- **Extração de arquivos**: preservadas as permissões de arquivo do Unix durante a extração;
- **HTTP de extensões**: restaurado o tratamento permanente de respostas diferentes de 2xx, e as esperas entre novas tentativas agora podem ser canceladas;
- **Paleta de comandos**: corrigido o botão da barra de ferramentas quando seu atalho era personalizado;
- **Seleção por intervalo na grade**: corrigido um problema que selecionava entradas fora do intervalo indicado;
- **Menus de contexto**: corrigidos os menus do item selecionado e do diretório atual que permaneciam abertos após a escolha de uma ação;
- **Registro de atalhos**: corrigidos erros de registro após o recarregamento da janela;
- **Aplicação de tema**: corrigido um problema que impedia a aplicação dos temas selecionados em todas as janelas;
- **Movimentações no macOS**: corrigido o tratamento de movimentações entre volumes e ativado o uso de pacotes de aplicativos como destino;
- **Gerenciador de arquivos padrão**: a restauração do registro do Windows ficou mais segura quando a ativação do gerenciador de arquivos padrão falha ou quando os valores anteriores do sistema são recuperados;

![keyboard-scroll-floating-header](./public/changelog/assets/2.1.0/keyboard-scroll-floating-header.webp)

---

## [2.0.0-beta.3] - April 2026

**Resumo:** Sistema de extensões com marketplace, compartilhamento de arquivos em rede local, menu de acesso rápido, arquivos zip, unidades WSL, edição de etiquetas, melhorias na visualização rápida e pesquisa, melhorias nos efeitos visuais e muitas melhorias de UX e estabilidade.

- [Novos recursos](#novos-recursos)
  - [Sistema de extensões](#sistema-de-extensões)
  - [Gerenciador de arquivos padrão](#gerenciador-de-arquivos-padrão)
  - [Compartilhamento em rede local](#compartilhamento-em-rede-local)
  - [Menu de acesso rápido](#menu-de-acesso-rápido)
  - [Arquivos Zip](#arquivos-zip)
  - [Detecção de unidades WSL](#detecção-de-unidades-wsl)
  - [Edição de etiquetas](#edição-de-etiquetas)
  - [Atualizações integradas](#atualizações-integradas)
  - [Copiar caminho](#copiar-caminho)
  - [Fechar abas duplicadas](#fechar-abas-duplicadas)
  - [Menus de contexto Home e Painel](#menus-de-contexto-home-e-painel)
  - [Modo de mesclagem dos efeitos visuais](#modo-de-mesclagem-dos-efeitos-visuais)
- [Novas configurações](#novas-configurações)
- [Novos atalhos](#novos-atalhos)
- [Novos idiomas](#novos-idiomas)
- [Melhorias de UX](#melhorias-de-ux)
  - [Melhorias na visualização rápida](#melhorias-na-visualização-rápida)
  - [Melhorias na pesquisa rápida](#melhorias-na-pesquisa-rápida)
  - [Operações de arquivos](#operações-de-arquivos)
  - [Efeitos visuais](#efeitos-visuais)
- [Melhorias na interface](#melhorias-na-interface)
- [Correções de bugs](#correções-de-bugs)

### Novos recursos

#### Sistema de extensões

Sistema completo de extensões com marketplace aberto.

- **Marketplace**: navegue, instale e gerencie extensões do marketplace;
- **Instalação local**: você pode instalar extensões de uma pasta local;
- **Paleta de comandos**: nova forma de ativar comandos do aplicativo e das extensões;
- **Capacidades**: extensões podem registrar atalhos locais e globais, itens do menu de contexto, configurações, páginas inteiras e comandos;
- **Versionamento**: você pode instalar diferentes versões de extensões e ativar a atualização automática;
- **Localização**: extensões podem fornecer traduções para diferentes idiomas;
- **Gerenciamento de binários**: extensões podem usar binários (ffmpeg, deno, node, yt-dlp, 7z e qualquer outro binário existente);
- **Execução isolada**: extensões são executadas em sandboxes ESM isoladas com permissões granulares;

#### Gerenciador de arquivos padrão

Agora você pode definir o SFM como gerenciador de arquivos padrão no Windows (`Configurações > Experimental`). Quando esta configuração está ativada, a maioria das ações do sistema em arquivos será direcionada para o SFM:

- Ícone do aplicativo Explorador de Arquivos;
- Atalho `Ctrl+E`;
- Revelar arquivo na pasta;
- Mostrar downloads (quando você baixa um arquivo no navegador);
- Comandos do terminal: "start {path}", "code {path}", etc.
- E mais;

Visualizações nativas do sistema como "Lixeira", "Painel de Controle" e outros programas profundamente integrados são delegados ao Explorador de Arquivos nativo.

#### Compartilhamento em rede local

Compartilhe e transmita arquivos e diretórios pela sua rede local diretamente do aplicativo.

Acesse o compartilhamento em rede local pelo botão da barra de ferramentas no navegador ou pelo menu de contexto em qualquer arquivo ou diretório. Quando um compartilhamento está ativo, um código QR e URLs compartilháveis são exibidos. Dois modos estão disponíveis:

- **Transmissão**: transmita arquivos e diretórios para qualquer dispositivo na sua rede via um navegador web;
- **FTP**: compartilhe arquivos via FTP para acesso direto de outros aplicativos. Você pode tanto baixar quanto enviar arquivos de e para o computador a partir de outro dispositivo;

#### Menu de acesso rápido

O botão "Painel" na barra lateral agora funciona como um menu de acesso rápido. Ao passar o mouse sobre ele, um painel se abre mostrando seus Favoritos e itens Etiquetados.

Todos os itens no painel são entradas reais de diretório — você pode arrastar e soltar itens para dentro e para fora, abrir menus de contexto com o clique direito e executar qualquer operação padrão de arquivos.

Pode ser desativado em `Configurações > Aparência da interface > Abrir painel de acesso rápido ao passar o mouse`.

#### Arquivos Zip

Comprima e extraia arquivos zip diretamente do menu de ações do navegador de arquivos:

- **Extrair**: extraia um arquivo `.zip` para o diretório atual ou para uma pasta nomeada;
- **Comprimir**: comprima arquivos e diretórios selecionados em um arquivo `.zip`;

#### Detecção de unidades WSL

No Windows, o aplicativo agora detecta automaticamente as distribuições WSL instaladas e exibe suas unidades no navegador, permitindo que você navegue pelos sistemas de arquivos WSL nativamente.

#### Edição de etiquetas

Agora você pode editar nomes e cores das etiquetas. Abra o seletor de etiquetas em qualquer arquivo ou diretório para renomear etiquetas, alterar sua cor ou excluí-las.

#### Atualizações integradas

Agora você pode baixar e instalar atualizações diretamente da notificação de atualização sem sair do aplicativo.

#### Copiar caminho

Adicionada a opção "Copiar caminho" ao menu de contexto de arquivos e diretórios.

#### Fechar abas duplicadas

Adicionada a capacidade de fechar abas duplicadas na barra de abas, removendo todas as abas que apontam para o mesmo diretório.

#### Menus de contexto Home e Painel

Os itens na página inicial e no painel agora têm menus de contexto completos, correspondendo à funcionalidade disponível no navegador.

### Novas configurações

- **Mostrar banner de mídia da home**: mostrar ou ocultar o banner de mídia da página inicial (`Configurações > Aparência da interface > Banner de mídia da página inicial`);
- **Atraso das dicas**: configurar o atraso antes do aparecimento das dicas (`Configurações > Aparência da interface > Dicas`);
- **Tempo relativo**: exibir timestamps recentes em formato relativo, ex. "5 min atrás" (`Configurações > Geral > Data / hora`);
- **Formato de data e hora**: configurar formato do mês, formato regional, relógio de 12 horas, segundos e milissegundos (`Configurações > Geral > Data / hora`);
- **Desfoque do fundo dos diálogos**: definir a intensidade do desfoque para o fundo dos diálogos (`Configurações > Aparência da interface > Configurações de estilo`);
- **Filtros de brilho e contraste**: ajustar os filtros de estilo de brilho e contraste para a interface do aplicativo (`Configurações > Aparência da interface > Configurações de estilo`);
- **Brilho da mídia de sobreposição**: ajustar o brilho da mídia de sobreposição dos efeitos visuais (`Configurações > Aparência da interface > Efeitos visuais`);
- **Modo de mesclagem dos efeitos visuais**: ajustar o modo de mesclagem para efeitos visuais, permitindo escolher como a mídia de fundo se mescla com a interface do aplicativo (`Configurações > Aparência da interface > Efeitos visuais`);
- **Pausar vídeo de fundo**: pausar o banner da home e o vídeo de fundo quando o aplicativo está inativo ou minimizado (`Configurações > Aparência da interface > Efeitos visuais`);
- **Gerenciador de arquivos padrão**: definir Sigma File Manager como o explorador de arquivos padrão no Windows (`Configurações > Experimental`);
- **Iniciar no login do sistema**: iniciar automaticamente o aplicativo quando você faz login no seu sistema (`Configurações > Geral > Comportamento na inicialização`);

### Novos atalhos

- **Copiar caminho do diretório atual** (`Ctrl+Shift+C`): copiar o caminho do diretório atual para a área de transferência;
- **Recarregar o diretório atual** (`F5`): atualizar a lista de arquivos do navegador;
- **Aumentar / diminuir zoom** (`Ctrl+=` / `Ctrl+-`): aumentar ou diminuir o zoom da interface;
- **Tela cheia** (`F11`): alternar o modo de tela cheia;

### Novos idiomas

- **Hindi**;
- **Urdu**;

### Melhorias de UX

#### Melhorias na visualização rápida

- **Navegação de mídia**: navegue entre os arquivos no diretório atual sem fechar a visualização rápida;
- **Pré-visualização de arquivos de texto**: pré-visualização melhorada de arquivos de texto com detecção correta de codificação, edição em linha e renderização de markdown;

#### Melhorias na pesquisa rápida

- **Todas as propriedades**: pesquise por qualquer propriedade do arquivo — nome, tamanho, contagem de itens, modificado, criado, acessado, caminho ou tipo MIME (ex. `modified: today`, `mime: image`);
- **Intervalos de tamanho**: filtre por tamanho usando comparações e intervalos (ex. `size: >=2mb`, `size: 1mb..10mb`);

#### Operações de arquivos

- **Segurança na resolução de conflitos**: melhorada a segurança dos arquivos na janela de resolução de conflitos para prevenir perda acidental de dados;
- **Colagem de uso único**: itens copiados só podem ser colados uma vez, prevenindo colagens duplicadas acidentais;
- **Copiar texto**: permite copiar texto da interface com `Ctrl+C` quando nenhum arquivo está selecionado;

#### Efeitos visuais

- **Gerenciador de fundo**: adicionado gerenciador de fundo na página de configurações para personalização centralizada do fundo;
- **Redefinição dos efeitos de fundo**: adicionado um botão de redefinição para as configurações de efeitos de fundo;

#### Outro

- **Redução do tamanho do aplicativo**: reduzido o tamanho do pacote do aplicativo excluindo fundos integrados de alta resolução e usando pré-visualizações comprimidas no editor do banner de mídia;
- **Pesquisa global**: exibição de um botão "mostrar configurações" no estado vazio e aumento da profundidade de pesquisa padrão;
- **Atalhos do Windows**: arquivos `.lnk` agora abrem seu destino no navegador em vez de serem executados externamente;
- **Painel**: melhorado o layout da seção de etiquetas;
- **Menu de contexto da barra de endereços**: adicionado menu de contexto aos itens da barra de endereços;
- **Menu de contexto do navegador**: mostrar menu de contexto ao clicar em uma área vazia no navegador;
- **Abrir em nova aba**: abrir diretórios em uma nova aba com o clique do botão do meio do mouse;
- **Rolagem das abas**: novas abas adicionadas rolam automaticamente para ficarem visíveis;
- **Foco dos menus**: os menus não retornam mais o foco para o botão de ativação quando são fechados com um clique externo;
- **Fechar pesquisa**: fechar a pesquisa global com `Escape`;
- **Inicialização mais rápida**: melhoria ligeira na velocidade de inicialização do aplicativo pré-carregando as configurações em Rust;
- **Diretórios do usuário**: adicionada a capacidade de adicionar e remover diretórios do usuário na página inicial;
- **Limites das listas**: diminuídos os limites para entradas frequentes e de histórico para melhorar o desempenho;

### Melhorias na interface

- **Ícones da barra de ferramentas**: cores unificadas dos ícones da barra de ferramentas em todo o aplicativo;
- **Animações dos cartões**: adicionados efeitos de escalonamento e aparecimento gradual aos cartões;
- **Tema claro**: melhoradas as cores e o contraste do tema claro;
- **Estabilidade na inicialização**: melhorada a estabilidade visual durante a inicialização do aplicativo para reduzir a cintilação;
- **Notificações**: melhorado o design das notificações para maior consistência;
- **Rolagem automática das abas**: rolagem automática da aba selecionada para ficar visível ao abrir a página do navegador;
- **Rótulos do caminho raiz**: normalizados os rótulos do caminho raiz nas abas e no painel de informações;
- **Traduções**: melhoradas as traduções em todo o aplicativo;

### Correções de bugs

- Corrigido o congelamento da interface ao copiar ou mover muitos itens; adicionado progresso das operações de arquivos ao centro de estado;
- Corrigido o congelamento da interface ao excluir muitos itens; adicionado progresso da exclusão ao centro de estado;
- Corrigido o menu de contexto na visualização em grade que não abria para o diretório atual quando outro item já tinha um menu aberto;
- Corrigido o painel de informações que não exibia todas as informações do diretório atual;
- Corrigidos os atalhos do aplicativo sendo registrados na janela de visualização rápida em vez de apenas na janela principal;
- Corrigido o tratamento de arquivos arrastados de navegadores web;
- Corrigidos os nomes de arquivos de URLs externos soltos que não mantinham segmentos válidos;
- Corrigido o banner da home sendo arrastável;
- Corrigido o cache de ícones do sistema não sendo indexado por caminho de arquivo, causando ícones incorretos;
- Corrigidas entradas raiz do Windows inacessíveis aparecendo no navegador;
- Corrigidos atalhos personalizados não identificados em alguns layouts de teclado;
- Corrigidas conexões SSHFS no Linux;
- Corrigida a barra de endereços criando entradas duplicadas no histórico ao clicar no breadcrumb;
- Corrigidos os resultados da pesquisa global não respondendo à navegação por teclado;
- Corrigidos os resultados da pesquisa global não abrindo ao clicar;
- Corrigido o status da pesquisa global não sincronizando após a indexação incremental;
- Corrigido o arrastar e soltar de arquivos para fora não funcionando em alguns aplicativos;
- Corrigido o design inconsistente dos emblemas de atalhos em todo o aplicativo;
- Corrigida a visibilidade das colunas do navegador em painéis estreitos;

---

## [2.0.0-beta.2] - February 2026

**Resumo:** Atalhos globais, novas configurações, novos recursos, filtragem de arquivos melhorada, barra de endereços melhorada, melhorias no banner da home e correções de bugs.

### Atalhos globais

Agora você pode usar atalhos de teclado para interagir com o aplicativo mesmo quando ele não está em foco.

Atalhos adicionados:

- `Win+Shift+E` para mostrar e focar a janela do aplicativo;

### Novas configurações

Adicionada configuração para escolher o que acontece quando a última aba é fechada.

![Configuração fechar última aba](./public/changelog/assets/beta-2/setting-close-last-tab.png)

### Novos recursos

Adicionados novos recursos em pré-visualização:

- Locais de rede: permite conectar um local de rede (SSHFS (SSH) / NFS / SMB / CIFS);
- [Linux] Montagem de unidades: permite desmontar locais;

### Filtro de arquivos

O filtro de arquivos foi melhorado:
- Agora quando você muda de diretório, ele limpa e fecha automaticamente;
- O recurso "filtrar ao digitar" é ativado no painel selecionado, não no primeiro;

### Barra de endereços

- Design melhorado e lógica de auto-completar;
- Os divisores do caminho agora são menus suspensos que fornecem navegação rápida para qualquer diretório pai;

![Menus dos divisores](./public/changelog/assets/beta-2/divider-menus.png)

### Banner da home / Efeitos de fundo

- Design melhorado do editor de banner de mídia:
  - O menu de opções do banner de mídia agora abre para baixo para evitar obscurecer a visualização;
  - Agora você pode clicar fora para fechar o editor de posição do fundo;
  - Campo de URL movido acima dos fundos personalizados;
- Imagens/vídeos personalizados podem ser usados nos efeitos visuais de fundo;
- Removidas algumas imagens padrão do banner de mídia;
- Adicionada nova imagem de banner "Exile by Aleksey Hoffman";

### Melhorias de UX

- O aplicativo restaura a posição anterior da janela ao iniciar;
- A aba atual agora pode ser fechada com o atalho `Ctrl+W` ou clique do botão do meio do mouse;
- Aumentado o tamanho dos ícones de arquivos na visualização em grade;

### Correções de bugs

- Corrigido o movimento de arquivos entre abas que às vezes os movia para o local errado;
- Corrigido o navegador que às vezes mostrava ícones de sistema errados para diretórios;
- Corrigida a criação de múltiplas instâncias do aplicativo e da bandeja do sistema;
- Corrigido o menu de extensões shell que buscava dados periodicamente, forçando a lista a rolar para o topo o tempo todo;

## [2.0.0-beta.1] - February 2026

**Resumo:** Grandes melhorias de usabilidade e design incluindo navegação por teclado, novos atalhos, abertura no terminal, atualização automática de diretórios, arrastar e soltar e melhorias na pesquisa e nas visualizações em lista.

### Navegação por teclado

Navegue pelos arquivos usando o teclado com suporte completo para layouts em grade e lista e visualização dividida.

- Teclas de seta para navegação espacial na visualização em grade e navegação sequencial na visualização em lista;
- Enter para abrir o diretório ou arquivo selecionado, Backspace para voltar;
- Ctrl+Esquerda / Ctrl+Direita para alternar o foco entre os painéis da visualização dividida;
- Ctrl+T para abrir o diretório atual em uma nova aba;
- Todos os atalhos de navegação são personalizáveis em Configurações > Atalhos;

### Atualização automática de diretórios

A visualização do navegador atualiza automaticamente quando arquivos são criados, excluídos, renomeados ou modificados no diretório atual.

- Os tamanhos dos arquivos atualizam automaticamente quando alterados por aplicativos externos;
- Monitoramento eficiente do sistema de arquivos com debouncing para evitar atualizações excessivas;
- Atualizações inteligentes baseadas em diferenças que só alteram itens afetados, preservando a posição de rolagem e a seleção;

### Arrastar e soltar

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/beta-1/drag-and-drop.mp4"></video>

Agora você pode arrastar arquivos e pastas para copiá-los/movê-los facilmente. Arraste entre painéis, de ou para listas de resultados de pesquisa, de ou para aplicativos externos.

### Conflitos de cópia

Adicionada janela modal para fácil resolução de conflitos de cópia/movimentação.

### Atualização automática

Adicionada verificação automática de atualizações (pode ser controlada nas configurações).

### Editor de mídia do banner da home

Adicionado editor para personalização do banner da página inicial. Agora você pode enviar imagens e vídeos personalizados (são suportados tanto arquivos locais quanto URLs remotos)

### Melhorias na visualização em lista

- Design melhorado e corrigidos pequenos incômodos;
- Adicionada personalização da visibilidade das colunas: escolha quais colunas exibir;
- Adicionada ordenação por colunas: clique nos cabeçalhos das colunas para ordenar as entradas;
- O layout padrão do navegador foi alterado para visualização em lista;

### Melhorias na pesquisa global

- Layout e design atualizados com suporte para arrastar e soltar;
- A pesquisa agora está disponível enquanto as unidades ainda estão sendo indexadas;

### Abrir no terminal

Abra diretórios no seu terminal preferido diretamente do menu de contexto.

- Detecção automática de terminais instalados no Windows, macOS e Linux;
- O Windows Terminal mostra todos os perfis de shell configurados com ícones dos executáveis;
- O terminal padrão do Linux é auto-detectado e mostrado primeiro;
- Inclui modos normal e administrador/elevado;
- Atalho padrão: Alt+T;

### Localização

- Adicionado idioma esloveno (graças a: @anderlli0053);

### Melhorias de UI / UX

- Adicionado seletor de fontes: escolha a fonte da interface entre as fontes do sistema instaladas;
- Adicionado menu "Criar novo" para criar rapidamente arquivos ou diretórios;
- Exibição de uma visualização de estado vazio ao navegar para diretórios vazios;
- A barra de status mostra o total de itens com contagem oculta quando a lista está filtrada;
- Itens recém-criados, copiados e movidos rolam automaticamente para ficarem visíveis;
- Barra de ferramentas da área de transferência exibida uma vez abaixo dos painéis em vez de em cada painel;
- Design simplificado da janela de renomeação;
- Ícones responsivos da barra de ferramentas que se recolhem em um menu suspenso em janelas pequenas;
- Removida a aba "Navegação" vazia das configurações;
- Renomear um diretório agora atualiza seu caminho em todas as abas, espaços de trabalho, favoritos, etiquetas, histórico e itens frequentes;
- Excluir um arquivo ou diretório agora o remove de todas as listas armazenadas e navega as abas afetadas para a home;
- Caminhos inexistentes nos favoritos, etiquetas, histórico e itens frequentes agora são limpos automaticamente na inicialização;

### Correções de bugs

- Corrigido o status de indexação da pesquisa global não atualizando em tempo real;
- Corrigido o painel da visualização dividida não atualizando quando seu diretório é excluído ou renomeado do outro painel;
- Corrigidas as abas carregando com erro quando seu caminho armazenado não existe mais;
- Corrigidos os ícones do sistema mostrando o mesmo ícone para todos os arquivos do mesmo tipo em vez de ícones únicos por arquivo;
- Corrigidos os atalhos de teclado não funcionando no segundo painel da visualização dividida;
- Corrigidos os atalhos de teclado parando de funcionar após a navegação entre páginas;
- Corrigido vazamento de memória com ouvintes de tecla do filtro não limpos na desmontagem;
- Linux: adicionado suporte para recuperação do aplicativo padrão no menu "abrir com";

---

## [2.0.0-alpha.6] - January 2026

**Resumo:** Janela de Novidades, Visualização rápida, melhorias no menu de contexto e novas configurações.

### Janela de Novidades

Uma janela de registro de alterações que mostra novos recursos e melhorias para cada versão.

- Aparece automaticamente após atualizações (pode ser desativado);
- Navegue por todas as versões;
- Veja descrições detalhadas e capturas de tela para cada recurso;

### Visualização rápida

Pré-visualize arquivos sem abri-los completamente usando uma janela de pré-visualização leve.

- Pressione `Espaço` ou a opção "Visualização rápida" no menu de contexto para visualizar rapidamente os arquivos;
- Feche instantaneamente com `Espaço` ou `Escape`.
- Suporta imagens, vídeos, áudio, arquivos de texto, PDFs e mais;

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/alpha-6/quick-view.mp4"></video>

### Cálculo do tamanho dos diretórios

- O tamanho dos diretórios agora é calculado automaticamente;
- Você pode ver o tamanho total de todos os diretórios, incluindo todos os subdiretórios e arquivos, assim que abrir qualquer diretório;

![Abrir com](./public/changelog/assets/alpha-6/size.png)

### Novas opções do menu de contexto

#### Abrir com

- Escolha qual aplicativo usar para abrir um arquivo;
- Configure predefinições personalizadas para abrir arquivos em aplicativos com parâmetros;
- Visualize todos os aplicativos compatíveis para qualquer tipo de arquivo;
- Defina aplicativos padrão para tipos de arquivos específicos;

![Abrir com](./public/changelog/assets/alpha-6/open-with.png)

#### Extensões do shell

- Acesse itens do menu de contexto do shell do Windows;
- Acesse extensões do shell de terceiros (7-Zip, Git, etc.);

![Extensões do shell](./public/changelog/assets/alpha-6/shell-extensions.png)

### Novas configurações

#### Detecção de unidades

- Foca o aplicativo quando dispositivos removíveis são conectados (pode ser desativado);
- Controle o comportamento de abertura automática do Explorador do Windows para unidades removíveis;

#### Filtrar ao digitar

Comece a digitar em qualquer lugar no navegador para filtrar instantaneamente os itens no diretório atual;

#### Atalho de pesquisa nas configurações

Novo atalho de teclado para acesso rápido à pesquisa nas configurações;

#### Dados estatísticos do usuário

- Adicionada seção de configurações de estatísticas;
- Na página do painel você pode ver, navegar, limpar o histórico, favoritos e itens usados com frequência;

### Melhorias na pesquisa

Pesquisa global melhorada com um sistema híbrido indexado + direto para resultados mais confiáveis e atualizados.

- As pesquisas agora levam consistentemente menos de 1 segundo (~1 TB de unidade cheia), não importa onde os arquivos estejam nas suas unidades;
- Quando você pesquisa nos seus "caminhos prioritários" (os que você abre com frequência), obtém resultados instantaneamente e encontra os arquivos mesmo que tenham acabado de ser criados e ainda não tenham sido indexados.

#### Os caminhos prioritários incluem:
- Diretórios do usuário: Downloads, Documentos, Área de Trabalho, Imagens, Vídeos, Música;
- Favoritos;
- Abertos recentemente;
- Usados com frequência;
- Etiquetados;

---

## [2.0.0-alpha.5] - January 2026

**Resumo:** Operações de arquivos, pesquisa global e personalização de atalhos.

### Pesquisa global

Pesquisa poderosa em todo o disco que indexa e pesquisa arquivos em todas as suas unidades. Inclui correspondência aproximada para encontrar arquivos mesmo com erros de digitação, re-indexação automática periódica, indexação prioritária para diretórios usados com frequência e varredura paralela opcional para indexação mais rápida.

![Pesquisa global](./public/changelog/assets/alpha-5/search.png)

### Operações de arquivos

Suporte completo a operações de arquivos com funcionalidades de copiar, mover e excluir incluindo rastreamento de progresso. Inclui também renomeação de arquivos e pastas no local.

### Editor de atalhos

Personalize todos os atalhos de teclado no aplicativo. Visualize as associações atuais, detecte conflitos e restaure os padrões.

### Melhorias no navegador

Adicionada opção para exibir ícones nativos do sistema para arquivos e diretórios em vez de glifos minimalistas. As abas de navegação das configurações agora ficam fixas no topo da página durante a rolagem.

---

## [2.0.0-alpha.4] - January 2026

**Resumo:** Página inicial, efeitos visuais e opções de personalização do usuário.

### Página inicial

Uma bela página inicial com um banner de mídia animado, lista de unidades e acesso rápido a diretórios comuns do usuário como Documentos, Downloads, Imagens e mais.

### Efeitos visuais

Seção de efeitos visuais personalizáveis nas configurações que adiciona desfoque, opacidade e efeitos de ruído ao fundo do aplicativo. Suporta configurações diferentes para cada página.

### Editor de diretórios do usuário

Personalize seus cartões de diretórios do usuário com títulos, ícones e caminhos personalizados. Personalize a aparência dos seus diretórios de acesso rápido na página inicial.

### Editor de posição do banner

Ajuste com precisão a posição dos fundos do banner da página inicial. Ajuste zoom, posicionamento horizontal e vertical para o visual perfeito.

### Melhorias nas configurações

- A pesquisa nas configurações agora funciona em qualquer idioma, não apenas no atual;
- O aplicativo restaura a última aba de configurações visitada ao recarregar em vez de abrir a primeira toda vez;

---

## [2.0.0-alpha.3] - December 2025

**Resumo:** Visualização do navegador com abas, espaços de trabalho e um novo sistema de design.

### Visualização do navegador

A experiência principal de navegação de arquivos com um sistema moderno de abas com suporte a espaços de trabalho, um novo design da barra de ferramentas da janela com controles integrados e navegação de painel duplo para gerenciamento eficiente de arquivos.

### Miniaturas de vídeo

Adicionadas miniaturas de pré-visualização para arquivos de vídeo no navegador.

### Migração do sistema de design

Migração do aplicativo de Vuetify para Sigma-UI para um design mais espaçoso e moderno com melhor qualidade de código.

---

## [2.0.0-alpha.1] - January 2024

**Resumo:** Reescrita completa usando tecnologias modernas.

### Migração Tauri

Sigma File Manager v2 foi reconstruído do zero usando Vue 3 Composition API, TypeScript e Tauri v2. O tamanho de instalação do aplicativo foi reduzido de 153 MB para apenas 4 MB no Windows. O tamanho do aplicativo instalado foi reduzido de 419 MB para 12 MB.

### Painéis redimensionáveis

Adicionado recurso de painéis redimensionáveis que permite dividir a visualização do navegador ao meio e trabalhar com 2 diretórios lado a lado.

### Recursos iniciais

Navegação básica de arquivos com listagem de diretórios, gerenciamento de janela com controles de minimizar, maximizar e fechar, e uma estrutura inicial da página de configurações.
