# Änderungsprotokoll

## [3.6.0] - October 2026

**Summary:** A file that Windows refuses to delete can now be dealt with from the right-click menu. Two entries were added. The first one asks Windows which program is holding the file open and shows you its name and process id, so you can tell an editor from a backup tool from a stuck service — and end one of them if that is what you want. The second one deletes the file anyway: it clears the read-only flag, then marks the file so that it disappears the moment the program holding it lets go, and if even that is refused, asks Windows to delete it at the next restart. If none of the three works, it says so plainly instead of pretending the file is gone. Neither entry needs anything extra installed — the Windows APIs that do the work were already part of the application's own dependencies.

### What changed

**Added: the right-click menu can now tell you what is holding a file open.** Delete a file and Windows says the operation cannot be completed because the file is open in another program, and leaves you there. The new *Unlock file* entry asks Windows which programs have the file open and lists them with their process ids. You can end one of them from the same dialog, and the application checks again afterwards whether the file can be deleted now. It never deletes anything itself: it clears what is in the way — the read-only flag and the programs holding the file — and then tells you the file is free.

**Added: the right-click menu can now delete a file that will not delete.** Some files refuse to be deleted no matter what you try: they are read-only, or a program holds them open without allowing the deletion. The new *Delete anyway* entry tries three things in order, cheapest first. It clears the read-only flag. If the file is still held, it marks the file for deletion, which makes it disappear as soon as the program holding it closes — no restart needed. If that is refused as well, it registers the file with Windows to be deleted at the next restart, which needs administrator rights. Every step reports what actually happened: a file that could not be deleted is reported as such, not as a success.

**Improved: the two new entries only appear where they can work.** They are shown on Windows, for a single item at a time, and never for a remote location — a file lock on a remote server is not something this machine can clear — nor for a virtual location or the root of a drive.

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

**Zusammenfassung:** Integration der System-Zwischenablage in andere Apps, Rahmenauswahl, verknüpfte geteilte Ansicht, Link-Verwaltung, passwortgeschützte ZIP-Archive, native Eigenschaften unter Windows, Erweiterungen der Extension-API, Unterstützung für Hebräisch und Verbesserungen am Navigator.

