# تبدیلی لاگ

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

**خلاصہ:** دوسری ایپس کے ساتھ سسٹم کلپ بورڈ کا انضمام، باکس انتخاب، منسلک تقسیم منظر، لنک ہینڈلنگ، پاس ورڈ سے محفوظ ZIP آرکائیوز، Windows پر نیٹو خصوصیات، ایکسٹینشن API کی توسیع، عبرانی زبان کی حمایت، اور نیویگیٹر میں بہتریاں۔

- [نئی خصوصیات](#نئی-خصوصیات)
  - [سسٹم کلپ بورڈ انضمام](#سسٹم-کلپ-بورڈ-انضمام)
  - [باکس انتخاب](#باکس-انتخاب)
  - [منسلک تقسیم منظر](#منسلک-تقسیم-منظر)
  - [لنک ہینڈلنگ](#لنک-ہینڈلنگ)
  - [نیٹو خصوصیات ونڈو](#نیٹو-خصوصیات-ونڈو)
  - [لسٹ منظر میں کالم کا سائز اور ترتیب](#لسٹ-منظر-میں-کالم-کا-سائز-اور-ترتیب)
  - [روٹ مقامات کا پتہ](#روٹ-مقامات-کا-پتہ)
- [ایکسٹینشنز](#ایکسٹینشنز)
  - [ایکسٹینشن APIs اور مناظر](#ایکسٹینشن-apis-اور-مناظر)
- [نئی سیٹنگز](#نئی-سیٹنگز)
- [نئے شارٹ کٹس](#نئے-شارٹ-کٹس)
- [نئی زبانیں](#نئی-زبانیں)
- [UX بہتریاں](#ux-بہتریاں)
  - [آرکائیو نکالنا](#آرکائیو-نکالنا)
  - [گرڈ ترتیب](#گرڈ-ترتیب)
  - [شیل ایکسٹینشنز](#شیل-ایکسٹینشنز)
  - [سیشن میموری](#سیشن-میموری)
  - [نیویگیٹر کارکردگی](#نیویگیٹر-کارکردگی)
  - [ہوم پیج اور کانٹیکسٹ مینو](#ہوم-پیج-اور-کانٹیکسٹ-مینو)
- [UI بہتریاں](#ui-بہتریاں)
- [بگ فکسز](#بگ-فکسز)

### نئی خصوصیات

#### سسٹم کلپ بورڈ انضمام

سسٹم کلپ بورڈ کے ذریعے Sigma File Manager اور دوسری ایپس کے درمیان فائلیں، فولڈرز اور تصاویر کاپی اور پیسٹ کریں۔

- **ایپس کے درمیان فائل منتقلی**: SFM میں آئٹمز کاپی یا کٹ کریں اور File Explorer جیسی ایپس میں پیسٹ کریں، یا دوسری ایپس سے کاپی کیے گئے راستے اور فائلیں `Ctrl+V` سے نیویگیٹر میں پیسٹ کریں؛
- **تصویر پیسٹ**: براؤزرز اور دوسری ایپس سے کاپی کی گئی تصاویر براہ راست فولڈر میں پیسٹ کریں؛
- **تنازع ڈائیلاگز**: جب پیسٹ کیے گئے آئٹمز پہلے سے موجود ہوں تو `نام تبدیل کریں` یا `ضم کریں` منتخب کریں، اور انفرادی فائل تنازعات کو `تبدیل کریں`، `چھوڑیں`، `دونوں رکھیں`، یا `سب پر لاگو کریں` سے حل کریں؛
- **کلپ بورڈ ٹول بار**: دوسری ایپس میں کاپی کی گئی تصاویر اور فائل راستوں کا اختیاری ٹول بار پیش منظر؛

ٹول بار کی مرئیت `سیٹنگز > انٹرفیس کی ظاہری شکل > کلپ بورڈ` میں کنٹرول کی جا سکتی ہے۔ ٹول بار چھپا ہونے پر بھی `Ctrl+V` سے پیسٹ کام کرتا ہے۔

![system-clipboard](./public/changelog/assets/2.2.0/system-clipboard.webp)

#### باکس انتخاب

نیویگیٹر میں خالی جگہ پر گھسیٹ کر انتخاب باکس سے متعدد آئٹمز منتخب کریں۔

- **موڈیفائرز**: موجودہ انتخاب میں شامل کرنے کے لیے `Ctrl` یا `Shift` دبائے رکھیں؛ الٹنے کے لیے `Alt`؛
- **آسان نشانہ**: ڈریگ شروع کرنے کے لیے زیادہ جگہ حاصل کرنے کی غرض سے اختیاری طور پر لسٹ پیڈنگ اور گرڈ فاصلے بڑھائیں؛

`سیٹنگز > عمومی > فائل منظر > باکس انتخاب فعال کریں` میں فعال کریں۔

![box-selection](./public/changelog/assets/2.2.0/box-selection.webp)

#### منسلک تقسیم منظر

سادہ کالم طرز ورک فلو کے لیے نیا `منسلک` تقسیم منظر موڈ: پہلے پین میں فولڈر پر کلک کرنے سے اس فولڈر کے مواد دوسرے پین میں دکھتے ہیں۔

موجودہ آزاد `تقسیم` موڈ بدستور ہے۔ نیویگیٹر اختیارات مینو میں `تقسیم منظر موڈ` سے موڈ منتخب کریں، یا `Ctrl+S` سے تقسیم منظر ٹوگل کریں۔

معلوماتی پینل کا آئیکن بھی اپ ڈیٹ کیا گیا تاکہ اسے تقسیم منظر کے آئیکن سے الگ پہچاننا آسان ہو۔

![linked-split-view](./public/changelog/assets/2.2.0/linked-split-view.webp)

#### لنک ہینڈلنگ

نیویگیٹر سے فائل سسٹم لنکس بنائیں اور ان کا معائنہ کریں۔

- **لنک بنائیں**: کانٹیکسٹ مینو (`لنک بنائیں`) سے سمبولک لنکس، شارٹ کٹس، ہارڈ لنکس، اور جنکشنز بنائیں؛
- **لنک کالم**: قسم، لنکس، لنک ہدف، اور لنک حیثیت کے لیے اختیاری لسٹ کالم (`درست`، `ٹوٹا`، `نامعلوم`، `غیر معاون`)؛
- **کھولنے کا رویہ**: ڈائریکٹری شارٹ کٹس اور سم لنک فولڈرز اپنے اہداف پر جاتے ہیں؛ دیگر لنک اہداف ڈیفالٹ ایپ سے کھلتے ہیں؛

![link-handling](./public/changelog/assets/2.2.0/link-handling.webp)

#### نیٹو خصوصیات ونڈو

Windows پر، منتخب آئٹمز کے لیے نیٹو سسٹم خصوصیات ڈائیلاگ کانٹیکسٹ مینو، ایکشن مینو، `Alt+Enter`، یا `Alt` + ڈبل کلک سے کھولیں۔

![native-properties](./public/changelog/assets/2.2.0/native-properties.webp)

#### لسٹ منظر میں کالم کا سائز اور ترتیب

لسٹ منظر کے کالم آپ کے کام کے مطابق سائز اور ترتیب بدل سکتے ہیں۔

- **سائز تبدیل کریں**: چوڑائی بدلنے کے لیے کالم کناروں کو گھسیٹیں؛
- **ترتیب اور مرئیت**: لسٹ ہیڈر کے `کالم` پاپ اوور سے ترتیب اور مرئیت منظم کریں؛
- **چوڑائی کے اختیارات**: `دستیاب چوڑائی بھریں` اور `کم از کم چوڑائیاں مقرر کریں`؛

![list-column-resize](./public/changelog/assets/2.2.0/list-column-resize.webp)

#### روٹ مقامات کا پتہ

ایک روٹ `مقامات` پتہ تیز سوئچنگ کے لیے ڈرائیوز اور ورچوئل مقامات کی فہرست دکھاتا ہے۔

- **ایڈریس بار**: ڈرائیو روٹ سے اوپر جائیں یا ایڈریس بار / ایڈریس ایڈیٹر سے `مقامات` کھولیں؛
- **پسندیدہ اور ٹیگز**: مقامات کو دوسری ڈائریکٹریز کی طرح پسندیدہ میں شامل اور ٹیگ کیا جا سکتا ہے؛
- **تقسیم منظر**: نیویگیٹر چھوڑے بغیر پینز کے درمیان ڈرائیوز سوئچ کرنے کے لیے خاص طور پر مفید؛

![root-locations-address](./public/changelog/assets/2.2.0/root-locations-address.webp)

### ایکسٹینشنز

#### ایکسٹینشن APIs اور مناظر

ایکسٹینشنز کو مزید ہوسٹ صلاحیتیں اور UI بنانے کے بلاکس ملتے ہیں۔

- **لوکل بائنریز**: آٹو سیٹ اپ یا دستی طور پر منتخب لوکل بائنریز سے ایکسٹینشن وابستگیاں ترتیب دیں (`ایکسٹینشنز > وابستگیاں`)؛
- **HTTP درخواستیں**: ایکسٹینشنز اپنے مینی فیسٹ سے اجازت یافتہ ہوسٹس پر HTTP درخواستیں کر سکتی ہیں؛
- **منظر کنٹرول**: ایکسٹینشنز نیویگیٹر لے آؤٹ اور ترتیب کی ترجیحات لاگو کر سکتی ہیں (منظر کی اجازت کے ساتھ)؛
- **کلپ بورڈ API**: ایکسٹینشنز کلپ بورڈ پڑھ اور لکھ سکتی ہیں (اجازت کے ساتھ)؛
- **لسٹ تفصیل منظر**: تلاش کے قابل فہرست اور تفصیل پین والا نیا ایکسٹینشن UI پیٹرن؛

![extension-local-binaries](./public/changelog/assets/2.2.0/extension-local-binaries.webp)

![extension-dependency-config](./public/changelog/assets/2.2.0/extension-dependency-config.webp)

![extension-list-detail](./public/changelog/assets/2.2.0/extension-list-detail.webp)

![extension-http-api](./public/changelog/assets/2.2.0/extension-http-api.webp)

### نئی سیٹنگز

- **باکس انتخاب فعال کریں**: کثیر انتخاب کے لیے خالی جگہ گھسیٹیں؛
  `سیٹنگز > عمومی > فائل منظر > باکس انتخاب فعال کریں`
- **فائل منظر کے فاصلے بڑھائیں**: آسان نشانہ کے لیے لسٹ پیڈنگ اور بڑے گرڈ فاصلے شامل کریں؛
  `سیٹنگز > عمومی > فائل منظر > فائل منظر کے فاصلے بڑھائیں`
- **Quick View ونڈو میموری میں رکھیں**: فوراً کھلنے کے لیے Quick View لوڈ رکھیں (تقریباً 200 MB استعمال کرتا ہے)؛
  `سیٹنگز > عمومی > کارکردگی > Quick View ونڈو میموری میں رکھیں`
- **پرنٹ ونڈو میموری میں رکھیں**: فوراً کھلنے کے لیے پرنٹ ونڈو لوڈ رکھیں (تقریباً 200 MB استعمال کرتا ہے)؛
  `سیٹنگز > عمومی > کارکردگی > پرنٹ ونڈو میموری میں رکھیں`
- **بیرونی تصاویر کے لیے کلپ بورڈ ٹول بار**: دوسری ایپس میں کاپی کی گئی تصاویر کے لیے کلپ بورڈ ٹول بار دکھائیں؛
  `سیٹنگز > انٹرفیس کی ظاہری شکل > کلپ بورڈ`
- **بیرونی راستوں کے لیے کلپ بورڈ ٹول بار**: دوسری ایپس میں کاپی کیے گئے فائل راستوں کے لیے کلپ بورڈ ٹول بار دکھائیں؛
  `سیٹنگز > انٹرفیس کی ظاہری شکل > کلپ بورڈ`
- **معلوماتی پینل کا متحرک سائز**: معلوماتی پینل کے سائز کو موافقت کرنے دیں، یا دستی طور پر سائز بدل کر اسے بند کریں؛
  `سیٹنگز > انٹرفیس کی ظاہری شکل > معلوماتی پینل > معلوماتی پینل کا متحرک سائز`
- **معلوماتی پینل پیش منظر میں مکمل سائز کی تصویر دکھائیں**: معلوماتی پینل میں مکمل ریزولوشن تصاویر دکھائیں؛
  `سیٹنگز > انٹرفیس کی ظاہری شکل > معلوماتی پینل > معلوماتی پینل پیش منظر میں مکمل سائز کی تصویر دکھائیں`
- **ویڈیو پیش منظر کو بطور ڈیفالٹ خاموش کریں**: براؤز کرتے وقت معلوماتی پینل کے ویڈیو پیش منظر خاموش کریں؛
  `سیٹنگز > انٹرفیس کی ظاہری شکل > معلوماتی پینل > ویڈیو پیش منظر کو بطور ڈیفالٹ خاموش کریں`
- **ویڈیو پیش منظر خودکار طور پر چلائیں**: منتخب ہونے پر معلوماتی پینل میں ویڈیوز خود بخود چلائیں؛
  `سیٹنگز > انٹرفیس کی ظاہری شکل > معلوماتی پینل > ویڈیو پیش منظر خودکار طور پر چلائیں`

### نئے شارٹ کٹس

- **نیٹو خصوصیات** (`Alt+Enter`): Windows پر منتخب آئٹمز کے لیے نیٹو خصوصیات ونڈو کھولیں؛

### نئی زبانیں

- **عبرانی** (`עברית`): دائیں سے بائیں لے آؤٹ کی حمایت کے ساتھ مکمل ترجمہ (`سیٹنگز > عمومی > زبان`)؛

### UX بہتریاں

#### آرکائیو نکالنا

ZIP نکالنا اب مرموز آرکائیوز اور غیر UTF-8 فائل ناموں کی حمایت کرتا ہے۔

- **پاس ورڈ سے محفوظ ZIP**: جب نکالنے کے لیے ضرورت ہو تو آرکائیو پاس ورڈ درج کریں؛
- **فائل نام انکوڈنگ**: `آرکائیو نکالنے کے اختیارات` میں انکوڈنگ منتخب کریں؛ خودکار شناخت ترجیحی ہے اور گروپ شدہ علاقائی انکوڈنگز فال بیک کے طور پر دستیاب ہیں؛

![archive-extraction-options](./public/changelog/assets/2.2.0/archive-extraction-options.webp)

![archive-extraction-encoding](./public/changelog/assets/2.2.0/archive-extraction-encoding.webp)

#### گرڈ ترتیب

گرڈ لے آؤٹ میں اب نیویگیٹر اختیارات مینو میں اپنے ترتیب کنٹرولز ہیں۔

- **ترتیب بنیاد**: نام، آئٹمز، سائز، ترمیم، تخلیق، ٹیگز، قسم، لنکس، اور لنک حیثیت؛
- **سمت**: چڑھتی یا اترتی، لسٹ منظر کی ترتیب سے الگ محفوظ؛

![grid-sorting](./public/changelog/assets/2.2.0/grid-sorting.webp)

#### شیل ایکسٹینشنز

کانٹیکسٹ مینو `شیل ایکسٹینشنز` کے تحت دوسری ایپس کے رجسٹر کردہ جدید شیل ایکسٹینشن ایکشنز لوڈ کر سکتا ہے۔

![shell-extensions](./public/changelog/assets/2.2.0/shell-extensions.webp)

#### سیشن میموری

جب آپ کسی صفحے یا پین سے دور جاتے ہیں اور اسی سیشن میں واپس آتے ہیں تو سکرول پوزیشنز اور فعال ٹیبز بحال ہوتے ہیں۔

#### نیویگیٹر کارکردگی

بڑے فولڈرز اور میڈیا براؤز کرنا تیز تر ہے اور کم میموری استعمال کرتا ہے۔

- **کولڈ لوڈنگ**: ڈائریکٹریز کھولتے وقت تیز تر پہلا لوڈ؛
- **آئیکن لوڈنگ**: حسب ضرورت اور سسٹم آئیکنز کم تاخیر کے ساتھ ظاہر ہوتے ہیں؛
- **لسٹ سکرولنگ**: بڑی ڈائریکٹریز میں ہموار لسٹ سکرولنگ؛
- **میڈیا پیش منظر**: تصویر، GIF، اور ویڈیو پیش منظر زیادہ جوابدہ ہیں اور کم میموری استعمال کرتے ہیں؛
- **انڈیکسنگ**: زیادہ مستحکم گلوبل سرچ انڈیکسنگ؛

#### ہوم پیج اور کانٹیکسٹ مینو

- **ڈس کنیکٹ**: حمایت ہونے پر کانٹیکسٹ مینو سے نیٹ ورک یا ہٹنے والے ماؤنٹس منقطع کریں؛
- **تمام نقل بند کریں**: ٹیب مینو `تمام نقل بند کریں` اب ورک اسپیس میں ہر نقل راستہ بند کرتا ہے، صرف موجودہ ٹیب کی نقل نہیں؛
- **رائٹ کلک صاف**: خالی نیویگیٹر پس منظر پر رائٹ کلک بیک گراؤنڈ مینو کھولنے سے پہلے موجودہ انتخاب صاف کرتا ہے؛
- **ہوم ایکشنز**: ہوم پیج کانٹیکسٹ مینو ایکشن کلکس کے بعد بند ہوتے ہیں، `نئے ٹیب میں کھولیں` نیویگیٹر کھولتا ہے، اور نئے ٹیبز نظر میں سکرول ہوتے ہیں؛
- **ونڈو ڈریگ ریجن**: Linux طرز ٹائٹل بارز پر، آسان ونڈو منتقل کرنے کے لیے ڈریگ ریجن ٹول بار بٹنز تک پھیلتا ہے؛

![window-drag-region](./public/changelog/assets/2.2.0/window-drag-region.webp)

### UI بہتریاں

- **فعال پین اشارہ**: تقسیم منظر آن ہونے پر سٹیٹس بار میں واضح فعال پین مارکر؛
- **سائز بدلنے والا معلوماتی پینل**: معلوماتی پینل کی چوڑائی اور پیش منظر/تفصیلات کی تقسیم بدلنے کے لیے گھسیٹیں؛
- **کمپیکٹ معلوماتی پینل**: معلوماتی پینل میں زیادہ گھنا خصوصیات کا لے آؤٹ؛
- **کانٹیکسٹ مینو ایکشنز**: `کارڈ میں ترمیم` ایکشن بٹن کے طور پر دکھایا جاتا ہے، مجموعی طور پر چھوٹے ایکشن بٹنز؛
- **نیویگیٹر اسٹائلنگ**: بہتر موافق لے آؤٹ، تقسیم منظر میں ٹیب کی فعال حالت کے اسٹائلز، اور کمانڈ پیلیٹ ایکسٹینشن منظر کا ڈیزائن؛
- **RTL لے آؤٹ**: دائیں سے بائیں زبانوں کے لیے صاف سیدھ؛

![resizable-info-panel](./public/changelog/assets/2.2.0/resizable-info-panel.webp)

![compact-info-panel](./public/changelog/assets/2.2.0/compact-info-panel.webp)

### بگ فکسز

- **ٹائپ ٹو سرچ**: غیر لاطینی کی بورڈ لے آؤٹس پر فوری سرچ کے فعال نہ ہونے کا اصلاح؛
- **ڈائریکٹری لوڈنگ**: ڈائریکٹری لوڈ مکمل ہونے کے بعد اندراجات کی دوبارہ ترتیب کا اصلاح؛
- **حسب ضرورت آئیکنز**: حسب ضرورت آئیکنز کے نمایاں تاخیر سے لوڈ ہونے کا اصلاح؛
- **گرڈ کارڈز**: لوڈنگ کے دوران گرڈ لے آؤٹ کارڈز کے سائز بدلنے کا اصلاح؛
- **گرڈ سکرول بار**: گرڈ سکرول بار کے چپچپا ہیڈرز کے پیچھے چھپنے کا اصلاح؛
- **فوری انتخاب**: فوری فائل انتخاب کے کبھی کبھار فائل کھولنے کا اصلاح؛
- **ٹرمینل شارٹ کٹ**: `Alt+T` کے منتخب اندراج کی بجائے موجودہ ڈائریکٹری کے لیے ٹرمینل کھولنے کا اصلاح؛
- **فائلیں کھولیں**: کھولی گئی فائلوں کے غلط ورکنگ ڈائریکٹری سے لانچ ہونے کا اصلاح؛
- **SMB شیئرز**: SMB شیئرز پر فائلیں نہ کھلنے کا اصلاح؛
- **WSL راستے**: Windows پر WSL ہوسٹ UNC راستہ ہینڈلنگ کا اصلاح، بشمول `//wsl.localhost` بطور ورچوئل ڈسٹرو فہرست؛
- **ڈیفالٹ فائل مینیجر**: یہ ترتیب براہ راست انسٹال کردہ Windows ورژنز میں دستیاب رہتی ہے؛ Microsoft Store ورژن میں اب اسے غیر دستیاب دکھایا جاتا ہے؛
- **AppImage (Linux)**: `Could not create default EGL display: EGL_BAD_PARAMETER` کا اصلاح؛
- **ایکسٹینشن انسٹال (Linux)**: ملٹی فائل dist ایکسٹینشنز کی انسٹال ناکامیوں کا اصلاح؛
- **ایکسٹینشن تفصیلات**: جائزہ صفحہ سیدھ اسٹائلز کا اصلاح؛
- **ڈیوائس ویک**: ڈیوائس ویک اپ کے بعد ایپ کے لوڈنگ حالت میں پھنس جانے کا اصلاح؛
- **اپ ڈیٹ نوٹیفکیشنز**: غیر جاری ورژنز کے لیے اپ ڈیٹ نوٹیفکیشنز ظاہر ہونے کا اصلاح؛
- **RTL**: دائیں سے بائیں لے آؤٹ مسائل کا اصلاح؛
- **تراجم**: غائب اور غلط ترجمہ سٹرنگز کا اصلاح؛

---

## [2.1.0] - May 2026

**خلاصہ:** نیویگیٹر کارکردگی کی بہتریاں، تیار کردہ تھمب نیلز، ایکسٹینشن تھیمز، پرنٹنگ، فائل پیش منظر، نئے شارٹ کٹس، ایڈریس ایڈیٹر کی بہتریاں، سٹیٹس سینٹر کا نیا ڈیزائن، اور ٹیب/نیویگیشن کی پالش۔

- [نئی خصوصیات](#نئی-خصوصیات)
  - [پرنٹنگ](#پرنٹنگ)
  - [ٹیبز پر فائل ڈراپ](#ٹیبز-پر-فائل-ڈراپ)
  - [معلوماتی پینل میں فائل پیش منظر](#معلوماتی-پینل-میں-فائل-پیش-منظر)
  - [نیویگیٹر لسٹ کالم](#نیویگیٹر-لسٹ-کالم)
- [ایکسٹینشنز](#ایکسٹینشنز)
  - [ایکسٹینشنز سے ایپ تھیمز](#ایکسٹینشنز-سے-ایپ-تھیمز)
  - [ایکسٹینشنز سے آئیکن تھیمز](#ایکسٹینشنز-سے-آئیکن-تھیمز)
- [نئی سیٹنگز](#نئی-سیٹنگز)
- [نئے شارٹ کٹس](#نئے-شارٹ-کٹس)
- [UX بہتریاں](#ux-بہتریاں)
  - [بڑی ڈائریکٹری کارکردگی](#بڑی-ڈائریکٹری-کارکردگی)
  - [فوری سرچ](#فوری-سرچ)
  - [ایڈریس ایڈیٹر](#ایڈریس-ایڈیٹر)
  - [سٹیٹس سینٹر](#سٹیٹس-سینٹر)
  - [نیویگیشن اور ٹیبز](#نیویگیشن-اور-ٹیبز)
  - [شارٹ کٹ مینجمنٹ](#شارٹ-کٹ-مینجمنٹ)
- [UI بہتریاں](#ui-بہتریاں)
- [بگ فکسز](#بگ-فکسز)

### نئی خصوصیات

#### پرنٹنگ

کانٹیکسٹ مینو، ایکشن مینو، یا `Ctrl+O` سے نیویگیٹر سے براہ راست منتخب فائلیں پرنٹ کریں۔

- **حمایت یافتہ فارمیٹس**: تصاویر، PDF، ٹیکسٹ فارمیٹس؛
- **فوری اخراج**: `Escape` سے پرنٹ منظر بند کریں؛

![printing](./public/changelog/assets/2.1.0/printing.webp)

#### ٹیبز پر فائل ڈراپ

فائلیں یا ڈائریکٹریز کو ٹیبز پر گھسیٹ کر انہیں دوسرے ٹیب کی ڈائریکٹری میں منتقل یا کاپی کریں۔

- **ڈراپ ٹارگٹ ٹیبز**: نیویگیٹر میں فائلیں گھسیٹتے وقت ٹیبز ڈراپ ٹارگٹس بن جاتے ہیں؛
- **ہوور ایکٹیویشن**: گھسیٹتے وقت ٹیب پر ہوور کرنے سے ڈراپ سے پہلے اس ٹیب پر سوئچ ہو سکتا ہے؛
- **تقسیم ٹیبز**: ڈائریکٹری ٹیب گروپس تقسیم منظر کی ٹیب ساخت برقرار رکھتے ہوئے عام ڈراپ رویہ رکھتے ہیں؛

![file-drop-to-tabs](./public/changelog/assets/2.1.0/file-drop-to-tabs.webp)

#### معلوماتی پینل میں فائل پیش منظر

معلوماتی پینل اب صرف تصاویر اور ویڈیوز نہیں بلکہ تمام Quick View حمایت یافتہ فائل اقسام کا پیش منظر کر سکتا ہے۔

- **میڈیا پیش منظر**: تصاویر تیار کردہ تھمب نیلز استعمال کرتی ہیں، ویڈیو اور آڈیو میں نیٹو کنٹرولز ہوتے ہیں، اور PDFs ان لائن رینڈر ہوتے ہیں؛
- **ٹیکسٹ پیش منظر**: ٹیکسٹ فائلیں محفوظ سائز حد کے ساتھ کمپیکٹ ڈیکوڈڈ پیش منظر دکھاتی ہیں؛
- **فال بیکس**: غیر حمایت یافتہ فائلیں اور فولڈرز سادہ آئیکن پلیس ہولڈرز رکھتے ہیں؛

![info-panel-file-preview](./public/changelog/assets/2.1.0/info-panel-file-preview.webp)

#### نیویگیٹر لسٹ کالم

لسٹ منظر میں مزید اختیاری کالم اور بہتر ان لائن میٹا ڈیٹا کنٹرول ہے۔

- **تخلیق کالم**: تخلیق تاریخ دکھائیں اور اس کے مطابق ترتیب دیں؛
- **ٹیگز کالم**: لسٹ منظر میں براہ راست ٹیگز دکھائیں اور کالم سے ٹیگز شامل، ہٹا، یا ترمیم کریں؛

![navigator-list-columns](./public/changelog/assets/2.1.0/navigator-list-columns.webp)

### ایکسٹینشنز

#### ایکسٹینشنز سے ایپ تھیمز

ایکسٹینشنز اب مکمل ایپ رنگ تھیمز فراہم کر سکتی ہیں۔ انسٹال شدہ تھیم ایکسٹینشنز تھیم سلیکٹر میں ظاہر ہوتی ہیں۔

#### ایکسٹینشنز سے آئیکن تھیمز

ایکسٹینشنز اب فولڈرز اور فائلوں کے لیے نیویگیٹر آئیکن تھیمز فراہم کر سکتی ہیں۔

- **الگ انتخاب**: `سیٹنگز > انٹرفیس کی ظاہری شکل > آئیکن تھیم` میں فولڈر اور فائل آئیکن تھیمز آزادانہ منتخب کریں؛
- **بلٹ ان اور ایکسٹینشن تھیمز**: بلٹ ان ڈیفالٹ/سسٹم آئیکن تھیمز یا کوئی بھی فعال ایکسٹینشن فراہم کردہ تھیم استعمال کریں؛
- **تھیم میچنگ**: فراہم کردہ تھیمز فائل ایکسٹینشن، فائل نام، فولڈر نام، اور کھلے فولڈر کی حالت سے آئیکنز تعریف کر سکتی ہیں؛

### نئی سیٹنگز

- **فعال ٹیب کا متن بولڈ کریں**: فعال ٹیب عنوان بولڈ بنائیں (`سیٹنگز > ٹیب > ٹیب کی ظاہری شکل > فعال ٹیب کا متن بولڈ کریں`)؛

![bold-active-tab-text-setting](./public/changelog/assets/2.1.0/bold-active-tab-text-setting.webp)

### نئے شارٹ کٹس

- **تقسیم منظر ٹوگل کریں** (`Ctrl+S`): نیویگیٹر میں تقسیم منظر دکھائیں یا چھپائیں؛
- **بند ٹیب بحال کریں** (`Ctrl+Shift+T`): سب سے حالیہ بند ٹیب گروپ بحال کریں؛
- **فائل / ڈائریکٹری بنائیں** (`Ctrl+Shift+M` / `Ctrl+Shift+N`): موجودہ ڈائریکٹری میں نئی فائل یا ڈائریکٹری بنائیں؛
- **منتخب فائل پرنٹ کریں** (`Ctrl+O`): منتخب فائل پرنٹ کریں؛
- **کاپی کیا راستہ کھولیں** (`Ctrl+Shift+V`): کلپ بورڈ سے درست راستہ کھولیں؛
- **صفحات سوئچ کریں** (`Alt+1` - `Alt+5`): ہوم، نیویگیٹر، ڈیش بورڈ، سیٹنگز، اور ایکسٹینشنز کے درمیان سوئچ کریں؛
- **ڈائریکٹری تاریخ نیویگیٹ کریں** (`Alt+Left` / `Alt+Right`): نیویگیٹر تاریخ میں پیچھے یا آگے جائیں؛
- **پیرنٹ ڈائریکٹری پر جائیں** (`Alt+Up`): پیرنٹ ڈائریکٹری پر جائیں؛
- **ماؤس تاریخ بٹنز** (`Mouse Button 4` / `Mouse Button 5`): ماؤس سائیڈ بٹنز سے پیچھے اور آگے نیویگیٹ کریں؛

![create-file-directory-shortcuts](./public/changelog/assets/2.1.0/create-file-directory-shortcuts.webp)

![navigator-shortcuts](./public/changelog/assets/2.1.0/navigator-shortcuts.webp)

### UX بہتریاں

#### بڑی ڈائریکٹری کارکردگی

نیویگیشن، فوری سرچ، اور میڈیا بھاری فولڈرز زیادہ جوابدہ ہیں اور کم میموری استعمال کرتے ہیں۔

- **تیار کردہ تھمب نیلز**: تصویر اور ویڈیو تھمب نیلز ہر فائل کارڈ میں مکمل میڈیا لوڈ کرنے کے بجائے چھوٹے سائز میں تیار ہوتے ہیں؛
- **پروگریسو تصاویر**: گرڈ تصویر کارڈز حتمی تھمب نیل تیار ہونے سے پہلے دھندلا کم ریزولوشن تھمب نیل دکھا سکتے ہیں؛
- **تھمب نیل منسوخی**: فولڈر یا نظر آنے والے اندراجات بدلنے پر تھمب نیل کی تیاری منسوخ کی جا سکتی ہے؛
- **رینڈرنگ کارکردگی**: بڑی ڈائریکٹری اندراجات زیادہ موثر رینڈرنگ استعمال کرتے ہیں اور Quick View ورچوئل لسٹ کے ساتھ تیار کردہ تھمب نیلز استعمال کرتا ہے؛

![low-res-image-thumbnail-preview](./public/changelog/assets/2.1.0/low-res-image-thumbnail-preview.webp)

#### فوری سرچ

فوری سرچ میں اب 2 موڈز ہیں: غیر فعال اور فعال:

- **غیر فعال موڈ**: ٹائپ شروع کرنے پر خودکار فعال ہوتا ہے۔ یہ سرچ ان پٹ پر فوکس کیے بغیر اندراجات فلٹر کرتا ہے اور نیویگیشن نہیں روکتا۔
- **فعال موڈ**: `Ctrl+F` سے فعال ہوتا ہے۔ یہ سرچ ان پٹ پر فوکس کرتا ہے اور نیویگیشن روکتا ہے لیکن درج استفسار پر زیادہ باریک کنٹرول دیتا ہے۔

دیگر تبدیلیاں:

- **فلٹر کرنے کے لیے ٹائپ کریں**: الفا نیومیرک کیز ٹائپ کرنا اب فعال پین میں ہمیشہ فوری سرچ (غیر فعال موڈ) شروع کرتا ہے؛
- **کی بورڈ نیویگیشن**: پہلا مماثل آئٹم خودکار منتخب ہوتا ہے؛
- **پاپ اوور ڈیزائن**: فوری سرچ پاپ اوور زیادہ کمپیکٹ ہے اور ڈائریکٹری آئٹمز نہیں ڈھانپتا؛

![quick-search](./public/changelog/assets/2.1.0/quick-search.webp)

#### ایڈریس ایڈیٹر

ایڈریس ایڈیٹر اب وسیع تر راستہ لانچر کے طور پر استعمال کیا جا سکتا ہے۔

- **فائلیں اور ڈائریکٹریز**: ایڈریس ایڈیٹر سے ڈائریکٹریز کے ساتھ ساتھ فائلیں بھی کھولیں؛
- **اکثر استعمال راستے**: اکثر استعمال راستے جلدی کھولنے پر مرکوز موڈ پر سوئچ کریں؛
- **تجاویز**: ڈائریکٹری اندراجات، درست مماثلتیں، حالیہ راستے، ٹیگ کردہ آئٹمز، صارف فولڈرز، اور سسٹم ڈرائیوز براؤز کریں؛
- **کی بورڈ ایکشنز**: ایڈیٹر سے پیچھے، آگے، اوپر نیویگیٹ کریں اور اندراج کو اس کی پیرنٹ ڈائریکٹری میں دکھائیں؛

![address-editor](./public/changelog/assets/2.1.0/address-editor.webp)

#### سٹیٹس سینٹر

سٹیٹس سینٹر اب واضح آپریشن گروپس والا کمپیکٹ ٹول بار ویجٹ ہے۔

- **فعال شمار**: ٹول بار بٹن فعال آپریشن شمار دکھانے والے پِل میں پھیلتا ہے؛
- **آپریشن گروپس**: فعال اور مکمل آپریشنز الگ ہوتے ہیں، مکمل آپریشنز سمٹنے والے سیکشن میں؛
- **سب منسوخ کریں**: سیکشن ہیڈر سے فعال آپریشنز متوازی منسوخ کریں؛
- **جاب کارڈز**: آپریشن کارڈز واضح قسم اور حیثیت لیبلز دکھاتے ہیں جیسے `Copy | Success` یا `Archive | Error`؛
- **کلپ بورڈ ریکوری**: پیسٹ جاب قطار میں آتے ہی کلپ بورڈ صاف کرتا ہے اور جاب ناکام ہونے پر بحال کرتا ہے؛

![status-center](./public/changelog/assets/2.1.0/status-center.webp)

#### نیویگیشن اور ٹیبز

نیویگیٹر کی حرکت اور ٹیب رویہ زیادہ قابل پیش گوئی ہیں۔

- **سائیڈ بار ڈرائیوز**: نیویگیشن سائیڈ بار میں ڈرائیو پر کلک کرنے سے وہ موجودہ ٹیب میں کھلتی ہے؛
- **موجودہ ڈائریکٹری**: موجودہ ایڈریس حصہ زیادہ نمایاں ہے، اور اس کا کانٹیکسٹ مینو آخری ایڈریس حصے پر رائٹ کلک سے کھلتا ہے؛
- **بند ٹیبز**: بحال ٹیبز اپنی پچھلی پوزیشن پر لوٹتے ہیں، نام بدلے راستے محفوظ رکھتے ہیں، اور حذف راستے ہوم پر بھیجے جاتے ہیں؛
- **جوابی لے آؤٹ**: ٹول بار نیویگیشن بٹنز پہلے سمٹتے ہیں، بہت تنگ پینز میں تقسیم منظر کے ایڈریس بارز دوسری صف پر جاتے ہیں، اور کمپیکٹ ٹیبز مستقل اونچائی رکھتے ہیں؛

![nav-sidebar-drive-current-tab](./public/changelog/assets/2.1.0/nav-sidebar-drive-current-tab.webp)

![current-directory-address-bar](./public/changelog/assets/2.1.0/current-directory-address-bar.webp)

#### شارٹ کٹ مینجمنٹ

شارٹ کٹ ایڈیٹنگ اب تنازعات اور حسب ضرورت کو زیادہ واضح طور پر سنبھالتی ہے۔

- **متعدد بائنڈنگز**: ایک ایکشن کو متعدد شارٹ کٹس تفویض کریں؛
- **غیر تفویض شارٹ کٹس**: شارٹ کٹس غیر تفویض کریں؛
- **تنازع تبدیلی**: تنازع پرامپٹ سے براہ راست متنازعہ شارٹ کٹ تبدیل کریں؛
- **شارٹ کٹ لسٹ مینو**: شارٹ کٹ لسٹ میں کانٹیکسٹ مینو سے شارٹ کٹس منظم کریں؛

![shortcut-editor](./public/changelog/assets/2.1.0/shortcut-editor.webp)

#### ڈریگ اینڈ ڈراپ

ایپس سوئچ کرکے آؤٹ باؤنڈ ڈریگ شروع کرنے کی اجازت۔ اب فائلیں `Alt+Tab` سے باہر گھسیٹی جا سکتی ہیں (صرف کرسر کے ونڈو چھوڑنے سے نہیں)؛

### UI بہتریاں

- **انتخاب رنگ**: نیویگیٹر انتخاب رنگ کی شفافیت، آف سیٹ، پین ہیڈر اسٹائلنگ، اور کی بورڈ فوکس رویہ میں بہتری؛
- **ٹیب بار**: ٹیب بار اسٹائلز اور فعال ٹیب پڑھائی میں بہتری؛
- **تھیم انتخاب**: تھیم انتخاب ڈیزائن میں بہتری؛
- **فوری رسائی**: فوری رسائی پینل اسٹائلنگ بہتر کی گئی؛
- **سپلیش سکرین**: سٹارٹ اپ کے دوران ایپ سپلیش سکرین شامل کی گئی؛
- **پاپ اوور مرئیت**: نیم شفاف پاپ اوور عناصر کے لیے مرئیت میں بہتری؛
- **ٹول ٹپس**: مزید ٹول بار بٹنز پر ٹول ٹپس شامل کیے گئے؛
- **تراجم**: جاپانی اور ویتنامی زبان سٹرنگز میں بہتری اور لوکیل ساخت صاف کی گئی؛

![selection-ring](./public/changelog/assets/2.1.0/selection-ring.webp)

![tab-bar-styles](./public/changelog/assets/2.1.0/tab-bar-styles.webp)

![narrow-window-layout](./public/changelog/assets/2.1.0/narrow-window-layout.webp)

### بگ فکسز

- **میپڈ ڈرائیوز**: میپڈ نیٹ ورک ڈرائیو سے باہر ڈریگ اینڈ ڈراپ کام نہ کرنے کا اصلاح؛
- **کی بورڈ سکرولنگ**: پہلی صف کے چپچپا ہیڈر کے پیچھے چھپنے کا اصلاح؛
- **سٹارٹ اپ فریز**: سٹارٹ اپ اور اپ ڈیٹ چیکس کے دوران سست ہم وقت سسٹم کالز سے ہونے والے نایاب کئی منٹ Windows سٹارٹ اپ فریز کا اصلاح؛
- **آرکائیو نکالنا**: آرکائیوز نکالتے وقت Unix فائل موڈز محفوظ رکھے گئے؛
- **ایکسٹینشن HTTP**: مستقل non-2xx جواب ہینڈلنگ بحال اور ری ٹرائی انتظار منسوخ کے قابل بنایا گیا؛
- **کمانڈ پیلیٹ**: شارٹ کٹ حسب ضرورت ہونے پر کمانڈ پیلیٹ ٹول بار بٹن کا اصلاح؛
- **گرڈ رینج انتخاب**: گرڈ منظر میں رینج انتخاب کے دائرے سے باہر اندراجات منتخب کرنے کا اصلاح؛
- **کانٹیکسٹ مینو**: منتخب آئٹم اور موجودہ ڈائریکٹری کانٹیکسٹ مینو کے ایکشن کلکس کے بعد کھلے رہنے کا اصلاح؛
- **شارٹ کٹ رجسٹریشن**: ونڈو ری لوڈ کے بعد شارٹ کٹ رجسٹریشن غلطیوں کا اصلاح؛
- **تھیم اطلاق**: منتخب تھیمز کے تمام ونڈوز میں لاگو نہ ہونے کا اصلاح؛
- **macOS منتقلیاں**: macOS پر کراس والیوم منتقلی ہینڈلنگ کا اصلاح اور بنڈل اہداف فعال؛
- **ڈیفالٹ فائل مینیجر**: فعال کرنے میں ناکامی یا پچھلی سسٹم قدروں کی بحالی پر Windows ڈیفالٹ فائل مینیجر رجسٹری بحالی کو محفوظ بنایا گیا؛

![keyboard-scroll-floating-header](./public/changelog/assets/2.1.0/keyboard-scroll-floating-header.webp)

---

## [2.0.0-beta.3] - April 2026

**خلاصہ:** مارکیٹ پلیس کے ساتھ ایکسٹینشن سسٹم، LAN فائل شیئرنگ، فوری رسائی مینو، زپ آرکائیوز، WSL ڈرائیوز، ٹیگ ایڈیٹنگ، بہتر کوئک ویو اور سرچ، بصری اثرات میں بہتری، اور بہت سی UX اور استحکام کی بہتریاں۔

### نئی خصوصیات

#### ایکسٹینشن سسٹم

اوپن مارکیٹ پلیس کے ساتھ مکمل ایکسٹینشن سسٹم۔

- **مارکیٹ پلیس**: مارکیٹ پلیس سے ایکسٹینشنز براؤز کریں، انسٹال کریں، اور منظم کریں؛
- **لوکل انسٹالیشن**: آپ لوکل فولڈر سے ایکسٹینشنز انسٹال کر سکتے ہیں؛
- **کمانڈ پیلیٹ**: ایپ اور ایکسٹینشن کمانڈز کو فعال کرنے کا نیا طریقہ؛
- **صلاحیتیں**: ایکسٹینشنز لوکل اور گلوبل شارٹ کٹس، کانٹیکسٹ مینو آئٹمز، سیٹنگز، پورے صفحات، اور کمانڈز رجسٹر کر سکتی ہیں؛
- **ورژننگ**: آپ ایکسٹینشنز کے مختلف ورژن انسٹال کر سکتے ہیں اور آٹو اپ ڈیٹ فعال کر سکتے ہیں؛
- **لوکلائزیشن**: ایکسٹینشنز مختلف زبانوں کے لیے تراجم فراہم کر سکتی ہیں؛
- **بائنری مینجمنٹ**: ایکسٹینشنز بائنریز (ffmpeg, deno, node, yt-dlp, 7z، اور کوئی بھی دوسری موجودہ بائنری) استعمال کر سکتی ہیں؛
- **سینڈ باکسڈ ایگزیکیوشن**: ایکسٹینشنز تفصیلی اجازتوں کے ساتھ الگ تھلگ ESM سینڈ باکسز میں چلتی ہیں؛

#### ڈیفالٹ فائل مینیجر

اب آپ Windows پر SFM کو ڈیفالٹ فائل مینیجر بنا سکتے ہیں (`سیٹنگز > تجرباتی`)۔ جب یہ سیٹنگ فعال ہوتی ہے تو زیادہ تر سسٹم فائل ایکشنز SFM پر بھیجے جائیں گے:

- File Explorer ایپ آئیکن؛
- `Ctrl+E` شارٹ کٹ؛
- فولڈر میں فائل دکھائیں؛
- ڈاؤن لوڈز دکھائیں (جب آپ براؤزر میں فائل ڈاؤن لوڈ کرتے ہیں)؛
- ٹرمینل کمانڈز: "start {path}", "code {path}"، وغیرہ۔
- اور بہت کچھ؛

"Recycle Bin"، "Control panel" جیسے نیٹو سسٹم ویوز، اور ایسے گہرائی سے مربوط پروگرامز نیٹو File Explorer کو واپس سونپ دیے جاتے ہیں۔

#### LAN شیئرنگ

ایپ سے براہ راست اپنے لوکل نیٹ ورک پر فائلیں اور ڈائریکٹریز شیئر اور سٹریم کریں۔

نیویگیٹر میں ٹول بار بٹن سے یا کسی بھی فائل یا ڈائریکٹری پر کانٹیکسٹ مینو سے LAN شیئرنگ تک رسائی حاصل کریں۔ جب کوئی شیئر فعال ہوتا ہے تو QR کوڈ اور شیئر کرنے کے قابل URLs ظاہر ہوتے ہیں۔ دو موڈز دستیاب ہیں:

- **سٹریم**: ویب براؤزر کے ذریعے اپنے نیٹ ورک پر کسی بھی ڈیوائس پر فائلیں اور ڈائریکٹریز سٹریم کریں؛
- **FTP**: دوسری ایپس سے براہ راست رسائی کے لیے FTP پر فائلیں شیئر کریں۔ آپ دوسرے ڈیوائس سے کمپیوٹر پر اور کمپیوٹر سے فائلیں ڈاؤن لوڈ اور اپ لوڈ دونوں کر سکتے ہیں؛

#### فوری رسائی مینو

سائیڈ بار میں "ڈیش بورڈ" بٹن اب فوری رسائی مینو کے طور پر کام کرتا ہے۔ اس پر ہوور کرنے سے آپ کے پسندیدہ اور ٹیگ کردہ آئٹمز دکھانے والا ایک پینل کھلتا ہے۔

پینل میں تمام آئٹمز حقیقی ڈائریکٹری اندراجات ہیں - آپ آئٹمز کو اندر اور باہر ڈریگ اینڈ ڈراپ کر سکتے ہیں، رائٹ کلک سے کانٹیکسٹ مینوز کھول سکتے ہیں، اور کوئی بھی معیاری فائل آپریشن کر سکتے ہیں۔

`سیٹنگز > UI ظاہری شکل > ہوور پر فوری رسائی پینل کھولیں` میں غیر فعال کیا جا سکتا ہے۔

#### زپ آرکائیوز

فائل براؤزر ایکشن مینو سے براہ راست زپ آرکائیوز کمپریس اور ایکسٹریکٹ کریں:

- **ایکسٹریکٹ**: ایک `.zip` فائل کو موجودہ ڈائریکٹری یا نامزد فولڈر میں ایکسٹریکٹ کریں؛
- **کمپریس**: منتخب فائلوں اور ڈائریکٹریز کو ایک `.zip` آرکائیو میں کمپریس کریں؛

#### WSL ڈرائیوز کی شناخت

Windows پر، ایپ اب خودکار طور پر انسٹال شدہ WSL ڈسٹری بیوشنز کا پتہ لگاتی ہے اور نیویگیٹر میں ان کی ڈرائیوز ظاہر کرتی ہے، جس سے آپ WSL فائل سسٹمز کو مقامی طور پر براؤز کر سکتے ہیں۔

#### ٹیگ ایڈیٹنگ

اب آپ ٹیگ نام اور رنگ ایڈٹ کر سکتے ہیں۔ ٹیگز کا نام تبدیل کرنے، ان کا رنگ بدلنے، یا انہیں حذف کرنے کے لیے کسی بھی فائل یا ڈائریکٹری پر ٹیگ سلیکٹر کھولیں۔

#### ایپ میں اپ ڈیٹس

اب آپ ایپ چھوڑے بغیر اپ ڈیٹ نوٹیفکیشن سے براہ راست اپ ڈیٹس ڈاؤن لوڈ اور انسٹال کر سکتے ہیں۔

#### پاتھ کاپی کریں

فائل اور ڈائریکٹری کانٹیکسٹ مینو میں "پاتھ کاپی کریں" آپشن شامل کیا گیا۔

#### ڈپلیکیٹ ٹیبز بند کریں

ٹیب بار سے ڈپلیکیٹ ٹیبز بند کرنے کی صلاحیت شامل کی گئی، جو ایک ہی ڈائریکٹری کی طرف اشارہ کرنے والے تمام ٹیبز کو ہٹا دیتی ہے۔

#### ہوم اور ڈیش بورڈ کانٹیکسٹ مینوز

ہوم پیج اور ڈیش بورڈ پر آئٹمز میں اب مکمل کانٹیکسٹ مینوز ہیں، جو نیویگیٹر میں دستیاب فعالیت سے مماثل ہیں۔

### نئی سیٹنگز

- **ہوم میڈیا بینر دکھائیں**: ہوم پیج میڈیا بینر دکھائیں یا چھپائیں (`سیٹنگز > UI ظاہری شکل > ہوم پیج میڈیا بینر`)؛
- **ٹول ٹپ تاخیر**: ٹول ٹپس ظاہر ہونے سے پہلے کی تاخیر ترتیب دیں (`سیٹنگز > UI ظاہری شکل > ٹول ٹپس`)؛
- **نسبتی وقت**: حالیہ ٹائم اسٹیمپس نسبتی فارمیٹ میں ظاہر کریں، مثلاً "5 منٹ پہلے" (`سیٹنگز > عمومی > تاریخ / وقت`)؛
- **تاریخ اور وقت فارمیٹ**: مہینے کا فارمیٹ، علاقائی فارمیٹ، 12 گھنٹے کی گھڑی، سیکنڈز، اور ملی سیکنڈز ترتیب دیں (`سیٹنگز > عمومی > تاریخ / وقت`)؛
- **ڈائیلاگ بیک ڈراپ بلر**: ڈائیلاگ بیک ڈراپس کے لیے بلر کی شدت سیٹ کریں (`سیٹنگز > UI ظاہری شکل > اسٹائل سیٹنگز`)؛
- **برائٹنس اور کنٹراسٹ فلٹرز**: ایپ UI کے لیے برائٹنس اور کنٹراسٹ اسٹائل فلٹرز ایڈجسٹ کریں (`سیٹنگز > UI ظاہری شکل > اسٹائل سیٹنگز`)؛
- **اوورلے میڈیا برائٹنس**: بصری اثرات اوورلے میڈیا کی برائٹنس ایڈجسٹ کریں (`سیٹنگز > UI ظاہری شکل > بصری اثرات`)؛
- **بصری اثرات مکس بلینڈ موڈ**: بصری اثرات کے لیے مکس بلینڈ موڈ ایڈجسٹ کریں، جس سے آپ منتخب کر سکتے ہیں کہ بیک گراؤنڈ میڈیا ایپ UI کے ساتھ کیسے ملتا ہے (`سیٹنگز > UI ظاہری شکل > بصری اثرات`)؛
- **بیک گراؤنڈ ویڈیو روکیں**: جب ایپ غیر فعال یا منیمائز ہو تو ہوم بینر اور بیک گراؤنڈ ویڈیو روکیں (`سیٹنگز > UI ظاہری شکل > بصری اثرات`)؛
- **ڈیفالٹ فائل مینیجر**: Windows پر Sigma File Manager کو ڈیفالٹ فائل ایکسپلورر کے طور پر سیٹ کریں (`سیٹنگز > تجرباتی`)؛
- **سسٹم لاگ ان پر لانچ**: جب آپ اپنے سسٹم میں لاگ ان ہوں تو ایپ خودکار طور پر لانچ کریں (`سیٹنگز > عمومی > سٹارٹ اپ رویہ`)؛

### نئے شارٹ کٹس

- **موجودہ ڈائریکٹری پاتھ کاپی کریں** (`Ctrl+Shift+C`): موجودہ ڈائریکٹری پاتھ کو کلپ بورڈ پر کاپی کریں؛
- **موجودہ ڈائریکٹری ری لوڈ کریں** (`F5`): نیویگیٹر فائل لسٹ ریفریش کریں؛
- **زوم ان / آؤٹ** (`Ctrl+=` / `Ctrl+-`): UI زوم بڑھائیں یا کم کریں؛
- **فل سکرین** (`F11`): فل سکرین موڈ ٹوگل کریں؛

### نئی زبانیں

- **ہندی**؛
- **اردو**؛

### UX بہتریاں

#### کوئک ویو میں بہتری

- **میڈیا نیویگیشن**: کوئک ویو بند کیے بغیر موجودہ ڈائریکٹری میں فائلوں کے درمیان نیویگیٹ کریں؛
- **ٹیکسٹ فائل پریویو**: مناسب انکوڈنگ کی شناخت، ان لائن ایڈیٹنگ، اور پارس شدہ markdown رینڈرنگ کے ساتھ بہتر ٹیکسٹ فائل پریویو؛

#### فوری سرچ میں بہتری

- **تمام خصوصیات**: کسی بھی فائل خصوصیت سے تلاش کریں - نام، سائز، آئٹم شمار، ترمیم شدہ، تخلیق شدہ، رسائی شدہ، پاتھ، یا MIME قسم (مثلاً `modified: today`, `mime: image`)؛
- **سائز رینجز**: موازنوں اور رینجز کا استعمال کرتے ہوئے سائز سے فلٹر کریں (مثلاً `size: >=2mb`, `size: 1mb..10mb`)؛

#### فائل آپریشنز

- **تنازع حل تحفظ**: حادثاتی ڈیٹا نقصان کو روکنے کے لیے تنازع حل موڈل میں فائل سیفٹی میں بہتری؛
- **ایک بار پیسٹ**: کاپی کیے گئے آئٹمز صرف ایک بار پیسٹ کیے جا سکتے ہیں، حادثاتی ڈپلیکیٹ پیسٹ کو روکتے ہیں؛
- **ٹیکسٹ کاپی کریں**: جب کوئی فائل منتخب نہ ہو تو `Ctrl+C` سے UI ٹیکسٹ کاپی کرنے کی اجازت دیں؛

#### بصری اثرات

- **بیک گراؤنڈ مینیجر**: مرکزی بیک گراؤنڈ حسب ضرورت کے لیے سیٹنگز پیج میں بیک گراؤنڈ مینیجر شامل کیا گیا؛
- **بیک گراؤنڈ اثرات ری سیٹ**: بیک گراؤنڈ اثرات سیٹنگز میں ری سیٹ بٹن شامل کیا گیا؛

#### دیگر

- **ایپ سائز میں کمی**: ہائی ریزولوشن بلٹ ان بیک گراؤنڈز کو خارج کرکے اور میڈیا بینر ایڈیٹر میں کمپریسڈ پریویوز استعمال کرکے ایپ بنڈل سائز کم کیا گیا؛
- **گلوبل سرچ**: خالی حالت میں "سیٹنگز دکھائیں" بٹن ظاہر کریں اور ڈیفالٹ سرچ گہرائی بڑھائی؛
- **Windows شارٹ کٹس**: `.lnk` فائلیں اب بیرونی طور پر لانچ ہونے کے بجائے نیویگیٹر میں اپنا ہدف کھولتی ہیں؛
- **ڈیش بورڈ**: ٹیگ شدہ سیکشن لے آؤٹ میں بہتری؛
- **ایڈریس بار کانٹیکسٹ مینو**: ایڈریس بار آئٹمز میں کانٹیکسٹ مینو شامل کیا گیا؛
- **نیویگیٹر کانٹیکسٹ مینو**: نیویگیٹر میں خالی جگہ پر کلک کرنے پر کانٹیکسٹ مینو دکھائیں؛
- **نئے ٹیب میں کھولیں**: مڈل ماؤس کلک سے ڈائریکٹریز کو نئے ٹیب میں کھولیں؛
- **ٹیب سکرول**: نئے شامل کیے گئے ٹیبز کو خودکار طور پر نظر میں سکرول کریں؛
- **مینو فوکس**: باہر کلک کرکے بند کرنے پر مینوز اب اپنے ٹرگر بٹن پر فوکس واپس نہیں لوٹاتے؛
- **سرچ بند کریں**: `Escape` سے گلوبل سرچ بند کریں؛
- **تیز لانچ**: Rust میں سیٹنگز پری لوڈنگ کرکے ایپ لانچ سپیڈ میں معمولی بہتری؛
- **صارف ڈائریکٹریز**: ہوم پیج پر صارف ڈائریکٹریز شامل کرنے اور ہٹانے کی صلاحیت شامل کی گئی؛
- **لسٹ حدود**: کارکردگی میں بہتری کے لیے اکثر استعمال اور تاریخ لسٹ اندراجات کی حد کم کی گئی؛

### UI بہتریاں

- **ٹول بار آئیکنز**: ایپ میں ٹول بار آئیکن رنگوں کو یکجا کیا؛
- **کارڈ اینیمیشنز**: کارڈز میں اسٹیگر اور فیڈ ان اثرات شامل کیے؛
- **لائٹ تھیم**: لائٹ تھیم رنگوں اور کنٹراسٹ میں بہتری؛
- **لانچ استحکام**: جھلملاہٹ کم کرنے کے لیے ایپ لانچ کے دوران بصری استحکام میں بہتری؛
- **نوٹیفکیشنز**: بہتر مطابقت کے لیے نوٹیفکیشن ڈیزائن میں بہتری؛
- **ٹیب آٹو سکرول**: نیویگیٹر پیج کھولتے وقت منتخب ٹیب کو آٹو سکرول کریں؛
- **روٹ پاتھ لیبلز**: ٹیبز اور معلومات پینل میں روٹ پاتھ لیبلز کو معمول پر لایا؛
- **تراجم**: ایپ میں تراجم میں بہتری؛

### بگ فکسز

- بہت سے آئٹمز کاپی یا مو کرنے پر UI فریز ہونے کا مسئلہ حل کیا؛ اسٹیٹس سینٹر میں فائل آپریشن پیش رفت شامل کی؛
- بہت سے آئٹمز حذف کرنے پر UI فریز ہونے کا مسئلہ حل کیا؛ اسٹیٹس سینٹر میں حذف کرنے کی پیش رفت شامل کی؛
- گرڈ لے آؤٹ میں کانٹیکسٹ مینو نہ کھلنے کا مسئلہ حل کیا جب کسی اور آئٹم کا مینو پہلے سے کھلا ہو؛
- موجودہ ڈائریکٹری کے لیے معلومات پینل میں تمام معلومات نہ دکھانے کا مسئلہ حل کیا؛
- ایپ شارٹ کٹس مین ونڈو کے بجائے کوئک ویو ونڈو پر رجسٹر ہونے کا مسئلہ حل کیا؛
- ویب براؤزرز سے ڈریگ کی گئی فائلیں ہینڈل نہ ہونے کا مسئلہ حل کیا؛
- بیرونی URL ڈراپس سے فائل نیم میں درست حصے نہ رکھنے کا مسئلہ حل کیا؛
- ہوم بینر ڈریگ ہونے کے قابل ہونے کا مسئلہ حل کیا؛
- سسٹم آئیکن کیش فائل پاتھ کے مطابق کلیدی نہ ہونے کا مسئلہ حل کیا، جس سے غلط آئیکنز دکھتے تھے؛
- نیویگیٹر میں ناقابل رسائی Windows روٹ اندراجات دکھنے کا مسئلہ حل کیا؛
- بعض کی بورڈ لے آؤٹس پر کسٹم شارٹ کٹس نامعلوم ہونے کا مسئلہ حل کیا؛
- Linux پر SSHFS کنکشنز ٹھیک کیے؛
- بریڈ کرمب کلک پر ایڈریس بار میں ڈپلیکیٹ تاریخ اندراجات بننے کا مسئلہ حل کیا؛
- گلوبل سرچ نتائج کی بورڈ نیویگیشن پر ردعمل نہ دینے کا مسئلہ حل کیا؛
- گلوبل سرچ نتائج کلک پر نہ کھلنے کا مسئلہ حل کیا؛
- اضافی انڈیکسنگ کے بعد گلوبل سرچ اسٹیٹس سنک نہ ہونے کا مسئلہ حل کیا؛
- بعض ایپلیکیشنز میں آؤٹ باؤنڈ فائل ڈریگ اینڈ ڈراپ کام نہ کرنے کا مسئلہ حل کیا؛
- ایپ میں شارٹ کٹ بیج ڈیزائن میں عدم مطابقت کا مسئلہ حل کیا؛
- تنگ پینز میں نیویگیٹر کالم ویزیبلٹی کا مسئلہ حل کیا؛

---

## [2.0.0-beta.2] - February 2026

**خلاصہ:** گلوبل شارٹ کٹس، نئی سیٹنگز، نئی خصوصیات، بہتر فائل فلٹرنگ، بہتر ایڈریس بار، ہوم بینر بہتری، اور بگ فکسز۔

### گلوبل شارٹ کٹس

اب آپ کی بورڈ شارٹ کٹس استعمال کرکے ایپ کے فوکس میں نہ ہونے پر بھی اس کے ساتھ تعامل کر سکتے ہیں۔

شامل کیے گئے شارٹ کٹس:

- `Win+Shift+E` ایپ ونڈو دکھانے اور فوکس کرنے کے لیے؛

### نئی سیٹنگز

آخری ٹیب بند کرنے پر کیا ہوتا ہے یہ منتخب کرنے کے لیے سیٹنگ شامل کی گئی۔

![آخری ٹیب بند کرنے کی سیٹنگ](./public/changelog/assets/beta-2/setting-close-last-tab.png)

### نئی خصوصیات

نئی ابتدائی پریویو خصوصیات شامل کی گئیں:

- نیٹ ورک مقامات: آپ کو نیٹ ورک مقام کنکٹ کرنے کی اجازت دیتا ہے (SSHFS (SSH) / NFS / SMB / CIFS)؛
- [Linux] ڈرائیو ماؤنٹنگ: آپ کو مقامات کو ان ماؤنٹ کرنے کی اجازت دیتا ہے؛

### فائل فلٹر

فائل فلٹر میں بہتری کی گئی:
- اب جب آپ ڈائریکٹری تبدیل کرتے ہیں تو یہ خودکار طور پر صاف اور بند ہو جاتا ہے؛
- "ٹائپ پر فلٹر" خصوصیت پہلے والے کے بجائے منتخب پین میں فعال ہوتی ہے؛

### ایڈریس بار

- بہتر ڈیزائن اور آٹو کمپلیٹ لاجک؛
- پاتھ ڈیوائیڈرز اب ڈراپ ڈاؤن مینوز ہیں جو کسی بھی پیرنٹ ڈائریکٹری میں فوری نیویگیشن فراہم کرتے ہیں؛

![ڈیوائیڈر مینوز](./public/changelog/assets/beta-2/divider-menus.png)

### ہوم بینر / بیک گراؤنڈ اثرات

- بہتر میڈیا بینر ایڈیٹر ڈیزائن:
  - میڈیا بینر آپشنز مینو اب نظارے کو روکنے سے بچنے کے لیے نیچے کی طرف کھلتا ہے؛
  - اب آپ بیک گراؤنڈ پوزیشن ایڈیٹر بند کرنے کے لیے باہر کلک کر سکتے ہیں؛
  - URL ان پٹ کسٹم بیک گراؤنڈز کے اوپر منتقل کیا گیا؛
- کسٹم تصاویر/ویڈیوز بیک گراؤنڈ بصری اثرات میں استعمال کیے جا سکتے ہیں؛
- کچھ ڈیفالٹ میڈیا بینر تصاویر ہٹائی گئیں؛
- نئی بینر تصویر "Exile by Aleksey Hoffman" شامل کی گئی؛

### UX بہتریاں

- ایپ لانچ پر پچھلی ونڈو پوزیشن بحال کرتی ہے؛
- موجودہ ٹیب کو اب شارٹ کٹ `Ctrl+W` یا مڈل ماؤس کلک سے بند کیا جا سکتا ہے؛
- گرڈ لے آؤٹ ویو میں فائل آئیکن سائز بڑھایا؛

### بگ فکسز

- ٹیبز کے درمیان فائلیں مو کرنے پر بعض اوقات غلط مقام پر مو ہونے کا مسئلہ حل کیا؛
- نیویگیٹر میں ڈائریکٹریز کے لیے بعض اوقات غلط سسٹم آئیکنز دکھنے کا مسئلہ حل کیا؛
- متعدد ایپ اور ٹرے انسٹینسز بننے کا مسئلہ حل کیا؛
- شیل ایکسٹینشنز مینو وقتاً فوقتاً ڈیٹا دوبارہ حاصل کرنے کا مسئلہ حل کیا جو لسٹ کو ہر بار اوپر سکرول کرنے پر مجبور کر رہا تھا؛

## [2.0.0-beta.1] - February 2026

**خلاصہ:** اہم قابل استعمال اور ڈیزائن بہتری بشمول کی بورڈ نیویگیشن، نئے شارٹ کٹس، ٹرمینل میں کھولیں، ڈائریکٹری آٹو ریفریش، ڈریگ اینڈ ڈراپ، اور بہتر سرچ اور لسٹ ویوز۔

### کی بورڈ نیویگیشن

گرڈ اور لسٹ لے آؤٹس اور اسپلٹ ویو کے مکمل سپورٹ کے ساتھ کی بورڈ استعمال کرکے فائلیں نیویگیٹ کریں۔

- گرڈ ویو میں مقامی نیویگیشن اور لسٹ ویو میں ترتیبی نیویگیشن کے لیے ایرو کیز؛
- منتخب ڈائریکٹری یا فائل کھولنے کے لیے Enter، واپس جانے کے لیے Backspace؛
- اسپلٹ ویو پینز کے درمیان فوکس تبدیل کرنے کے لیے Ctrl+Left / Ctrl+Right؛
- موجودہ ڈائریکٹری کو نئے ٹیب میں کھولنے کے لیے Ctrl+T؛
- تمام نیویگیشن شارٹ کٹس سیٹنگز > شارٹ کٹس میں حسب ضرورت بنائے جا سکتے ہیں؛

### ڈائریکٹری آٹو ریفریش

جب موجودہ ڈائریکٹری میں فائلیں بنائی، حذف کی، نام تبدیل کی، یا ترمیم کی جاتی ہیں تو نیویگیٹر ویو خودکار طور پر ریفریش ہوتا ہے۔

- بیرونی ایپلیکیشنز کے ذریعے تبدیل ہونے پر فائل سائز خودکار طور پر اپ ڈیٹ ہوتے ہیں؛
- ضرورت سے زیادہ ریفریش سے بچنے کے لیے ڈی باؤنسنگ کے ساتھ موثر فائل سسٹم واچنگ؛
- سمارٹ ڈف پر مبنی اپ ڈیٹس صرف متاثرہ آئٹمز تبدیل کرتے ہیں، سکرول پوزیشن اور سلیکشن محفوظ رکھتے ہیں؛

### ڈریگ اینڈ ڈراپ

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/beta-1/drag-and-drop.mp4"></video>

اب آپ فائلیں اور فولڈرز آسانی سے کاپی/مو کرنے کے لیے انہیں ڈریگ کر سکتے ہیں۔ پینز کے درمیان، سرچ نتائج لسٹوں سے یا ان میں، بیرونی ایپس سے یا ان میں ڈریگ کریں۔

### کاپی تنازعات

آسان کاپی/مو تنازع حل کے لیے موڈل ونڈو شامل کی گئی۔

### آٹو اپ ڈیٹ

اپ ڈیٹس کی خودکار جانچ شامل کی گئی (سیٹنگز سے کنٹرول کیا جا سکتا ہے)۔

### ہوم بینر میڈیا ایڈیٹر

ہوم پیج بینر حسب ضرورت کے لیے ایڈیٹر شامل کیا گیا۔ اب آپ کسٹم تصاویر اور ویڈیوز اپ لوڈ کر سکتے ہیں (لوکل اور ریموٹ URL فائلیں دونوں معاون ہیں)

### لسٹ ویو بہتری

- بہتر ڈیزائن اور چھوٹی پریشانیاں ٹھیک کیں؛
- کالم ویزیبلٹی حسب ضرورت شامل کی: منتخب کریں کون سے کالم ظاہر کرنے ہیں؛
- کالم سارٹنگ شامل کی: اندراجات سارٹ کرنے کے لیے کالم ہیڈرز کلک کریں؛
- ڈیفالٹ نیویگیٹر لے آؤٹ لسٹ ویو میں تبدیل کیا گیا؛

### گلوبل سرچ بہتری

- ڈریگ اینڈ ڈراپ سپورٹ کے ساتھ اپ ڈیٹ شدہ لے آؤٹ اور ڈیزائن؛
- ڈرائیوز انڈیکس ہونے کے دوران بھی اب سرچ دستیاب ہے؛

### ٹرمینل میں کھولیں

کانٹیکسٹ مینو سے براہ راست اپنے پسندیدہ ٹرمینل میں ڈائریکٹریز کھولیں۔

- Windows، macOS، اور Linux پر انسٹال شدہ ٹرمینلز کی خودکار شناخت؛
- Windows Terminal ایگزیکیوٹیبل آئیکنز کے ساتھ تمام ترتیب شدہ شیل پروفائلز دکھاتا ہے؛
- Linux ڈیفالٹ ٹرمینل خودکار طور پر شناخت ہوتا ہے اور پہلے دکھایا جاتا ہے؛
- نارمل اور ایڈمن/ایلیویٹڈ موڈز شامل ہیں؛
- ڈیفالٹ شارٹ کٹ: Alt+T؛

### لوکلائزیشن

- سلووینین زبان شامل کی گئی (@anderlli0053 کا شکریہ)؛

### UI / UX بہتریاں

- فونٹ سلیکٹر شامل کیا: انسٹال شدہ سسٹم فونٹس سے UI فونٹ منتخب کریں؛
- فائلیں یا ڈائریکٹریز فوری طور پر بنانے کے لیے "نیا بنائیں" مینو شامل کیا؛
- خالی ڈائریکٹریز میں نیویگیٹ کرتے وقت خالی حالت ویو دکھانا؛
- لسٹ فلٹر ہونے پر اسٹیٹس بار چھپی ہوئی گنتی کے ساتھ کل آئٹمز دکھاتا ہے؛
- نئے بنائے، کاپی کیے، اور مو کیے گئے آئٹمز خودکار طور پر نظر میں سکرول ہوتے ہیں؛
- کلپ بورڈ ٹول بار ہر پین میں بجائے پینز کے نیچے ایک بار ظاہر؛
- نام تبدیل کریں موڈل ڈیزائن آسان بنایا؛
- چھوٹی ونڈو سائز پر ڈراپ ڈاؤن میں سمٹ جانے والے ریسپانسو ٹول بار آئیکنز؛
- سیٹنگز سے خالی "نیویگیشن" ٹیب ہٹایا؛
- ڈائریکٹری کا نام تبدیل کرنے پر اب تمام ٹیبز، ورک اسپیسز، پسندیدہ، ٹیگز، تاریخ، اور اکثر استعمال شدہ آئٹمز میں اس کا پاتھ اپ ڈیٹ ہوتا ہے؛
- فائل یا ڈائریکٹری حذف کرنے پر اب اسے تمام محفوظ لسٹوں سے ہٹا دیا جاتا ہے اور متاثرہ ٹیبز کو ہوم پر نیویگیٹ کیا جاتا ہے؛
- پسندیدہ، ٹیگز، تاریخ، اور اکثر استعمال شدہ آئٹمز میں غیر موجود پاتھز اب اسٹارٹ اپ پر آٹو کلین ہوتے ہیں؛

### بگ فکسز

- گلوبل سرچ انڈیکسنگ اسٹیٹس ریئل ٹائم میں اپ ڈیٹ نہ ہونے کا مسئلہ حل کیا؛
- اسپلٹ ویو پین دوسرے پین سے اس کی ڈائریکٹری حذف یا نام تبدیل کرنے پر اپ ڈیٹ نہ ہونے کا مسئلہ حل کیا؛
- محفوظ پاتھ موجود نہ ہونے پر ٹیبز خرابی کے ساتھ لوڈ ہونے کا مسئلہ حل کیا؛
- سسٹم آئیکنز تمام ایک ہی قسم کی فائلوں کے لیے فی فائل منفرد آئیکن کے بجائے ایک ہی آئیکن دکھانے کا مسئلہ حل کیا؛
- اسپلٹ ویو کے دوسرے پین میں کی بورڈ شارٹ کٹس کام نہ کرنے کا مسئلہ حل کیا؛
- پیج نیویگیشن کے بعد کی بورڈ شارٹ کٹس کام کرنا بند کرنے کا مسئلہ حل کیا؛
- ان ماؤنٹ پر فلٹر کی ڈاؤن لسنرز صاف نہ ہونے سے میموری لیک کا مسئلہ حل کیا؛
- Linux: "اس سے کھولیں" مینو میں ڈیفالٹ ایپ بازیابی کے لیے سپورٹ شامل کی؛

---

## [2.0.0-alpha.6] - January 2026

**خلاصہ:** نیا کیا ہے ونڈو، کوئک ویو، کانٹیکسٹ مینو بہتری، اور نئی سیٹنگز۔

### نیا کیا ہے ونڈو

ایک تبدیلی لاگ ونڈو جو ہر ریلیز کے لیے نئی خصوصیات اور بہتری دکھاتی ہے۔

- اپ ڈیٹس کے بعد خودکار طور پر ظاہر ہوتی ہے (غیر فعال کیا جا سکتا ہے)؛
- تمام ریلیزز براؤز کریں؛
- ہر خصوصیت کے لیے تفصیلی وضاحتیں اور اسکرین شاٹس دیکھیں؛

### کوئک ویو

ہلکی پریویو ونڈو استعمال کرکے فائلوں کو مکمل طور پر کھولے بغیر پریویو کریں۔

- فائلوں کو فوری طور پر دیکھنے کے لیے `Space` دبائیں یا کانٹیکسٹ مینو میں "کوئک ویو" آپشن منتخب کریں؛
- `Space` یا `Escape` سے فوری طور پر بند کریں۔
- تصاویر، ویڈیوز، آڈیو، ٹیکسٹ فائلز، PDFs، اور مزید کی سپورٹ؛

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/alpha-6/quick-view.mp4"></video>

### ڈائریکٹری سائز کیلکولیشن

- ڈائریکٹریز کا سائز اب خودکار طور پر شمار ہوتا ہے؛
- جیسے ہی آپ کوئی ڈائریکٹری کھولتے ہیں، آپ تمام سب ڈائریکٹریز اور فائلوں سمیت تمام ڈائریکٹریز کا کل سائز دیکھ سکتے ہیں؛

![اس سے کھولیں](./public/changelog/assets/alpha-6/size.png)

### نئے کانٹیکسٹ مینو آپشنز

#### اس سے کھولیں

- منتخب کریں کس ایپلیکیشن سے فائل کھولنی ہے؛
- فلیگز کے ساتھ ایپلیکیشنز میں فائلیں کھولنے کے لیے کسٹم پری سیٹس سیٹ اپ کریں؛
- کسی بھی فائل قسم کے لیے تمام ہم آہنگ ایپلیکیشنز دیکھیں؛
- مخصوص فائل اقسام کے لیے ڈیفالٹ ایپلیکیشنز سیٹ کریں؛

![اس سے کھولیں](./public/changelog/assets/alpha-6/open-with.png)

#### شیل ایکسٹینشنز

- Windows شیل کانٹیکسٹ مینو آئٹمز تک رسائی حاصل کریں؛
- تھرڈ پارٹی شیل ایکسٹینشنز (7-Zip, Git، وغیرہ) تک رسائی حاصل کریں؛

![شیل ایکسٹینشنز](./public/changelog/assets/alpha-6/shell-extensions.png)

### نئی سیٹنگز

#### ڈرائیو شناخت

- ریموویبل ڈرائیوز کنکٹ ہونے پر ایپ فوکس کرتی ہے (غیر فعال کیا جا سکتا ہے)؛
- ریموویبل ڈرائیوز کے لیے Windows Explorer آٹو اوپن رویہ کنٹرول کریں؛

#### ٹائپنگ پر فلٹر

موجودہ ڈائریکٹری میں آئٹمز کو فوری طور پر فلٹر کرنے کے لیے نیویگیٹر میں کہیں بھی ٹائپ کرنا شروع کریں؛

#### سیٹنگز سرچ شارٹ کٹ

سیٹنگز سرچ تک فوری رسائی کے لیے نیا کی بورڈ شارٹ کٹ؛

#### صارف شماریات ڈیٹا

- شماریات سیٹنگز سیکشن شامل کیا؛
- ڈیش بورڈ پیج پر آپ تاریخ، پسندیدہ، اور اکثر استعمال شدہ آئٹمز دیکھ، نیویگیٹ، اور صاف کر سکتے ہیں؛

### سرچ بہتری

زیادہ قابل اعتماد اور تازہ ترین نتائج کے لیے ہائبرڈ انڈیکسڈ + ڈائریکٹ سرچ سسٹم کے ساتھ بہتر گلوبل سرچ۔

- سرچ اب مسلسل 1 سیکنڈ سے کم وقت (~1 TB مکمل طور پر بھری ہوئی ڈرائیو) لیتی ہے، چاہے فائلیں آپ کی ڈرائیوز پر کہیں بھی ہوں؛
- جب آپ اپنے "ترجیحی پاتھز" (جنہیں آپ اکثر کھولتے ہیں) تلاش کرتے ہیں تو آپ کو فوری نتائج ملتے ہیں اور یہ فائلیں تب بھی ڈھونڈتا ہے جب وہ ابھی بنائی گئی ہوں اور ابھی تک انڈیکس نہ ہوئی ہوں۔

#### ترجیحی پاتھز میں شامل ہیں:
- صارف ڈائریکٹریز: ڈاؤن لوڈز، دستاویزات، ڈیسک ٹاپ، تصاویر، ویڈیوز، موسیقی؛
- پسندیدہ؛
- حال ہی میں کھولے گئے؛
- اکثر استعمال شدہ؛
- ٹیگ شدہ؛

---

## [2.0.0-alpha.5] - January 2026

**خلاصہ:** فائل آپریشنز، گلوبل سرچ، اور شارٹ کٹ حسب ضرورت۔

### گلوبل سرچ

طاقتور فل ڈسک سرچ جو آپ کی تمام ڈرائیوز پر فائلوں کو انڈیکس اور تلاش کرتی ہے۔ ٹائپو کے ساتھ بھی فائلیں ڈھونڈنے کے لیے فزی میچنگ، خودکار وقفے وقفے سے ری انڈیکسنگ، اکثر استعمال شدہ ڈائریکٹریز کے لیے ترجیحی انڈیکسنگ، اور تیز انڈیکسنگ کے لیے اختیاری پیرالل سکیننگ شامل ہے۔

![گلوبل سرچ](./public/changelog/assets/alpha-5/search.png)

### فائل آپریشنز

پیش رفت ٹریکنگ سمیت کاپی، مو، اور حذف فعالیت کے ساتھ مکمل فائل آپریشن سپورٹ۔ اس میں ان پلیس فائل اور فولڈر کا نام تبدیل کرنا بھی شامل ہے۔

### شارٹ کٹ ایڈیٹر

ایپ میں تمام کی بورڈ شارٹ کٹس حسب ضرورت بنائیں۔ موجودہ بائنڈنگز دیکھیں، تنازعات شناخت کریں، اور ڈیفالٹ پر ری سیٹ کریں۔

### نیویگیٹر بہتری

کم سے کم گلفس کے بجائے فائلوں اور ڈائریکٹریز کے لیے نیٹو سسٹم آئیکنز ظاہر کرنے کا آپشن شامل کیا۔ سکرول کرتے وقت سیٹنگز نیویگیشن ٹیبز اب صفحے پر مستحکم رہتے ہیں۔

---

## [2.0.0-alpha.4] - January 2026

**خلاصہ:** ہوم پیج، بصری اثرات، اور صارف حسب ضرورت آپشنز۔

### ہوم پیج

ایک خوبصورت ہوم پیج جس میں اینیمیٹڈ میڈیا بینر، ڈرائیو لسٹ، اور دستاویزات، ڈاؤن لوڈز، تصاویر، اور مزید جیسی عام صارف ڈائریکٹریز تک فوری رسائی شامل ہے۔

### بصری اثرات

سیٹنگز میں حسب ضرورت بصری اثرات سیکشن جو ایپ بیک گراؤنڈ میں بلر، اوپیسٹی، اور نوائز اثرات شامل کرتا ہے۔ ہر صفحے کے لیے مختلف سیٹنگز کی سپورٹ کرتا ہے۔

### صارف ڈائریکٹریز ایڈیٹر

اپنے صارف ڈائریکٹری کارڈز کو کسٹم عنوانات، آئیکنز، اور پاتھز کے ساتھ حسب ضرورت بنائیں۔ ہوم پیج پر اپنی فوری رسائی ڈائریکٹریز کی ظاہری شکل کو ذاتی بنائیں۔

### بینر پوزیشن ایڈیٹر

اپنے ہوم پیج بینر بیک گراؤنڈز کی پوزیشن کو باریکی سے ایڈجسٹ کریں۔ بہترین ظاہری شکل کے لیے زوم، افقی اور عمودی پوزیشننگ ایڈجسٹ کریں۔

### سیٹنگز بہتری

- سیٹنگز سرچ اب کسی بھی زبان میں کام کرتی ہے، صرف موجودہ زبان میں نہیں؛
- ایپ اب ری لوڈ پر پہلا ٹیب کھولنے کے بجائے آخری دیکھے گئے سیٹنگز ٹیب کو بحال کرے گی؛

---

## [2.0.0-alpha.3] - December 2025

**خلاصہ:** ٹیبز، ورک اسپیسز، اور نئے ڈیزائن سسٹم کے ساتھ نیویگیٹر ویو۔

### نیویگیٹر ویو

ورک اسپیسز کی سپورٹ کرنے والے جدید ٹیب سسٹم، انٹیگریٹڈ کنٹرولز کے ساتھ نئے ونڈو ٹول بار ڈیزائن، اور موثر فائل مینجمنٹ کے لیے دوہری پین نیویگیشن کے ساتھ بنیادی فائل براؤزنگ تجربہ۔

### ویڈیو تھمب نیلز

نیویگیٹر میں ویڈیو فائلوں کے لیے پریویو تھمب نیلز شامل کیے گئے۔

### ڈیزائن سسٹم مائیگریشن

بہتر کوڈ کوالٹی کے ساتھ زیادہ وسیع، جدید ڈیزائن کے لیے ایپ کو Vuetify سے Sigma-UI میں مائیگریٹ کیا گیا۔

---

## [2.0.0-alpha.1] - January 2024

**خلاصہ:** جدید ٹیکنالوجیز استعمال کرتے ہوئے مکمل تحریر نو۔

### Tauri مائیگریشن

Sigma File Manager v2 کو Vue 3 Composition API، TypeScript، اور Tauri v2 استعمال کرتے ہوئے شروع سے دوبارہ بنایا گیا ہے۔ Windows پر ایپ انسٹالیشن سائز 153 MB سے کم ہوکر صرف 4 MB رہ گیا۔ انسٹال شدہ ایپ سائز 419 MB سے کم ہوکر 12 MB رہ گیا۔

### ری سائزیبل پینز

ری سائزیبل پینز خصوصیت شامل کی گئی جو آپ کو نیویگیٹر ویو کو آدھے میں تقسیم کرنے اور 2 ڈائریکٹریز کے ساتھ ساتھ ساتھ کام کرنے کی اجازت دیتی ہے۔

### ابتدائی خصوصیات

ڈائریکٹری لسٹنگ کے ساتھ بنیادی فائل نیویگیشن، منیمائز، میکسیمائز، اور بند کنٹرولز کے ساتھ ونڈو مینجمنٹ، اور ابتدائی سیٹنگز پیج ڈھانچہ۔