- [Neue Funktionen](#neue-funktionen)
  - [System-Zwischenablage](#system-zwischenablage)
  - [Rahmenauswahl](#rahmenauswahl)
  - [Verknüpfte geteilte Ansicht](#verknüpfte-geteilte-ansicht)
  - [Link-Verwaltung](#link-verwaltung)
  - [Native Eigenschaften](#native-eigenschaften)
  - [Spalten in der Listenansicht anpassen](#spalten-in-der-listenansicht-anpassen)
  - [Adresse „Standorte“](#adresse-standorte)
- [Erweiterungen](#erweiterungen)
  - [Extension-APIs und Ansichten](#extension-apis-und-ansichten)
- [Neue Einstellungen](#neue-einstellungen)
- [Neue Tastenkürzel](#neue-tastenkürzel)
- [Neue Sprachen](#neue-sprachen)
- [UX-Verbesserungen](#ux-verbesserungen)
  - [Archivextraktion](#archivextraktion)
  - [Raster-Sortierung](#raster-sortierung)
  - [Shell-Erweiterungen](#shell-erweiterungen)
  - [Sitzungsspeicher](#sitzungsspeicher)
  - [Navigator-Leistung](#navigator-leistung)
  - [Startseite und Kontextmenüs](#startseite-und-kontextmenüs)
- [UI-Verbesserungen](#ui-verbesserungen)
- [Fehlerbehebungen](#fehlerbehebungen)

### Neue Funktionen

#### System-Zwischenablage

Dateien, Ordner und Bilder lassen sich über die System-Zwischenablage zwischen Sigma File Manager und anderen Apps kopieren und einfügen.

- **Dateiübertragung zwischen Apps**: Elemente in SFM kopieren oder ausschneiden und in Apps wie den Datei-Explorer einfügen oder mit `Ctrl+V` Pfade und Dateien aus anderen Apps in den Navigator einfügen;
- **Bilder einfügen**: aus Browsern und anderen Apps kopierte Bilder direkt in einen Ordner einfügen;
- **Konfliktdialoge**: wenn eingefügte Elemente bereits vorhanden sind, `Umbenennen` oder `Zusammenführen` wählen und einzelne Dateikonflikte mit Ersetzen, Überspringen, Beide behalten oder Auf alle anwenden lösen;
- **Zwischenablage-Symbolleiste**: optionale Symbolleistenvorschau für Bilder und Dateipfade, die in anderen Apps kopiert wurden;

Die Symbolleiste lässt sich unter `Einstellungen > Erscheinungsbild > Zwischenablage` ein- und ausblenden. Das Einfügen mit `Ctrl+V` funktioniert auch bei ausgeblendeter Symbolleiste.

![system-clipboard](./public/changelog/assets/2.2.0/system-clipboard.webp)

#### Rahmenauswahl

Ziehen Sie im leeren Bereich des Navigators einen Auswahlrahmen auf, um mehrere Elemente auszuwählen.

- **Zusatztasten**: `Ctrl` oder `Shift` gedrückt halten, um Elemente zur aktuellen Auswahl hinzuzufügen; mit `Alt` wird die Auswahl umgekehrt;
- **Einfachere Auswahl**: optional die Abstände in Listen und Rastern vergrößern, damit sich der Auswahlrahmen leichter aufziehen lässt;

Aktivieren Sie diese Funktion unter `Einstellungen > Allgemein > Dateiansicht > Rahmenauswahl aktivieren`.

![box-selection](./public/changelog/assets/2.2.0/box-selection.webp)

#### Verknüpfte geteilte Ansicht

Der neue Modus `Verknüpft` vereinfacht Arbeitsabläufe in Spalten: Ein Klick auf einen Ordner im ersten Bereich zeigt dessen Inhalt im zweiten Bereich.

Der bestehende unabhängige Modus `Geteilt` bleibt unverändert. Der Modus lässt sich im Optionsmenü des Navigators unter `Modus der geteilten Ansicht` auswählen; mit `Ctrl+S` wird die geteilte Ansicht ein- oder ausgeschaltet.

Das Symbol des Infobereichs wurde ebenfalls aktualisiert, damit es sich leichter vom Symbol der geteilten Ansicht unterscheiden lässt.

![linked-split-view](./public/changelog/assets/2.2.0/linked-split-view.webp)

#### Link-Verwaltung

Im Navigator lassen sich Dateisystem-Links erstellen und prüfen.

- **Link erstellen**: symbolische Links, Verknüpfungen, Hardlinks und Junctions über das Kontextmenü erstellen (`Link erstellen`);
- **Link-Spalten**: optionale Listenspalten für Art, Links, Linkziel und Linkstatus (`Gültig`, `Defekt`, `Unbekannt`, `Nicht unterstützt`);
- **Öffnen**: Verzeichnisverknüpfungen und Symlink-Ordner führen zu ihren Zielen; andere Linkziele werden mit der Standard-App geöffnet;

![link-handling](./public/changelog/assets/2.2.0/link-handling.webp)

#### Native Eigenschaften

Unter Windows lässt sich der native Dialog `Eigenschaften` für ausgewählte Elemente über das Kontextmenü, das Aktionsmenü, `Alt+Enter` oder `Alt` + Doppelklick öffnen.

![native-properties](./public/changelog/assets/2.2.0/native-properties.webp)

#### Spalten in der Listenansicht anpassen

Spalten der Listenansicht können in der Breite geändert und neu angeordnet werden.

- **Größe ändern**: Spaltenränder ziehen, um die Breite zu ändern;
- **Reihenfolge und Sichtbarkeit**: Reihenfolge und Sichtbarkeit über das Menü `Spalten` in der Kopfzeile der Liste verwalten;
- **Breitenoptionen**: `Verfügbare Breite füllen` und `Mindestbreiten festlegen`;

![list-column-resize](./public/changelog/assets/2.2.0/list-column-resize.webp)

#### Adresse „Standorte“

Über die Stammadresse `Standorte` lassen sich Laufwerke und virtuelle Orte schneller aufrufen.

- **Adressleiste**: von der Stammebene eines Laufwerks eine Ebene nach oben wechseln oder `Standorte` über die Adressleiste oder den Adresseditor öffnen;
- **Favoriten und Tags**: Standorte können wie andere Verzeichnisse zu den Favoriten hinzugefügt und mit Tags versehen werden;
- **Geteilte Ansicht**: besonders nützlich, um Laufwerke zwischen Bereichen zu wechseln, ohne den Navigator zu verlassen;

![root-locations-address](./public/changelog/assets/2.2.0/root-locations-address.webp)

### Erweiterungen

#### Extension-APIs und Ansichten

Erweiterungen erhalten zusätzliche Hostfunktionen und UI-Bausteine.

- **Lokale Binärdateien**: Erweiterungsabhängigkeiten mit automatischer Einrichtung oder manuell gewählten lokalen Binärdateien konfigurieren (`Erweiterungen > Abhängigkeiten`);
- **HTTP-Anfragen**: Erweiterungen können HTTP-Anfragen an Hosts senden, die in ihrem Manifest erlaubt sind;
- **Ansichtssteuerung**: Erweiterungen können Layout- und Sortiereinstellungen des Navigators anwenden (mit der Berechtigung für Ansichten);
- **Zwischenablage-API**: Erweiterungen können die Zwischenablage lesen und schreiben (mit Berechtigung);
- **Listen-Detail-Ansicht**: neues UI-Muster für Erweiterungen mit einer Liste mit Suchfunktion und einem Detailbereich;

![extension-local-binaries](./public/changelog/assets/2.2.0/extension-local-binaries.webp)

![extension-dependency-config](./public/changelog/assets/2.2.0/extension-dependency-config.webp)

![extension-list-detail](./public/changelog/assets/2.2.0/extension-list-detail.webp)

![extension-http-api](./public/changelog/assets/2.2.0/extension-http-api.webp)

### Neue Einstellungen

- **Rahmenauswahl aktivieren**: in einem leeren Bereich ziehen, um mehrere Elemente auszuwählen;
  `Einstellungen > Allgemein > Dateiansicht > Rahmenauswahl aktivieren`
- **Abstände in der Dateiansicht vergrößern**: größere Abstände in Listen und Rastern erleichtern das Aufziehen eines Auswahlrahmens;
  `Einstellungen > Allgemein > Dateiansicht > Abstände in der Dateiansicht vergrößern`
- **Schnellansicht-Fenster im Speicher behalten**: Schnellansicht geladen halten, damit sie sich sofort öffnet (etwa 200 MB);
  `Einstellungen > Allgemein > Leistung > Schnellansicht-Fenster im Speicher behalten`
- **Druckfenster im Speicher behalten**: Druckfenster geladen halten, damit es sich sofort öffnet (etwa 200 MB);
  `Einstellungen > Allgemein > Leistung > Druckfenster im Speicher behalten`
- **Zwischenablage-Symbolleiste für externe Bilder**: Zwischenablage-Symbolleiste für in anderen Apps kopierte Bilder anzeigen;
  `Einstellungen > Erscheinungsbild > Zwischenablage`
- **Zwischenablage-Symbolleiste für externe Pfade**: Zwischenablage-Symbolleiste für in anderen Apps kopierte Dateipfade anzeigen;
  `Einstellungen > Erscheinungsbild > Zwischenablage`
- **Dynamische Größe des Infobereichs**: Größe des Infobereichs automatisch anpassen lassen oder die Funktion durch manuelles Ändern der Größe deaktivieren;
  `Einstellungen > Erscheinungsbild > Infobereich > Dynamische Größe des Infobereichs`
- **Bild in voller Größe in der Vorschau des Infobereichs anzeigen**: Bilder in voller Auflösung im Infobereich anzeigen;
  `Einstellungen > Erscheinungsbild > Infobereich > Bild in voller Größe in der Vorschau des Infobereichs anzeigen`
- **Videovorschau standardmäßig stummschalten**: Videovorschauen im Infobereich beim Durchsuchen stummschalten;
  `Einstellungen > Erscheinungsbild > Infobereich > Videovorschau standardmäßig stummschalten`
- **Videovorschauen automatisch abspielen**: Videos im Infobereich bei Auswahl automatisch abspielen;
  `Einstellungen > Erscheinungsbild > Infobereich > Videovorschauen automatisch abspielen`

### Neue Tastenkürzel

- **Native Eigenschaften** (`Alt+Enter`): unter Windows den nativen Eigenschaften-Dialog für ausgewählte Elemente öffnen;

### Neue Sprachen

- **Hebräisch** (`עברית`): vollständige Übersetzung mit Rechts-nach-links-Layout (`Einstellungen > Allgemein > Sprache`);

### UX-Verbesserungen

#### Archivextraktion

Die ZIP-Extraktion unterstützt jetzt verschlüsselte Archive und Dateinamen mit einer anderen Kodierung als UTF-8.

- **Passwortgeschützte ZIP-Archive**: Archivpasswort eingeben, wenn die Extraktion es erfordert;
- **Dateinamenskodierung**: Kodierung unter `Optionen zur Archivextraktion` auswählen; die automatische Erkennung wird bevorzugt, regional gruppierte Kodierungen stehen als Alternativen zur Verfügung;

![archive-extraction-options](./public/changelog/assets/2.2.0/archive-extraction-options.webp)

![archive-extraction-encoding](./public/changelog/assets/2.2.0/archive-extraction-encoding.webp)

#### Raster-Sortierung

Das Rasterlayout verfügt jetzt über eigene Steuerelemente zum Sortieren im Optionsmenü des Navigators.

- **Sortieren nach**: Name, Elemente, Größe, Geändert, Erstellt, Tags, Art, Links und Linkstatus;
- **Richtung**: aufsteigend oder absteigend, getrennt von der Sortierung der Listenansicht gespeichert;

![grid-sorting](./public/changelog/assets/2.2.0/grid-sorting.webp)

#### Shell-Erweiterungen

Das Kontextmenü kann moderne Aktionen von Shell-Erweiterungen laden, die andere Apps unter `Shell-Erweiterungen` registriert haben.

![shell-extensions](./public/changelog/assets/2.2.0/shell-extensions.webp)

#### Sitzungsspeicher

Scrollpositionen und aktive Tabs werden wiederhergestellt, wenn Sie während derselben Sitzung eine Seite oder einen Bereich verlassen und zurückkehren.

#### Navigator-Leistung

Das Durchsuchen großer Ordner und Medien ist schneller und speicherschonender.

- **Erstmaliges Laden**: Verzeichnisse werden beim ersten Öffnen schneller geladen;
- **Symbole laden**: benutzerdefinierte Symbole und Systemsymbole erscheinen schneller;
- **Scrollen in Listen**: flüssigeres Scrollen in großen Verzeichnissen;
- **Medienvorschauen**: Bild-, GIF- und Videovorschauen reagieren schneller und nutzen weniger Speicher;
- **Indexierung**: stabilere globale Suchindexierung;

#### Startseite und Kontextmenüs

- **Trennen**: Netzwerkverbindungen oder Wechseldatenträger über das Kontextmenü trennen, sofern dies unterstützt wird;
- **Alle Duplikate schließen**: der Tab-Menüpunkt `Alle Duplikate schließen` schließt jetzt alle mehrfach geöffneten Pfade im Arbeitsbereich, nicht nur Duplikate des aktuellen Tabs;
- **Auswahl per Rechtsklick aufheben**: ein Rechtsklick auf den leeren Hintergrund des Navigators hebt die aktuelle Auswahl auf, bevor das Hintergrundmenü geöffnet wird;
- **Startseiten-Aktionen**: Kontextmenüs der Startseite schließen sich nach dem Ausführen einer Aktion, `In neuem Tab öffnen` öffnet den Navigator und die Tab-Leiste scrollt automatisch zu neuen Tabs;
- **Ziehbereich des Fensters**: bei Titelleisten im Linux-Stil erstreckt sich der Ziehbereich über die Schaltflächen der Symbolleiste, damit sich das Fenster leichter verschieben lässt;

![window-drag-region](./public/changelog/assets/2.2.0/window-drag-region.webp)

### UI-Verbesserungen

- **Anzeige des aktiven Bereichs**: klarere Markierung des aktiven Bereichs in der Statusleiste bei aktivierter geteilter Ansicht;
- **Größe des Infobereichs änderbar**: Breite des Infobereichs und Aufteilung zwischen Vorschau und Details durch Ziehen anpassen;
- **Kompakter Infobereich**: dichteres Eigenschaftslayout im Infobereich;
- **Kontextmenü-Aktionen**: `Karte bearbeiten` wird als Aktionsschaltfläche angezeigt; außerdem sind alle Aktionsschaltflächen kleiner;
- **Darstellung des Navigators**: verbessertes adaptives Layout, deutlichere Hervorhebung aktiver Tabs in der geteilten Ansicht und überarbeitete Erweiterungsansicht in der Befehlspalette;
- **RTL-Layout**: sauberere Ausrichtung für Rechts-nach-links-Sprachen;

![resizable-info-panel](./public/changelog/assets/2.2.0/resizable-info-panel.webp)

![compact-info-panel](./public/changelog/assets/2.2.0/compact-info-panel.webp)

### Fehlerbehebungen

- **Suche beim Tippen**: die Schnellsuche wird jetzt auch bei nicht-lateinischen Tastaturlayouts aktiviert;
- **Verzeichnis laden**: Einträge werden nach dem Laden eines Verzeichnisses nicht mehr neu angeordnet;
- **Benutzerdefinierte Symbole**: benutzerdefinierte Symbole laden ohne spürbare Verzögerung;
- **Rasterkarten**: Rasterlayout-Karten ändern ihre Größe beim Laden nicht mehr;
- **Raster-Scrollleiste**: Raster-Scrollleiste versteckt sich nicht mehr hinter fixierten Kopfzeilen;
- **Schnellauswahl**: bei der Schnellauswahl von Dateien wird nicht mehr versehentlich eine Datei geöffnet;
- **Terminal-Kürzel**: `Alt+T` öffnet das Terminal jetzt für den ausgewählten Eintrag und nicht mehr für das aktuelle Verzeichnis;
- **Dateien öffnen**: Dateien werden jetzt mit dem richtigen Arbeitsverzeichnis geöffnet;
- **SMB-Freigaben**: Dateien auf SMB-Freigaben können wieder geöffnet werden;
- **WSL-Pfade**: Verarbeitung von UNC-Pfaden des WSL-Hosts unter Windows korrigiert, einschließlich `//wsl.localhost` als virtuelle Liste der Distributionen;
- **Standard-Dateimanager**: Die Einstellung bleibt für direkte Windows-Installationen verfügbar; in der Microsoft Store-Version wird sie als nicht verfügbar angezeigt;
- **AppImage (Linux)**: `Could not create default EGL display: EGL_BAD_PARAMETER` behoben;
- **Erweiterungsinstallation (Linux)**: Installationsfehler bei Erweiterungen mit mehreren Dateien im Verzeichnis `dist` behoben;
- **Erweiterungsdetails**: Ausrichtung der Übersichtsseite korrigiert;
- **Geräte-Aufwachen**: App bleibt nach dem Aufwachen des Geräts nicht mehr im Ladezustand stecken;
- **Update-Benachrichtigungen**: Update-Benachrichtigungen erscheinen nicht mehr für unveröffentlichte Versionen;
- **RTL**: Probleme mit dem Rechts-nach-links-Layout behoben;
- **Übersetzungen**: fehlende und fehlerhafte Übersetzungstexte korrigiert;

---

## [2.1.0] - May 2026

**Zusammenfassung:** Leistungsverbesserungen im Navigator, generierte Miniaturansichten, Erweiterungsthemen, Drucken, Dateivorschauen, neue Tastenkürzel, Verbesserungen am Adresseditor, Neugestaltung des Statuscenters sowie Verfeinerungen von Tabs und Navigation.

- [Neue Funktionen](#neue-funktionen)
  - [Drucken](#drucken)
  - [Dateien auf Tabs ziehen](#dateien-auf-tabs-ziehen)
  - [Dateivorschau im Infobereich](#dateivorschau-im-infobereich)
  - [Navigator-Listenspalten](#navigator-listenspalten)
- [Erweiterungen](#erweiterungen)
  - [App-Themes aus Erweiterungen](#app-themes-aus-erweiterungen)
  - [Symbol-Themes aus Erweiterungen](#symbol-themes-aus-erweiterungen)
- [Neue Einstellungen](#neue-einstellungen)
- [Neue Tastenkürzel](#neue-tastenkürzel)
- [UX-Verbesserungen](#ux-verbesserungen)
  - [Leistung bei großen Verzeichnissen](#leistung-bei-großen-verzeichnissen)
  - [Schnellsuche](#schnellsuche)
  - [Adresseditor](#adresseditor)
  - [Statuscenter](#statuscenter)
  - [Navigation und Tabs](#navigation-und-tabs)
  - [Tastenkürzel-Verwaltung](#tastenkürzel-verwaltung)
- [UI-Verbesserungen](#ui-verbesserungen)
- [Fehlerbehebungen](#fehlerbehebungen)

### Neue Funktionen

#### Drucken

Ausgewählte Dateien lassen sich direkt aus dem Navigator über das Kontextmenü, das Aktionsmenü oder `Ctrl+O` drucken.

- **Unterstützte Formate**: Bilder, PDF-Dateien und Textdateien;
- **Schnelles Beenden**: Druckansicht mit `Escape` schließen;

![printing](./public/changelog/assets/2.1.0/printing.webp)

#### Dateien auf Tabs ziehen

Dateien oder Verzeichnisse lassen sich auf Tabs ziehen, um sie in das Verzeichnis eines anderen Tabs zu verschieben oder zu kopieren.

- **Tabs als Ablageziel**: Tabs werden beim Ziehen von Dateien im Navigator zu Zielen für Drag-and-drop;
- **Aktivierung beim Überfahren**: verweilt der Mauszeiger während des Ziehens über einem Tab, kann vor dem Ablegen zu diesem Tab gewechselt werden;
- **Geteilte Tabs**: Tabgruppen für Verzeichnisse behalten ihr normales Ablegeverhalten und die Tab-Struktur der geteilten Ansicht bei;

![file-drop-to-tabs](./public/changelog/assets/2.1.0/file-drop-to-tabs.webp)

#### Dateivorschau im Infobereich

Der Infobereich kann jetzt Vorschauen für alle von der Schnellansicht unterstützten Dateitypen anzeigen, nicht nur für Bilder und Videos.

- **Medienvorschauen**: Bilder nutzen generierte Miniaturansichten, Videos und Audiodateien bieten native Bedienelemente und PDF-Dateien werden direkt im Infobereich dargestellt;
- **Textvorschauen**: Textdateien zeigen eine kompakte dekodierte Vorschau mit einer sinnvollen Größenbegrenzung;
- **Ersatzdarstellung**: nicht unterstützte Dateien und Ordner werden weiterhin durch einfache Symbole dargestellt;

![info-panel-file-preview](./public/changelog/assets/2.1.0/info-panel-file-preview.webp)

#### Navigator-Listenspalten

Die Listenansicht bietet mehr optionale Spalten und eine bessere direkte Verwaltung von Metadaten.

- **Spalte `Erstellt`**: Erstellungsdatum anzeigen und danach sortieren;
- **Spalte `Tags`**: Tags direkt in der Listenansicht anzeigen und über die Spalte hinzufügen, entfernen oder bearbeiten;

![navigator-list-columns](./public/changelog/assets/2.1.0/navigator-list-columns.webp)

### Erweiterungen

#### App-Themes aus Erweiterungen

Erweiterungen können jetzt vollständige Farbschemas für die App bereitstellen. Installierte Theme-Erweiterungen erscheinen in der Theme-Auswahl.

#### Symbol-Themes aus Erweiterungen

Erweiterungen können jetzt Symbol-Themes für Ordner und Dateien im Navigator bereitstellen.

- **Getrennte Auswahl**: Ordner- und Datei-Symbolthemes separat unter `Einstellungen > Erscheinungsbild > Symbol-Theme` auswählen;
- **Integrierte und Erweiterungs-Themes**: das mitgelieferte Standard- oder System-Symboltheme sowie jedes aktivierte Erweiterungs-Theme verwenden;
- **Theme-Zuordnung**: bereitgestellte Themes können Symbole anhand von Dateierweiterung, Dateiname, Ordnername und geöffnetem Ordnerzustand definieren;

### Neue Einstellungen

- **Fetter Text des aktiven Tabs**: Titel des aktiven Tabs fett darstellen (`Einstellungen > Tabs > Tab-Erscheinungsbild > Fetter Text des aktiven Tabs`);

![bold-active-tab-text-setting](./public/changelog/assets/2.1.0/bold-active-tab-text-setting.webp)

### Neue Tastenkürzel

- **Geteilte Ansicht umschalten** (`Ctrl+S`): geteilte Ansicht im Navigator ein- oder ausblenden;
- **Geschlossenen Tab wiederherstellen** (`Ctrl+Shift+T`): die zuletzt geschlossene Tabgruppe wiederherstellen;
- **Datei / Verzeichnis erstellen** (`Ctrl+Shift+M` / `Ctrl+Shift+N`): eine neue Datei oder ein neues Verzeichnis im aktuellen Verzeichnis erstellen;
- **Ausgewählte Datei drucken** (`Ctrl+O`): die ausgewählte Datei drucken;
- **Kopierten Pfad öffnen** (`Ctrl+Shift+V`): einen gültigen Pfad aus der Zwischenablage öffnen;
- **Seiten wechseln** (`Alt+1` - `Alt+5`): zwischen Startseite, Navigator, Dashboard, Einstellungen und Erweiterungen wechseln;
- **Im Verzeichnisverlauf navigieren** (`Alt+Left` / `Alt+Right`): im Navigator-Verlauf zurück oder vorwärts gehen;
- **Zum übergeordneten Verzeichnis** (`Alt+Up`): zum übergeordneten Verzeichnis gehen;
- **Maustasten für den Verlauf** (`Mouse Button 4` / `Mouse Button 5`): mit den Seitentasten der Maus zurück und vorwärts navigieren;

![create-file-directory-shortcuts](./public/changelog/assets/2.1.0/create-file-directory-shortcuts.webp)

![navigator-shortcuts](./public/changelog/assets/2.1.0/navigator-shortcuts.webp)

### UX-Verbesserungen

#### Leistung bei großen Verzeichnissen

Navigation, Schnellsuche und medienreiche Ordner reagieren schneller und nutzen weniger Speicher.

- **Generierte Miniaturansichten**: Miniaturansichten für Bilder und Videos werden in kleineren Abmessungen erzeugt, sodass nicht mehr die vollständigen Mediendateien für jede Dateikarte geladen werden;
- **Progressive Bilder**: Bildkarten im Raster können eine unscharfe, niedrig aufgelöste Miniaturansicht zeigen, bevor die endgültige Miniaturansicht bereit ist;
- **Erzeugung abbrechen**: die Erzeugung von Miniaturansichten kann abgebrochen werden, wenn sich der Ordner oder die sichtbaren Einträge ändern;
- **Darstellungsleistung**: Einträge in großen Verzeichnissen werden effizienter dargestellt und die Schnellansicht nutzt generierte Miniaturansichten in einer virtuellen Liste;

![low-res-image-thumbnail-preview](./public/changelog/assets/2.1.0/low-res-image-thumbnail-preview.webp)

#### Schnellsuche

Die Schnellsuche bietet jetzt zwei Modi: passiv und aktiv:

- **Passiver Modus**: wird beim Tippen automatisch aktiviert, filtert Einträge, ohne den Eingabefokus in das Suchfeld zu setzen, und behindert die Navigation nicht;
- **Aktiver Modus**: wird mit `Ctrl+F` aktiviert, setzt den Eingabefokus in das Suchfeld und verhindert die Navigation, ermöglicht dafür aber eine genauere Steuerung der Suchanfrage;

Weitere Änderungen:

- **Tippen zum Filtern**: alphanumerische Tasten starten jetzt immer die Schnellsuche (passiver Modus) im aktiven Bereich;
- **Tastaturnavigation**: der erste passende Eintrag wird automatisch ausgewählt;
- **Suchfenster**: das Schnellsuche-Fenster ist kompakter und verdeckt weniger Verzeichniseinträge;

![quick-search](./public/changelog/assets/2.1.0/quick-search.webp)

#### Adresseditor

Mit dem Adresseditor lassen sich jetzt nicht nur Verzeichnisse, sondern generell Pfade öffnen.

- **Dateien und Verzeichnisse**: Dateien sowie Verzeichnisse aus dem Adresseditor öffnen;
- **Häufige Pfade**: in einen Modus zum schnellen Öffnen häufig genutzter Pfade wechseln;
- **Vorschläge**: Verzeichniseinträge, exakte Treffer, zuletzt verwendete Pfade, mit Tags versehene Elemente, Benutzerordner und Systemlaufwerke durchsuchen;
- **Tastaturaktionen**: im Editor zurück, vorwärts und nach oben navigieren sowie einen Eintrag im übergeordneten Verzeichnis anzeigen;

![address-editor](./public/changelog/assets/2.1.0/address-editor.webp)

#### Statuscenter

Das Statuscenter ist jetzt eine kompakte Komponente in der Symbolleiste mit übersichtlicheren Vorgangsgruppen.

- **Anzahl aktiver Vorgänge**: die Schaltfläche in der Symbolleiste erweitert sich zu einer pillenförmigen Anzeige mit der Anzahl aktiver Vorgänge;
- **Vorgangsgruppen**: aktive und abgeschlossene Vorgänge sind getrennt; abgeschlossene Vorgänge befinden sich in einem einklappbaren Bereich;
- **Alle abbrechen**: aktive Vorgänge gleichzeitig über die Kopfzeile des Bereichs abbrechen;
- **Vorgangskarten**: Vorgangskarten zeigen deutlichere Typ- und Statusbezeichnungen wie `Kopieren | Erfolg` oder `Archiv | Fehler`;
- **Wiederherstellung der Zwischenablage**: beim Einfügen wird die Zwischenablage geleert, sobald ein Vorgang in die Warteschlange gestellt wird, und bei einem Fehlschlag wiederhergestellt;

![status-center](./public/changelog/assets/2.1.0/status-center.webp)

#### Navigation und Tabs

Die Navigation und das Verhalten der Tabs sind jetzt vorhersehbarer.

- **Laufwerke in der Seitenleiste**: ein Klick auf ein Laufwerk in der Navigationsseitenleiste öffnet es im aktuellen Tab;
- **Aktuelles Verzeichnis**: der aktuelle Abschnitt der Adresse wird deutlicher hervorgehoben; sein Kontextmenü öffnet sich per Rechtsklick auf den letzten Abschnitt;
- **Geschlossene Tabs**: wiederhergestellte Tabs kehren an ihre vorherige Position zurück, behalten umbenannte Pfade und leiten gelöschte Pfade zur Startseite um;
- **Adaptives Layout**: Navigationsschaltflächen der Symbolleiste werden früher eingeklappt, Adressleisten der geteilten Ansicht wechseln in sehr schmalen Bereichen in eine zweite Zeile und kompakte Tabs behalten eine einheitliche Höhe;

![nav-sidebar-drive-current-tab](./public/changelog/assets/2.1.0/nav-sidebar-drive-current-tab.webp)

![current-directory-address-bar](./public/changelog/assets/2.1.0/current-directory-address-bar.webp)

#### Tastenkürzel-Verwaltung

Bei der Bearbeitung von Tastenkürzeln werden Konflikte und Anpassungen jetzt übersichtlicher behandelt.

- **Mehrere Tastenbelegungen**: einer Aktion mehrere Tastenkürzel zuweisen;
- **Belegungen aufheben**: die Zuweisung von Tastenkürzeln aufheben;
- **Konflikt ersetzen**: ein kollidierendes Tastenkürzel direkt über die Konfliktmeldung ersetzen;
- **Menü der Tastenkürzelliste**: Tastenkürzel über ein Kontextmenü in der Tastenkürzelliste verwalten;

![shortcut-editor](./public/changelog/assets/2.1.0/shortcut-editor.webp)

#### Drag-and-drop

Beim Ziehen kann jetzt mit `Alt+Tab` zu einer anderen App gewechselt werden. Dateien lassen sich dadurch aus Sigma File Manager herausziehen, ohne dass der Mauszeiger das Fenster verlassen muss;

### UI-Verbesserungen

- **Auswahlring**: Deckkraft und Versatz des Auswahlrings sowie die Darstellung der Bereichskopfzeile und das Verhalten des Tastaturfokus verbessert;
- **Tab-Leiste**: Darstellung der Tab-Leiste und Lesbarkeit des aktiven Tabs verbessert;
- **Theme-Auswahl**: verbessertes Design der Theme-Auswahl;
- **Schnellzugriff**: Darstellung des Schnellzugriffspanels verfeinert;
- **Startbildschirm**: beim App-Start wird jetzt ein Startbildschirm angezeigt;
- **Sichtbarkeit von Einblendmenüs**: Sichtbarkeit durchscheinender Elemente in Einblendmenüs verbessert;
- **Tooltips**: Tooltips zu weiteren Symbolleistenschaltflächen hinzugefügt;
- **Übersetzungen**: japanische und vietnamesische Texte verbessert und Lokalisierungsstruktur bereinigt;

![selection-ring](./public/changelog/assets/2.1.0/selection-ring.webp)

![tab-bar-styles](./public/changelog/assets/2.1.0/tab-bar-styles.webp)

![narrow-window-layout](./public/changelog/assets/2.1.0/narrow-window-layout.webp)

### Fehlerbehebungen

- **Zugeordnete Laufwerke**: Drag-and-drop aus zugeordneten Netzwerklaufwerken funktioniert wieder;
- **Scrollen mit der Tastatur**: die erste Zeile wird nicht mehr von der fixierten Kopfzeile verdeckt;
- **Einfrieren beim Start**: seltenes, mehrere Minuten langes Einfrieren unter Windows behoben, das durch langsame synchrone Systemaufrufe beim Start und bei Update-Prüfungen verursacht wurde;
- **Archivextraktion**: Unix-Dateimodi beim Extrahieren von Archiven beibehalten;
- **HTTP für Erweiterungen**: Verarbeitung dauerhaft fehlschlagender Nicht-2xx-Antworten wiederhergestellt und Wartezeiten vor erneuten Versuchen abbrechbar gemacht;
- **Befehlspalette**: Schaltfläche der Befehlspalette in der Symbolleiste bei geändertem Tastenkürzel korrigiert;
- **Raster-Bereichsauswahl**: die Bereichsauswahl in der Rasteransicht wählt keine Einträge über den ausgewählten Bereich hinaus mehr aus;
- **Kontextmenüs**: Kontextmenüs für ausgewähltes Element und aktuelles Verzeichnis bleiben nach Aktionsklicks nicht mehr offen;
- **Tastenkürzel-Registrierung**: Fehler bei der Registrierung von Tastenkürzeln nach dem Neuladen eines Fensters behoben;
- **Theme-Anwendung**: ausgewählte Themes werden in allen Fenstern angewendet;
- **Verschieben unter macOS**: Verarbeitung von Verschiebungen zwischen Volumes unter macOS korrigiert und Bundle-Ziele aktiviert;
- **Standard-Dateimanager**: vorherige Windows-Registry-Werte des Standard-Dateimanagers werden jetzt sicherer wiederhergestellt, wenn die Aktivierung fehlschlägt;

![keyboard-scroll-floating-header](./public/changelog/assets/2.1.0/keyboard-scroll-floating-header.webp)

---
## [2.0.0-beta.3] - April 2026

**Zusammenfassung:** Erweiterungssystem mit Marketplace, Dateifreigabe im lokalen Netzwerk, Schnellzugriffsmenü, Zip-Archive, WSL-Laufwerke, Tag-Bearbeitung, verbesserter Schnellansicht und Suche, Verbesserungen der visuellen Effekte sowie zahlreiche UX- und Stabilitätsverbesserungen.

- [Neue Funktionen](#neue-funktionen)
  - [Erweiterungssystem](#erweiterungssystem)
  - [Standard-Dateimanager](#standard-dateimanager)
  - [Freigabe im lokalen Netzwerk](#freigabe-im-lokalen-netzwerk)
  - [Schnellzugriffsmenü](#schnellzugriffsmenü)
  - [Zip-Archive](#zip-archive)
  - [WSL-Laufwerkserkennung](#wsl-laufwerkserkennung)
  - [Tag-Bearbeitung](#tag-bearbeitung)
  - [In-App-Updates](#in-app-updates)
  - [Pfad kopieren](#pfad-kopieren)
  - [Doppelte Tabs schließen](#doppelte-tabs-schließen)
  - [Kontextmenüs für Startseite und Dashboard](#kontextmenüs-für-startseite-und-dashboard)
  - [Mischmodus für visuelle Effekte](#mischmodus-für-visuelle-effekte)
- [Neue Einstellungen](#neue-einstellungen)
- [Neue Tastenkürzel](#neue-tastenkürzel)
- [Neue Sprachen](#neue-sprachen)
- [UX-Verbesserungen](#ux-verbesserungen)
  - [Verbesserungen der Schnellansicht](#verbesserungen-der-schnellansicht)
  - [Verbesserungen der Schnellsuche](#verbesserungen-der-schnellsuche)
  - [Dateioperationen](#dateioperationen)
  - [Visuelle Effekte](#visuelle-effekte)
- [UI-Verbesserungen](#ui-verbesserungen)
- [Fehlerbehebungen](#fehlerbehebungen)

### Neue Funktionen

#### Erweiterungssystem

Vollständiges Erweiterungssystem mit offenem Marketplace.

- **Marketplace**: Erweiterungen aus dem Marketplace durchsuchen, installieren und verwalten;
- **Lokale Installation**: Sie können Erweiterungen aus einem lokalen Ordner installieren;
- **Befehlspalette**: neue Möglichkeit, App- und Erweiterungsbefehle zu aktivieren;
- **Funktionen**: Erweiterungen können lokale und globale Tastenkürzel, Kontextmenüelemente, Einstellungen, ganze Seiten und Befehle registrieren;
- **Versionierung**: Sie können verschiedene Versionen von Erweiterungen installieren und automatische Updates aktivieren;
- **Lokalisierung**: Erweiterungen können Übersetzungen für verschiedene Sprachen bereitstellen;
- **Binärverwaltung**: Erweiterungen können Binärdateien verwenden (ffmpeg, deno, node, yt-dlp, 7z und jede andere existierende Binärdatei);
- **Isolierte Ausführung**: Erweiterungen laufen in isolierten ESM-Sandboxen mit granularen Berechtigungen;

#### Standard-Dateimanager

Sie können SFM jetzt unter Windows als Standard-Dateimanager festlegen (`Einstellungen > Experimentell`). Wenn diese Einstellung aktiviert ist, werden die meisten Systemdateiaktionen an SFM weitergeleitet:

- Datei-Explorer App-Symbol;
- Tastenkürzel `Ctrl+E`;
- Datei im Ordner anzeigen;
- Downloads anzeigen (wenn Sie eine Datei im Browser herunterladen);
- Terminal-Befehle: "start {Pfad}", "code {Pfad}", etc.
- Und mehr;

Native Systemansichten wie „Papierkorb", „Systemsteuerung" und andere tief integrierte Programme werden an den nativen Datei-Explorer delegiert.

#### Freigabe im lokalen Netzwerk

Teilen und streamen Sie Dateien und Verzeichnisse über Ihr lokales Netzwerk direkt aus der App.

Greifen Sie auf die LAN-Freigabe über die Schaltfläche in der Symbolleiste des Navigators oder über das Kontextmenü einer beliebigen Datei oder eines Verzeichnisses zu. Wenn eine Freigabe aktiv ist, werden ein QR-Code und teilbare URLs angezeigt. Zwei Modi sind verfügbar:

- **Streaming**: Dateien und Verzeichnisse auf jedes Gerät in Ihrem Netzwerk über einen Webbrowser streamen;
- **FTP**: Dateien über FTP für den direkten Zugriff aus anderen Apps freigeben. Sie können sowohl Dateien vom und zum Computer von einem anderen Gerät herunterladen als auch hochladen;

#### Schnellzugriffsmenü

Die Schaltfläche „Dashboard" in der Seitenleiste fungiert jetzt als Schnellzugriffsmenü. Wenn Sie darüber fahren, öffnet sich ein Panel mit Ihren Favoriten und markierten Elementen.

Alle Elemente im Panel sind echte Verzeichniseinträge – Sie können Elemente per Drag & Drop verschieben, Kontextmenüs per Rechtsklick öffnen und alle Standard-Dateioperationen durchführen.

Kann deaktiviert werden unter `Einstellungen > Erscheinungsbild > Schnellzugriffspanel beim Überfahren öffnen`.

#### Zip-Archive

Komprimieren und extrahieren Sie Zip-Archive direkt aus dem Aktionsmenü des Dateibrowsers:

- **Extrahieren**: eine `.zip`-Datei in das aktuelle Verzeichnis oder in einen benannten Ordner extrahieren;
- **Komprimieren**: ausgewählte Dateien und Verzeichnisse in ein `.zip`-Archiv komprimieren;

#### WSL-Laufwerkserkennung

Unter Windows erkennt die App jetzt automatisch installierte WSL-Distributionen und zeigt deren Laufwerke im Navigator an, sodass Sie WSL-Dateisysteme nativ durchsuchen können.

#### Tag-Bearbeitung

Sie können jetzt Tag-Namen und -Farben bearbeiten. Öffnen Sie den Tag-Selektor bei einer beliebigen Datei oder einem Verzeichnis, um Tags umzubenennen, ihre Farbe zu ändern oder sie zu löschen.

#### In-App-Updates

Sie können jetzt Updates direkt aus der Update-Benachrichtigung herunterladen und installieren, ohne die App zu verlassen.

#### Pfad kopieren

Option „Pfad kopieren" zum Kontextmenü von Dateien und Verzeichnissen hinzugefügt.

#### Doppelte Tabs schließen

Die Möglichkeit hinzugefügt, doppelte Tabs aus der Tab-Leiste zu schließen, wobei alle Tabs entfernt werden, die auf dasselbe Verzeichnis verweisen.

#### Kontextmenüs für Startseite und Dashboard

Elemente auf der Startseite und dem Dashboard haben jetzt vollständige Kontextmenüs, die der Funktionalität im Navigator entsprechen.

### Neue Einstellungen

- **Startseiten-Medienbanner anzeigen**: Medienbanner der Startseite ein- oder ausblenden (`Einstellungen > Erscheinungsbild > Medienbanner der Startseite`);
- **Tooltip-Verzögerung**: Verzögerung vor dem Erscheinen von Tooltips konfigurieren (`Einstellungen > Erscheinungsbild > Tooltips`);
- **Relative Zeit**: kürzliche Zeitstempel im relativen Format anzeigen, z.B. „vor 5 Min." (`Einstellungen > Allgemein > Datum / Uhrzeit`);
- **Datums- und Zeitformat**: Monatsformat, regionales Format, 12-Stunden-Uhr, Sekunden und Millisekunden konfigurieren (`Einstellungen > Allgemein > Datum / Uhrzeit`);
- **Dialog-Hintergrundunschärfe**: Unschärfeintensität für Dialog-Hintergründe festlegen (`Einstellungen > Erscheinungsbild > Stileinstellungen`);
- **Helligkeits- und Kontrastfilter**: Helligkeits- und Kontraststilfilter für die App-Oberfläche anpassen (`Einstellungen > Erscheinungsbild > Stileinstellungen`);
- **Medienhelligkeit der Überlagerung**: Helligkeit der visuellen Effekte-Überlagerungsmedien anpassen (`Einstellungen > Erscheinungsbild > Visuelle Effekte`);
- **Mischmodus für visuelle Effekte**: Mischmodus für visuelle Effekte anpassen, mit dem Sie wählen können, wie Hintergrundmedien mit der App-Oberfläche verschmelzen (`Einstellungen > Erscheinungsbild > Visuelle Effekte`);
- **Hintergrundvideo pausieren**: Startseiten-Banner und Hintergrundvideo pausieren, wenn die App inaktiv oder minimiert ist (`Einstellungen > Erscheinungsbild > Visuelle Effekte`);
- **Standard-Dateimanager**: Sigma File Manager als Standard-Dateiexplorer unter Windows festlegen (`Einstellungen > Experimentell`);
- **Beim Systemstart starten**: die App automatisch beim Anmelden am System starten (`Einstellungen > Allgemein > Startverhalten`);

### Neue Tastenkürzel

- **Aktuellen Verzeichnispfad kopieren** (`Ctrl+Shift+C`): den Pfad des aktuellen Verzeichnisses in die Zwischenablage kopieren;
- **Aktuelles Verzeichnis neu laden** (`F5`): die Dateiliste des Navigators aktualisieren;
- **Vergrößern / Verkleinern** (`Ctrl+=` / `Ctrl+-`): UI-Zoom vergrößern oder verkleinern;
- **Vollbild** (`F11`): Vollbildmodus umschalten;

### Neue Sprachen

- **Hindi**;
- **Urdu**;

### UX-Verbesserungen

#### Verbesserungen der Schnellansicht

- **Mediennavigation**: zwischen Dateien im aktuellen Verzeichnis navigieren, ohne die Schnellansicht zu schließen;
- **Textdateivorschau**: verbesserte Textdateivorschau mit korrekter Kodierungserkennung, Inline-Bearbeitung und gerendertem Markdown;

#### Verbesserungen der Schnellsuche

- **Alle Eigenschaften**: nach jeder Dateieigenschaft suchen – Name, Größe, Elementanzahl, Geändert, Erstellt, Zugegriffen, Pfad oder MIME-Typ (z.B. `modified: today`, `mime: image`);
- **Größenbereiche**: nach Größe filtern mit Vergleichen und Bereichen (z.B. `size: >=2mb`, `size: 1mb..10mb`);

#### Dateioperationen

- **Sicherheit bei Konfliktlösung**: verbesserte Dateisicherheit im Konfliktlösungsmodal zur Vermeidung versehentlichen Datenverlusts;
- **Einmaliges Einfügen**: kopierte Elemente können nur einmal eingefügt werden, um versehentliches doppeltes Einfügen zu verhindern;
- **Text kopieren**: Kopieren von UI-Text mit `Ctrl+C` erlauben, wenn keine Dateien ausgewählt sind;

#### Visuelle Effekte

- **Hintergrund-Manager**: Hintergrund-Manager zur Einstellungsseite für zentrale Hintergrundanpassung hinzugefügt;
- **Zurücksetzen der Hintergrundeffekte**: Zurücksetzungsschaltfläche in den Hintergrundeffekt-Einstellungen hinzugefügt;

#### Sonstiges

- **App-Größenreduzierung**: App-Bundle-Größe durch Ausschluss hochauflösender integrierter Hintergründe und Verwendung komprimierter Vorschauen im Medienbanner-Editor reduziert;
- **Globale Suche**: Schaltfläche „Einstellungen anzeigen" im Leerzustand anzeigen und Standard-Suchtiefe erhöht;
- **Windows-Verknüpfungen**: `.lnk`-Dateien öffnen jetzt ihr Ziel im Navigator, anstatt extern gestartet zu werden;
- **Dashboard**: verbessertes Layout des Tag-Bereichs;
- **Adressleisten-Kontextmenü**: Kontextmenü zu Adressleisten-Elementen hinzugefügt;
- **Navigator-Kontextmenü**: Kontextmenü beim Klicken auf leere Fläche im Navigator anzeigen;
- **In neuem Tab öffnen**: Verzeichnisse mit mittlerem Mausklick in einem neuen Tab öffnen;
- **Tab-Scrollen**: neu hinzugefügte Tabs automatisch in den sichtbaren Bereich scrollen;
- **Menüfokus**: Menüs geben den Fokus nicht mehr an ihre Auslöserschaltfläche zurück, wenn sie durch Klick außerhalb geschlossen werden;
- **Suche schließen**: globale Suche mit `Escape` schließen;
- **Schnellerer Start**: App-Startgeschwindigkeit durch Vorladen der Einstellungen in Rust leicht verbessert;
- **Benutzerverzeichnisse**: Möglichkeit zum Hinzufügen und Entfernen von Benutzerverzeichnissen auf der Startseite hinzugefügt;
- **Listenlimits**: Limits für häufig verwendete Einträge und Verlaufseinträge zur Leistungsverbesserung verringert;

### UI-Verbesserungen

- **Symbolleisten-Icons**: einheitliche Symbolleisten-Icon-Farben in der gesamten App;
- **Kartenanimationen**: gestaffelte Einblend- und Überblendeffekte für Karten hinzugefügt;
- **Helles Design**: verbesserte Farben und Kontrast des hellen Designs;
- **Startstabilität**: verbesserte visuelle Stabilität beim App-Start zur Reduzierung von Flackern;
- **Benachrichtigungen**: verbessertes Benachrichtigungsdesign für bessere Konsistenz;
- **Tab-Auto-Scroll**: automatisches Scrollen des ausgewählten Tabs in den sichtbaren Bereich beim Öffnen der Navigator-Seite;
- **Stammverzeichnis-Labels**: normalisierte Stammverzeichnis-Labels in Tabs und Informationspanel;
- **Übersetzungen**: verbesserte Übersetzungen in der gesamten App;

### Fehlerbehebungen

- Einfrieren der Oberfläche beim Kopieren oder Verschieben vieler Elemente behoben; Dateioperationsfortschritt zum Statuscenter hinzugefügt;
- Einfrieren der Oberfläche beim Löschen vieler Elemente behoben; Löschfortschritt zum Statuscenter hinzugefügt;
- Kontextmenü im Rasterlayout, das sich nicht für das aktuelle Verzeichnis öffnete, wenn ein anderes Element bereits ein Menü geöffnet hatte, behoben;
- Informationspanel, das nicht alle Informationen für das aktuelle Verzeichnis anzeigte, behoben;
- App-Tastenkürzel, die im Schnellansichtsfenster statt nur im Hauptfenster registriert wurden, behoben;
- Dateien, die aus Webbrowsern gezogen wurden und nicht verarbeitet wurden, behoben;
- Dateinamen aus externen URL-Drops, die keine gültigen Segmente beibehielten, behoben;
- Verschiebbares Startseiten-Banner behoben;
- Systemicon-Cache, der nicht nach Dateipfad indiziert war und falsche Icons verursachte, behoben;
- Unzugängliche Windows-Stammeinträge, die im Navigator angezeigt wurden, behoben;
- Benutzerdefinierte Tastenkürzel, die bei manchen Tastaturlayouts nicht erkannt wurden, behoben;
- SSHFS-Verbindungen unter Linux behoben;
- Adressleiste, die beim Klick auf Brotkrümel doppelte Verlaufseinträge erstellte, behoben;
- Globale Suchergebnisse, die nicht auf Tastaturnavigation reagierten, behoben;
- Globale Suchergebnisse, die sich beim Klicken nicht öffneten, behoben;
- Globaler Suchstatus, der nach inkrementeller Indexierung nicht synchronisiert wurde, behoben;
- Ausgehender Datei-Drag-and-Drop, der in einigen Anwendungen nicht funktionierte, behoben;
- Inkonsistentes Tastenkürzel-Badge-Design in der gesamten App behoben;
- Navigator-Spaltensichtbarkeit in schmalen Bereichen behoben;

---

## [2.0.0-beta.2] - February 2026

**Zusammenfassung:** Globale Tastenkürzel, neue Einstellungen, neue Funktionen, verbesserte Dateifilterung, verbesserte Adressleiste, Verbesserungen des Startseiten-Banners und Fehlerbehebungen.

### Globale Tastenkürzel

Sie können jetzt Tastenkürzel verwenden, um mit der App zu interagieren, auch wenn sie nicht im Fokus ist.

Hinzugefügte Tastenkürzel:

- `Win+Shift+E` zum Anzeigen und Fokussieren des App-Fensters;

### Neue Einstellungen

Einstellung hinzugefügt, um zu wählen, was passiert, wenn der letzte Tab geschlossen wird.

![Einstellung letzten Tab schließen](./public/changelog/assets/beta-2/setting-close-last-tab.png)

### Neue Funktionen

Neue Funktionen als frühe Vorschau hinzugefügt:

- Netzwerkorte: ermöglicht das Verbinden eines Netzwerkorts (SSHFS (SSH) / NFS / SMB / CIFS);
- [Linux] Laufwerke einbinden: ermöglicht das Aushängen von Orten;

### Dateifilter

Der Dateifilter wurde verbessert:
- Beim Verzeichniswechsel wird er jetzt automatisch geleert und geschlossen;
- Die Funktion „Filtern beim Tippen" aktiviert sich im ausgewählten Bereich, nicht im ersten;

### Adressleiste

- Verbessertes Design und Autovervollständigungslogik;
- Die Pfadtrenner sind jetzt Dropdown-Menüs, die eine schnelle Navigation zu jedem übergeordneten Verzeichnis ermöglichen;

![Trenner-Menüs](./public/changelog/assets/beta-2/divider-menus.png)

### Startseiten-Banner / Hintergrundeffekte

- Verbessertes Design des Medienbanner-Editors:
  - Das Optionsmenü des Medienbanners öffnet sich jetzt nach unten, um die Ansicht nicht zu verdecken;
  - Sie können jetzt außerhalb klicken, um den Hintergrundpositionseditor zu schließen;
  - URL-Eingabe über benutzerdefinierte Hintergründe verschoben;
- Benutzerdefinierte Bilder/Videos können in visuellen Hintergrundeffekten verwendet werden;
- Einige Standard-Medienbanner-Bilder entfernt;
- Neues Bannerbild „Exile by Aleksey Hoffman" hinzugefügt;

### UX-Verbesserungen

- App stellt die vorherige Fensterposition beim Start wieder her;
- Der aktuelle Tab kann jetzt mit dem Tastenkürzel `Ctrl+W` oder mittlerem Mausklick geschlossen werden;
- Datei-Icon-Größe in der Rasteransicht erhöht;

### Fehlerbehebungen

- Verschieben von Dateien zwischen Tabs, das sie manchmal an den falschen Ort verschob, behoben;
- Navigator, der manchmal falsche System-Icons für Verzeichnisse anzeigte, behoben;
- Erstellung mehrerer App- und Tray-Instanzen behoben;
- Shell-Erweiterungsmenü, das Daten periodisch neu abrief und die Liste ständig nach oben scrollte, behoben;

## [2.0.0-beta.1] - February 2026

**Zusammenfassung:** Wichtige Verbesserungen der Benutzerfreundlichkeit und des Designs, einschließlich Tastaturnavigation, neuer Tastenkürzel, Öffnen im Terminal, automatischer Verzeichnisaktualisierung, Drag & Drop sowie verbesserter Suche und Listenansichten.

### Tastaturnavigation

Navigieren Sie durch Dateien mit der Tastatur mit voller Unterstützung für Raster- und Listenlayouts sowie geteilte Ansicht.

- Pfeiltasten für räumliche Navigation in der Rasteransicht und sequentielle Navigation in der Listenansicht;
- Enter zum Öffnen des ausgewählten Verzeichnisses oder der Datei, Backspace zum Zurücknavigieren;
- Ctrl+Left / Ctrl+Right zum Wechseln des Fokus zwischen den Bereichen der geteilten Ansicht;
- Ctrl+T zum Öffnen des aktuellen Verzeichnisses in einem neuen Tab;
- Alle Navigations-Tastenkürzel sind konfigurierbar unter Einstellungen > Tastenkürzel;

### Automatische Verzeichnisaktualisierung

Die Navigatoransicht wird automatisch aktualisiert, wenn Dateien im aktuellen Verzeichnis erstellt, gelöscht, umbenannt oder geändert werden.

- Dateigrößen werden automatisch aktualisiert, wenn sie von externen Anwendungen geändert werden;
- Effiziente Dateisystemüberwachung mit Debouncing zur Vermeidung übermäßiger Aktualisierungen;
- Intelligente differenzbasierte Aktualisierungen ändern nur betroffene Elemente und erhalten Scrollposition und Auswahl;

### Drag & Drop

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/beta-1/drag-and-drop.mp4"></video>

Sie können jetzt Dateien und Ordner per Drag & Drop kopieren/verschieben. Ziehen Sie zwischen Bereichen, aus oder in Suchergebnislisten, aus oder in externe Anwendungen.

### Kopierkonflikte

Modales Fenster zur einfachen Kopier-/Verschiebekonfliktlösung hinzugefügt.

### Automatische Updates

Automatische Update-Prüfung hinzugefügt (kann in den Einstellungen gesteuert werden).

### Startseiten-Medienbanner-Editor

Editor zur Anpassung des Startseiten-Banners hinzugefügt. Sie können jetzt benutzerdefinierte Bilder und Videos hochladen (sowohl lokale als auch Remote-URL-Dateien werden unterstützt).

### Verbesserungen der Listenansicht

- Verbessertes Design und kleine Ärgernisse behoben;
- Spalten-Sichtbarkeitsanpassung hinzugefügt: wählen Sie, welche Spalten angezeigt werden;
- Spaltensortierung hinzugefügt: klicken Sie auf Spaltenüberschriften, um Einträge zu sortieren;
- Standardlayout des Navigators auf Listenansicht geändert;

### Verbesserungen der globalen Suche

- Aktualisiertes Layout und Design mit Drag-and-Drop-Unterstützung;
- Suche ist jetzt verfügbar, während Laufwerke noch indexiert werden;

### Im Terminal öffnen

Öffnen Sie Verzeichnisse direkt aus dem Kontextmenü in Ihrem bevorzugten Terminal.

- Automatische Erkennung installierter Terminals unter Windows, macOS und Linux;
- Windows Terminal zeigt alle konfigurierten Shell-Profile mit Programm-Icons;
- Linux-Standardterminal wird automatisch erkannt und zuerst angezeigt;
- Enthält normale und Administrator-/erhöhte Modi;
- Standard-Tastenkürzel: Alt+T;

### Lokalisierung

- Slowenische Sprache hinzugefügt (Dank an: @anderlli0053);

### UI- / UX-Verbesserungen

- Schriftartauswahl hinzugefügt: wählen Sie die UI-Schriftart aus installierten Systemschriftarten;
- Menü „Neu erstellen" zum schnellen Erstellen von Dateien oder Verzeichnissen hinzugefügt;
- Leerer Zustand wird beim Navigieren zu leeren Verzeichnissen angezeigt;
- Statusleiste zeigt Gesamtelemente mit versteckter Anzahl, wenn die Liste gefiltert ist;
- Neu erstellte, kopierte und verschobene Elemente werden automatisch in den sichtbaren Bereich gescrollt;
- Zwischenablage-Symbolleiste wird einmal unter den Bereichen angezeigt statt in jedem Bereich;
- Vereinfachtes Design des Umbenennen-Modals;
- Responsive Symbolleisten-Icons, die bei kleinen Fenstergrößen in ein Dropdown-Menü zusammenklappen;
- Leerer Tab „Navigation" aus den Einstellungen entfernt;
- Umbenennen eines Verzeichnisses aktualisiert jetzt seinen Pfad in allen Tabs, Arbeitsbereichen, Favoriten, Tags, Verlauf und häufig verwendeten Elementen;
- Löschen einer Datei oder eines Verzeichnisses entfernt es jetzt aus allen gespeicherten Listen und navigiert betroffene Tabs zur Startseite;
- Nicht existierende Pfade in Favoriten, Tags, Verlauf und häufig verwendeten Elementen werden jetzt beim Start automatisch bereinigt;

### Fehlerbehebungen

- Status der globalen Suchindexierung, der sich nicht in Echtzeit aktualisierte, behoben;
- Bereich der geteilten Ansicht, der sich nicht aktualisierte, wenn sein Verzeichnis vom anderen Bereich gelöscht oder umbenannt wurde, behoben;
- Tabs, die mit einem Fehler geladen wurden, wenn ihr gespeicherter Pfad nicht mehr existiert, behoben;
- System-Icons, die dasselbe Icon für alle Dateien desselben Typs anstelle eindeutiger Icons pro Datei anzeigten, behoben;
- Tastenkürzel, die im zweiten Bereich der geteilten Ansicht nicht funktionierten, behoben;
- Tastenkürzel, die nach Seitennavigation nicht mehr funktionierten, behoben;
- Speicherleck durch Filter-Keydown-Listener, die beim Unmount nicht bereinigt wurden, behoben;
- Linux: Unterstützung für die Ermittlung der Standardanwendung im „Öffnen mit"-Menü hinzugefügt;

---

## [2.0.0-alpha.6] - January 2026

**Zusammenfassung:** Neuigkeiten-Fenster, Schnellansicht, Kontextmenü-Verbesserungen und neue Einstellungen.

### Neuigkeiten-Fenster

Ein Änderungsprotokoll-Fenster, das neue Funktionen und Verbesserungen für jede Version anzeigt.

- Erscheint automatisch nach Updates (kann deaktiviert werden);
- Durch alle Versionen blättern;
- Detaillierte Beschreibungen und Screenshots für jede Funktion;

### Schnellansicht

Dateien ohne vollständiges Öffnen mit einem leichtgewichtigen Vorschaufenster vorschauen.

- Drücken Sie `Space` oder die Option „Schnellansicht" im Kontextmenü, um Dateien schnell anzuzeigen;
- Sofort schließen mit `Space` oder `Escape`.
- Unterstützt Bilder, Videos, Audio, Textdateien, PDFs und mehr;

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/alpha-6/quick-view.mp4"></video>

### Verzeichnisgrößenberechnung

- Die Größe von Verzeichnissen wird jetzt automatisch berechnet;
- Sie können die Gesamtgröße aller Verzeichnisse, einschließlich aller Unterverzeichnisse und Dateien, sehen, sobald Sie ein beliebiges Verzeichnis öffnen;

![Öffnen mit](./public/changelog/assets/alpha-6/size.png)

### Neue Kontextmenü-Optionen

#### Öffnen mit

- Wählen Sie, mit welcher Anwendung eine Datei geöffnet werden soll;
- Richten Sie benutzerdefinierte Vorlagen ein, um Dateien in Anwendungen mit Flags zu öffnen;
- Alle kompatiblen Anwendungen für jeden Dateityp anzeigen;
- Standardanwendungen für bestimmte Dateitypen festlegen;

![Öffnen mit](./public/changelog/assets/alpha-6/open-with.png)

#### Shell-Erweiterungen

- Zugriff auf Windows-Shell-Kontextmenüelemente;
- Zugriff auf Shell-Erweiterungen von Drittanbietern (7-Zip, Git, etc.);

![Shell-Erweiterungen](./public/changelog/assets/alpha-6/shell-extensions.png)

### Neue Einstellungen

#### Laufwerkserkennung

- Fokussiert die App, wenn Wechseldatenträger angeschlossen werden (kann deaktiviert werden);
- Steuern Sie das automatische Öffnungsverhalten des Windows-Explorers für Wechseldatenträger;

#### Filtern beim Tippen

Beginnen Sie an beliebiger Stelle im Navigator zu tippen, um Elemente im aktuellen Verzeichnis sofort zu filtern;

#### Tastenkürzel für Einstellungssuche

Neues Tastenkürzel für schnellen Zugriff auf die Einstellungssuche;

#### Benutzerstatistik-Daten

- Statistik-Einstellungsbereich hinzugefügt;
- Auf der Dashboard-Seite können Sie Verlauf, Favoriten und häufig verwendete Elemente anzeigen, navigieren und löschen;

### Verbesserungen der Suche

Verbesserte globale Suche mit einem hybriden indexiert + direkt Suchsystem für zuverlässigere und aktuellere Ergebnisse.

- Suchen dauern jetzt konsistent weniger als 1 Sekunde (~1 TB vollständig gefülltes Laufwerk), unabhängig davon, wo sich die Dateien auf Ihren Laufwerken befinden;
- Wenn Sie in Ihren „Prioritätspfaden" (die Sie häufig öffnen) suchen, erhalten Sie Ergebnisse sofort und die Dateien werden gefunden, auch wenn sie gerade erst erstellt und noch nicht indexiert wurden.

#### Prioritätspfade umfassen:
- Benutzerverzeichnisse: Downloads, Dokumente, Desktop, Bilder, Videos, Musik;
- Favoriten;
- Kürzlich geöffnet;
- Häufig verwendet;
- Markiert;

---

## [2.0.0-alpha.5] - January 2026

**Zusammenfassung:** Dateioperationen, globale Suche und Tastenkürzel-Anpassung.

### Globale Suche

Leistungsstarke Volllaufwerksuche, die Dateien auf allen Ihren Laufwerken indexiert und durchsucht. Mit unscharfer Suche zum Finden von Dateien auch bei Tippfehlern, automatischer periodischer Neuindexierung, Prioritätsindexierung für häufig verwendete Verzeichnisse und optionalem parallelen Scannen für schnellere Indexierung.

![Globale Suche](./public/changelog/assets/alpha-5/search.png)

### Dateioperationen

Vollständige Unterstützung von Dateioperationen mit Kopieren, Verschieben und Löschen einschließlich Fortschrittsverfolgung. Enthält auch das direkte Umbenennen von Dateien und Ordnern.

### Tastenkürzel-Editor

Passen Sie alle Tastenkürzel in der App an. Aktuelle Zuweisungen anzeigen, Konflikte erkennen und auf Standardwerte zurücksetzen.

### Navigator-Verbesserungen

Option zum Anzeigen nativer System-Icons für Dateien und Verzeichnisse anstelle minimalistischer Glyphen hinzugefügt. Navigations-Tabs der Einstellungen bleiben jetzt beim Scrollen oben auf der Seite fixiert.

---

## [2.0.0-alpha.4] - January 2026

**Zusammenfassung:** Startseite, visuelle Effekte und Benutzeranpassungsoptionen.

### Startseite

Eine schöne Startseite mit einem animierten Medienbanner, Laufwerksliste und Schnellzugriff auf gängige Benutzerverzeichnisse wie Dokumente, Downloads, Bilder und mehr.

### Visuelle Effekte

Anpassbarer Bereich für visuelle Effekte in den Einstellungen, der Unschärfe-, Opazitäts- und Rauscheffekte zum App-Hintergrund hinzufügt. Unterstützt verschiedene Einstellungen für jede Seite.

### Benutzerverzeichnis-Editor

Passen Sie Ihre Benutzerverzeichnis-Karten mit benutzerdefinierten Titeln, Icons und Pfaden an. Personalisieren Sie, wie Ihre Schnellzugriffs-Verzeichnisse auf der Startseite erscheinen.

### Bannerposition-Editor

Feinabstimmung der Position Ihrer Startseiten-Banner-Hintergründe. Zoom, horizontale und vertikale Positionierung für den perfekten Look anpassen.

### Verbesserungen der Einstellungen

- Einstellungssuche funktioniert jetzt in jeder Sprache, nicht nur in der aktuellen;
- Die App stellt den zuletzt besuchten Einstellungs-Tab beim Neuladen wieder her, anstatt immer den ersten zu öffnen;

---

## [2.0.0-alpha.3] - December 2025

**Zusammenfassung:** Navigatoransicht mit Tabs, Arbeitsbereichen und einem neuen Designsystem.

### Navigatoransicht

Das zentrale Dateibrowser-Erlebnis mit einem modernen Tab-System mit Arbeitsbereichsunterstützung, einem neuen Fenstersymbolleisten-Design mit integrierten Steuerelementen und Doppelbereichsnavigation für effizientes Dateimanagement.

### Video-Miniaturansichten

Vorschau-Miniaturansichten für Videodateien im Navigator hinzugefügt.

### Migration des Designsystems

Die App wurde von Vuetify zu Sigma-UI migriert für ein großzügigeres, moderneres Design mit verbesserter Codequalität.

---

## [2.0.0-alpha.1] - January 2024

**Zusammenfassung:** Vollständige Neuentwicklung mit modernen Technologien.

### Tauri-Migration

Sigma File Manager v2 wurde von Grund auf mit Vue 3 Composition API, TypeScript und Tauri v2 neu aufgebaut. Die Installationsgröße der App wurde von 153 MB auf nur 4 MB unter Windows reduziert. Die installierte App-Größe wurde von 419 MB auf 12 MB reduziert.

### Anpassbare Bereiche

Funktion für anpassbare Bereiche hinzugefügt, mit der Sie die Navigatoransicht halbieren und mit 2 Verzeichnissen nebeneinander arbeiten können.

### Erste Funktionen

Grundlegende Dateinavigation mit Verzeichnisliste, Fensterverwaltung mit Minimieren-, Maximieren- und Schließen-Steuerelementen sowie eine anfängliche Einstellungsseiten-Struktur.
