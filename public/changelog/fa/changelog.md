# تاریخچه تغییرات

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

**خلاصه:** یکپارچگی کلیپ‌بورد سیستم با سایر برنامه‌ها، انتخاب با کادر، نمای تقسیم‌شده پیوندی، مدیریت پیوندها، آرشیوهای ZIP محافظت‌شده با رمز، خصوصیات بومی در Windows، گسترش API افزونه‌ها، پشتیبانی از زبان عبری، و بهبودهای نویگیتور.

### ویژگی‌های جدید

#### یکپارچگی کلیپ‌بورد سیستم

فایل‌ها، پوشه‌ها و تصاویر را از طریق کلیپ‌بورد سیستم بین Sigma File Manager و سایر برنامه‌ها کپی و بچسبانید.

- **انتقال فایل بین برنامه‌ها**: آیتم‌ها را در SFM کپی یا برش کنید و در برنامه‌هایی مانند File Explorer بچسبانید، یا مسیرها و فایل‌های کپی‌شده از برنامه‌های دیگر را با `Ctrl+V` در نویگیتور بچسبانید؛
- **چسباندن تصویر**: تصاویر کپی‌شده از مرورگرها و سایر برنامه‌ها را مستقیماً در یک پوشه بچسبانید؛
- **دیالوگ‌های تعارض**: وقتی آیتم‌های چسبانده‌شده از قبل وجود دارند، `تغییر نام` یا `ادغام` را انتخاب کنید و تعارض‌های تک‌فایلی را با جایگزینی، رد کردن، نگه‌داشتن هر دو یا اعمال برای همه حل کنید؛
- **نوار ابزار کلیپ‌بورد**: پیش‌نمایش اختیاری نوار ابزار برای تصاویر و مسیرهای فایل کپی‌شده در برنامه‌های دیگر؛

نمایش نوار ابزار را می‌توان در `تنظیمات > ظاهر رابط کاربری > کلیپ‌بورد` کنترل کرد. چسباندن با `Ctrl+V` حتی وقتی نوار ابزار پنهان است همچنان کار می‌کند.

![system-clipboard](./public/changelog/assets/2.2.0/system-clipboard.webp)

#### انتخاب با کادر

روی فضای خالی در نویگیتور بکشید تا چند آیتم را با کادر انتخاب کنید.

- **اصلاح‌کننده‌ها**: برای افزودن به انتخاب فعلی `Ctrl` یا `Shift` را نگه دارید؛ برای معکوس کردن `Alt` را نگه دارید؛
- **هدف‌گیری آسان‌تر**: به‌صورت اختیاری فاصله‌های فهرست و شبکه‌ای را افزایش دهید تا فضای بیشتری برای شروع کشیدن داشته باشید؛

در `تنظیمات > عمومی > نمای فایل > فعال‌سازی انتخاب با کادر` فعال کنید.

![box-selection](./public/changelog/assets/2.2.0/box-selection.webp)

#### نمای تقسیم‌شده پیوندی

حالت جدید نمای تقسیم‌شده `پیوند` برای جریان کاری ساده‌تر شبیه ستون: با کلیک روی یک پوشه در پنل اول، محتوای آن پوشه در پنل دوم نمایش داده می‌شود.

حالت مستقل موجود `تقسیم` بدون تغییر باقی مانده است. حالت را از منوی گزینه‌های نویگیتور در `حالت نمای تقسیم‌شده` انتخاب کنید، یا نمای تقسیم‌شده را با `Ctrl+S` تغییر دهید.

آیکون پنل اطلاعات نیز به‌روزرسانی شد تا از آیکون نمای تقسیم‌شده آسان‌تر متمایز شود.

![linked-split-view](./public/changelog/assets/2.2.0/linked-split-view.webp)

#### مدیریت پیوندها

پیوندهای سیستم فایل را از نویگیتور ایجاد و بررسی کنید.

- **ایجاد پیوند**: پیوندهای نمادین، میانبرها، لینک‌های سخت و نقاط اتصال (junction) را از منوی زمینه (`ایجاد پیوند`) بسازید؛
- **ستون‌های پیوند**: ستون‌های اختیاری فهرست برای نوع، پیوندها، هدف پیوند و وضعیت پیوند (`معتبر`، `شکسته`، `ناشناخته`، `پشتیبانی‌نشده`)؛
- **رفتار باز کردن**: میانبرهای پوشه و پوشه‌های پیوند نمادین به هدف خود می‌روند؛ سایر اهداف پیوند با برنامه پیش‌فرض باز می‌شوند؛

![link-handling](./public/changelog/assets/2.2.0/link-handling.webp)

#### پنجره خصوصیات بومی

در Windows، دیالوگ خصوصیات بومی سیستم را برای آیتم‌های انتخاب‌شده از منوی زمینه، منوی عملیات، `Alt+Enter` یا `Alt` + دوبار کلیک باز کنید.

![native-properties](./public/changelog/assets/2.2.0/native-properties.webp)

#### تغییر اندازه و ترتیب ستون‌های نمای فهرست

ستون‌های نمای فهرست را می‌توان تغییر اندازه داد و دوباره مرتب کرد تا با نحوه کار شما هماهنگ شود.

- **تغییر اندازه**: لبه‌های ستون را بکشید تا عرض تغییر کند؛
- **ترتیب و نمایش**: ترتیب و نمایش را از پاپ‌اور `ستون‌ها` در سربرگ فهرست مدیریت کنید؛
- **گزینه‌های عرض**: `پر کردن عرض موجود` و `تنظیم حداقل عرض‌ها`؛

![list-column-resize](./public/changelog/assets/2.2.0/list-column-resize.webp)

#### آدرس موقعیت‌ها در ریشه

آدرس ریشه `موقعیت‌ها` درایوها و موقعیت‌های مجازی را برای جابه‌جایی سریع‌تر فهرست می‌کند.

- **نوار آدرس**: از ریشه درایو بالا بروید یا `موقعیت‌ها` را از نوار آدرس / ویرایشگر آدرس باز کنید؛
- **موارد دلخواه و برچسب‌ها**: موقعیت‌ها را می‌توان مانند سایر پوشه‌ها به موارد دلخواه افزود و برچسب‌گذاری کرد؛
- **نمای تقسیم‌شده**: به‌ویژه برای جابه‌جایی بین درایوها در پنل‌ها بدون ترک نویگیتور مفید است؛

![root-locations-address](./public/changelog/assets/2.2.0/root-locations-address.webp)

### افزونه‌ها

#### APIها و نماهای افزونه

افزونه‌ها قابلیت‌های میزبان و بلوک‌های ساخت رابط کاربری بیشتری دریافت می‌کنند.

- **فایل‌های اجرایی محلی**: وابستگی‌های افزونه را با راه‌اندازی خودکار یا فایل‌های اجرایی محلی انتخاب‌شده دستی پیکربندی کنید (`افزونه‌ها > وابستگی‌ها`)؛
- **درخواست‌های HTTP**: افزونه‌ها می‌توانند به میزبان‌های مجاز در مانیفست خود درخواست HTTP بفرستند؛
- **کنترل نما**: افزونه‌ها می‌توانند ترجیحات چیدمان و مرتب‌سازی نویگیتور را اعمال کنند (با مجوز نما)؛
- **API کلیپ‌بورد**: افزونه‌ها می‌توانند کلیپ‌بورد را بخوانند و بنویسند (با مجوز)؛
- **نمای فهرست-جزئیات**: الگوی جدید رابط کاربری افزونه با فهرست قابل جستجو و پنل جزئیات؛

![extension-local-binaries](./public/changelog/assets/2.2.0/extension-local-binaries.webp)

![extension-dependency-config](./public/changelog/assets/2.2.0/extension-dependency-config.webp)

![extension-list-detail](./public/changelog/assets/2.2.0/extension-list-detail.webp)

![extension-http-api](./public/changelog/assets/2.2.0/extension-http-api.webp)

### تنظیمات جدید

- **فعال‌سازی انتخاب با کادر**: روی فضای خالی بکشید تا چند مورد را انتخاب کنید؛
  `تنظیمات > عمومی > نمای فایل > فعال‌سازی انتخاب با کادر`
- **افزایش فاصله‌ها در نمای فایل**: فاصله‌های فهرست و شبکه‌ای بزرگ‌تر برای هدف‌گیری آسان‌تر؛
  `تنظیمات > عمومی > نمای فایل > افزایش فاصله‌ها در نمای فایل`
- **نگه داشتن پنجره Quick View در حافظه**: Quick View را بارگذاری‌شده نگه دارید تا فوراً باز شود (حدود ۲۰۰ مگابایت مصرف می‌کند)؛
  `تنظیمات > عمومی > عملکرد > نگه داشتن پنجره Quick View در حافظه`
- **نگه داشتن پنجره چاپ در حافظه**: پنجره چاپ را بارگذاری‌شده نگه دارید تا فوراً باز شود (حدود ۲۰۰ مگابایت مصرف می‌کند)؛
  `تنظیمات > عمومی > عملکرد > نگه داشتن پنجره چاپ در حافظه`
- **نوار ابزار کلیپ‌بورد برای تصاویر خارجی**: نوار ابزار کلیپ‌بورد را برای تصاویر کپی‌شده در برنامه‌های دیگر نمایش دهید؛
  `تنظیمات > ظاهر رابط کاربری > کلیپ‌بورد`
- **نوار ابزار کلیپ‌بورد برای مسیرهای خارجی**: نوار ابزار کلیپ‌بورد را برای مسیرهای فایل کپی‌شده در برنامه‌های دیگر نمایش دهید؛
  `تنظیمات > ظاهر رابط کاربری > کلیپ‌بورد`
- **اندازه پویای پانل اطلاعات**: اجازه دهید اندازه پانل اطلاعات تطبیق یابد، یا با تغییر اندازه دستی این گزینه را خاموش کنید؛
  `تنظیمات > ظاهر رابط کاربری > پانل اطلاعات > اندازه پویای پانل اطلاعات`
- **نمایش تصویر در اندازه کامل در پیش‌نمایش پانل اطلاعات**: تصاویر با وضوح کامل را در پانل اطلاعات نمایش دهید؛
  `تنظیمات > ظاهر رابط کاربری > پانل اطلاعات > نمایش تصویر در اندازه کامل در ناحیه پیش‌نمایش پانل اطلاعات`
- **بی‌صدا کردن پیش‌نمایش ویدیو به‌صورت پیش‌فرض**: پیش‌نمایش ویدیوی پانل اطلاعات را هنگام مرور بی‌صدا کنید؛
  `تنظیمات > ظاهر رابط کاربری > پانل اطلاعات > بی‌صدا کردن پیش‌نمایش ویدیو به‌صورت پیش‌فرض`
- **پخش خودکار پیش‌نمایش ویدیو**: ویدیوها را هنگام انتخاب در پانل اطلاعات به‌صورت خودکار پخش کنید؛
  `تنظیمات > ظاهر رابط کاربری > پانل اطلاعات > پخش خودکار پیش‌نمایش ویدیو`

### میانبرهای جدید

- **خصوصیات بومی** (`Alt+Enter`): باز کردن پنجره خصوصیات بومی برای آیتم‌های انتخاب‌شده در Windows؛

### زبان‌های جدید

- **عبری** (`עברית`): ترجمه کامل با پشتیبانی از چیدمان راست‌به‌چپ (`تنظیمات > عمومی > زبان`)؛

### بهبودهای تجربه کاربری

#### استخراج آرشیو

استخراج ZIP اکنون از آرشیوهای رمزگذاری‌شده و نام‌های فایل غیر UTF-8 پشتیبانی می‌کند.

- **ZIP محافظت‌شده با رمز**: وقتی استخراج نیاز دارد، رمز آرشیو را وارد کنید؛
- **رمزگذاری نام فایل**: رمزگذاری را در `گزینه‌های استخراج آرشیو` انتخاب کنید؛ تشخیص خودکار ترجیح داده می‌شود و رمزگذاری‌های منطقه‌ای گروه‌بندی‌شده به‌عنوان جایگزین؛

![archive-extraction-options](./public/changelog/assets/2.2.0/archive-extraction-options.webp)

![archive-extraction-encoding](./public/changelog/assets/2.2.0/archive-extraction-encoding.webp)

#### مرتب‌سازی شبکه‌ای

چیدمان شبکه‌ای اکنون کنترل‌های مرتب‌سازی خود را در منوی گزینه‌های نویگیتور دارد.

- **مرتب‌سازی بر اساس**: نام، آیتم‌ها، اندازه، تغییر یافته، ایجاد شده، برچسب‌ها، نوع، پیوندها و وضعیت پیوند؛
- **جهت**: صعودی یا نزولی، جدا از مرتب‌سازی نمای فهرست ذخیره می‌شود؛

![grid-sorting](./public/changelog/assets/2.2.0/grid-sorting.webp)

#### افزونه‌های شل

منوی زمینه می‌تواند اقدامات مدرن افزونه‌های شل ثبت‌شده توسط سایر برنامه‌ها را تحت `افزونه‌های شل` بارگذاری کند.

![shell-extensions](./public/changelog/assets/2.2.0/shell-extensions.webp)

#### حافظه نشست

موقعیت‌های پیمایش و تب‌های فعال هنگام ترک صفحه یا پنل و بازگشت در همان نشست بازیابی می‌شوند.

#### عملکرد نویگیتور

مرور پوشه‌های بزرگ و رسانه سریع‌تر است و حافظه کمتری مصرف می‌کند.

- **بارگذاری سرد**: اولین بارگذاری هنگام باز کردن پوشه‌ها سریع‌تر است؛
- **بارگذاری آیکون**: آیکون‌های سفارشی و سیستمی با تأخیر کمتر ظاهر می‌شوند؛
- **پیمایش فهرست**: پیمایش روان‌تر فهرست در پوشه‌های بزرگ؛
- **پیش‌نمایش رسانه**: پیش‌نمایش تصویر، GIF و ویدیو پاسخ‌گوتر است و حافظه کمتری مصرف می‌کند؛
- **شاخص‌گذاری**: شاخص‌گذاری جستجوی سراسری پایدارتر؛

#### صفحه اصلی و منوهای زمینه

- **قطع اتصال**: قطع اتصال اشتراک‌های شبکه یا قابل‌جدا شدن از منوی زمینه در صورت پشتیبانی؛
- **بستن همه تکراری‌ها**: منوی تب `بستن همه تکراری‌ها` اکنون هر مسیر تکراری در فضای کاری را می‌بندد، نه فقط تکراری‌های تب فعلی؛
- **پاک‌کردن با کلیک راست**: کلیک راست روی پس‌زمینه خالی نویگیتور قبل از باز شدن منوی پس‌زمینه، انتخاب فعلی را پاک می‌کند؛
- **اقدامات صفحه اصلی**: منوهای زمینه صفحه اصلی پس از کلیک روی اقدام بسته می‌شوند، `باز کردن در تب جدید` نویگیتور را باز می‌کند و تب‌های جدید به محدوده دید پیمایش می‌شوند؛
- **ناحیه کشیدن پنجره**: در نوار عنوان‌های سبک لینوکس، ناحیه کشیدن در سراسر دکمه‌های نوار ابزار گسترش می‌یابد تا جابه‌جایی پنجره آسان‌تر شود؛

![window-drag-region](./public/changelog/assets/2.2.0/window-drag-region.webp)

### بهبودهای رابط کاربری

- **نشانگر پنل فعال**: نشانگر واضح‌تر پنل فعال در نوار وضعیت وقتی نمای تقسیم‌شده روشن است؛
- **پانل اطلاعات قابل تغییر اندازه**: عرض پانل اطلاعات و تقسیم پیش‌نمایش/جزئیات را با کشیدن تغییر دهید؛
- **پانل اطلاعات فشرده**: چیدمان متراکم‌تر ویژگی‌ها در پانل اطلاعات؛
- **اقدامات منوی زمینه**: `ویرایش کارت` به‌صورت دکمه اقدام نمایش داده می‌شود و دکمه‌های اقدام به‌طور کلی کوچک‌تر هستند؛
- **ظاهر نویگیتور**: چیدمان تطبیقی بهبودیافته، سبک‌های حالت فعال تب در نمای تقسیم‌شده و طراحی نمای افزونه پالت فرمان؛
- **چیدمان RTL**: هم‌ترازی تمیزتر برای زبان‌های راست‌به‌چپ؛

![resizable-info-panel](./public/changelog/assets/2.2.0/resizable-info-panel.webp)

![compact-info-panel](./public/changelog/assets/2.2.0/compact-info-panel.webp)

### رفع اشکالات

- **جستجو با تایپ**: رفع فعال نشدن جستجوی سریع در چیدمان‌های صفحه‌کلید غیرلاتین؛
- **بارگذاری پوشه**: رفع تغییر ترتیب ورودی‌ها پس از اتمام بارگذاری پوشه؛
- **آیکون‌های سفارشی**: رفع بارگذاری آیکون‌های سفارشی با تأخیر قابل‌توجه؛
- **کارت‌های شبکه‌ای**: رفع تغییر اندازه کارت‌های چیدمان شبکه‌ای هنگام بارگذاری؛
- **نوار پیمایش شبکه‌ای**: رفع پنهان شدن نوار پیمایش شبکه‌ای پشت سربرگ‌های چسبنده؛
- **انتخاب سریع**: رفع باز شدن گاه‌به‌گاه فایل هنگام انتخاب سریع فایل؛
- **میانبر ترمینال**: رفع باز شدن ترمینال با `Alt+T` برای پوشه فعلی به‌جای ورودی انتخاب‌شده؛
- **باز کردن فایل‌ها**: رفع راه‌اندازی فایل‌های بازشده از پوشه کاری اشتباه؛
- **اشتراک‌های SMB**: رفع ناتوانی در باز کردن فایل‌ها روی اشتراک‌های SMB؛
- **مسیرهای WSL**: رفع مدیریت مسیرهای UNC میزبان WSL در Windows، از جمله `//wsl.localhost` به‌عنوان فهرست مجازی توزیع‌ها؛
- **مدیر فایل پیش‌فرض**: این تنظیم در نسخه‌های Windows با نصب مستقیم همچنان در دسترس است؛ در نسخه Microsoft Store اکنون غیرفعال و غیرقابل دسترس نمایش داده می‌شود؛
- **AppImage (لینوکس)**: رفع `Could not create default EGL display: EGL_BAD_PARAMETER`؛
- **نصب افزونه (لینوکس)**: رفع شکست نصب برای افزونه‌های چندفایلی dist؛
- **جزئیات افزونه**: رفع استایل‌های هم‌ترازی صفحه نمای کلی؛
- **بیدار شدن دستگاه**: رفع گیر کردن برنامه در حالت بارگذاری پس از بیدار شدن دستگاه؛
- **اعلان‌های به‌روزرسانی**: رفع نمایش اعلان‌های به‌روزرسانی برای نسخه‌های منتشرنشده؛
- **RTL**: رفع مشکلات چیدمان راست‌به‌چپ؛
- **ترجمه‌ها**: رفع رشته‌های ترجمه گم‌شده و نادرست؛

---

## [2.1.0] - May 2026

**خلاصه:** بهبود عملکرد نویگیتور، تصاویر بندانگشتی تولیدشده، تم‌های افزونه، چاپ، پیش‌نمایش فایل، میانبرهای جدید، بهبودهای ویرایشگر آدرس، بازطراحی مرکز وضعیت، و صیقل تب‌ها و ناوبری.

### ویژگی‌های جدید

#### چاپ

فایل‌های انتخاب‌شده را مستقیماً از نویگیتور با منوی زمینه، منوی عملیات یا `Ctrl+O` چاپ کنید.

- **فرمت‌های پشتیبانی‌شده**: تصاویر، PDF، فرمت‌های متنی؛
- **خروج سریع**: بستن نمای چاپ با `Escape`؛

![printing](./public/changelog/assets/2.1.0/printing.webp)

#### رها کردن فایل روی تب‌ها

فایل‌ها یا پوشه‌ها را روی تب‌ها بکشید تا آن‌ها را به پوشه تب دیگر منتقل یا کپی کنید.

- **تب‌های هدف رها کردن**: تب‌ها هنگام کشیدن فایل‌ها در نویگیتور به هدف رها کردن تبدیل می‌شوند؛
- **فعال‌سازی با نگه داشتن ماوس**: نگه داشتن ماوس روی یک تب هنگام کشیدن می‌تواند قبل از رها کردن به آن تب سوئیچ کند؛
- **تب‌های تقسیم‌شده**: گروه‌های تب پوشه رفتار عادی رها کردن را حفظ می‌کنند و ساختار تب نمای تقسیم‌شده را نگه می‌دارند؛

![file-drop-to-tabs](./public/changelog/assets/2.1.0/file-drop-to-tabs.webp)

#### پیش‌نمایش فایل در پانل اطلاعات

پانل اطلاعات اکنون می‌تواند همه انواع فایل پشتیبانی‌شده توسط نمای سریع را پیش‌نمایش کند، نه فقط تصاویر و ویدیوها.

- **پیش‌نمایش رسانه**: تصاویر از بندانگشتی‌های تولیدشده استفاده می‌کنند، ویدیو و صدا کنترل‌های بومی دارند و PDFها به‌صورت درون‌خطی رندر می‌شوند؛
- **پیش‌نمایش متن**: فایل‌های متنی پیش‌نمایش فشرده رمزگشایی‌شده با محدودیت اندازه ایمن نشان می‌دهند؛
- **جایگزین‌ها**: فایل‌ها و پوشه‌های پشتیبانی‌نشده جای‌نگهدار آیکون ساده نگه می‌دارند؛

![info-panel-file-preview](./public/changelog/assets/2.1.0/info-panel-file-preview.webp)

#### ستون‌های فهرست نویگیتور

نمای فهرست ستون‌های اختیاری بیشتر و کنترل بهتر فراداده درون‌خطی دارد.

- **ستون ایجاد شده**: نمایش و مرتب‌سازی بر اساس تاریخ ایجاد؛
- **ستون برچسب‌ها**: نمایش برچسب‌ها مستقیماً در نمای فهرست و افزودن، حذف یا ویرایش برچسب‌ها از ستون؛

![navigator-list-columns](./public/changelog/assets/2.1.0/navigator-list-columns.webp)

### افزونه‌ها

#### تم‌های برنامه از افزونه‌ها

افزونه‌ها اکنون می‌توانند تم‌های رنگی کامل برنامه را ارائه دهند. افزونه‌های تم نصب‌شده در انتخابگر تم ظاهر می‌شوند.

#### تم‌های آیکون از افزونه‌ها

افزونه‌ها اکنون می‌توانند تم‌های آیکون نویگیتور برای پوشه‌ها و فایل‌ها را ارائه دهند.

- **انتخاب جداگانه**: تم‌های آیکون پوشه و فایل را به‌طور مستقل در `تنظیمات > ظاهر رابط کاربری > تم آیکون` انتخاب کنید؛
- **تم‌های داخلی و افزونه**: از تم‌های آیکون پیش‌فرض/سیستم داخلی یا هر تم ارائه‌شده توسط افزونه فعال استفاده کنید؛
- **تطبیق تم**: تم‌های ارائه‌شده می‌توانند آیکون‌ها را بر اساس پسوند فایل، نام فایل، نام پوشه و حالت گسترش‌یافته پوشه تعریف کنند؛

### تنظیمات جدید

- **متن برگه فعال را پررنگ کنید**: عنوان برگه فعال را پررنگ کنید (`تنظیمات > برگه‌ها > ظاهر برگه‌ها > متن برگه فعال را پررنگ کنید`)؛

![bold-active-tab-text-setting](./public/changelog/assets/2.1.0/bold-active-tab-text-setting.webp)

### میانبرهای جدید

- **تغییر نمای تقسیم‌شده** (`Ctrl+S`): نمایش یا پنهان کردن نمای تقسیم‌شده در نویگیتور؛
- **بازیابی تب بسته‌شده** (`Ctrl+Shift+T`): بازیابی آخرین گروه تب بسته‌شده؛
- **ایجاد فایل / پوشه** (`Ctrl+Shift+M` / `Ctrl+Shift+N`): ایجاد فایل یا پوشه جدید در پوشه فعلی؛
- **چاپ فایل انتخاب‌شده** (`Ctrl+O`): چاپ فایل انتخاب‌شده؛
- **باز کردن مسیر کپی‌شده** (`Ctrl+Shift+V`): باز کردن مسیر معتبر از کلیپ‌بورد؛
- **تغییر صفحات** (`Alt+1` - `Alt+5`): جابه‌جایی بین صفحه اصلی، نویگیتور، داشبورد، تنظیمات و افزونه‌ها؛
- **ناوبری تاریخچه پوشه** (`Alt+Left` / `Alt+Right`): رفتن به عقب یا جلو در تاریخچه نویگیتور؛
- **رفتن به پوشه والد** (`Alt+Up`): رفتن به پوشه والد؛
- **دکمه‌های تاریخچه ماوس** (`Mouse Button 4` / `Mouse Button 5`): ناوبری عقب و جلو با دکمه‌های کناری ماوس؛

![create-file-directory-shortcuts](./public/changelog/assets/2.1.0/create-file-directory-shortcuts.webp)

![navigator-shortcuts](./public/changelog/assets/2.1.0/navigator-shortcuts.webp)

### بهبودهای تجربه کاربری

#### عملکرد پوشه‌های بزرگ

ناوبری، جستجوی سریع و پوشه‌های پر از رسانه پاسخ‌گوتر هستند و حافظه کمتری مصرف می‌کنند.

- **بندانگشتی‌های تولیدشده**: بندانگشتی‌های تصویر و ویدیو در اندازه‌های کوچک‌تر تولید می‌شوند به‌جای بارگذاری رسانه کامل در هر کارت فایل؛
- **تصاویر پیش‌رونده**: کارت‌های تصویر شبکه‌ای می‌توانند قبل از آماده شدن بندانگشتی نهایی، بندانگشتی تار با وضوح پایین نشان دهند؛
- **لغو بندانگشتی**: تولید بندانگشتی هنگام تغییر پوشه یا ورودی‌های مرئی قابل لغو است؛
- **عملکرد رندر**: ورودی‌های پوشه‌های بزرگ از رندر کارآمدتر استفاده می‌کنند و نمای سریع از بندانگشتی‌های تولیدشده با فهرست مجازی استفاده می‌کند؛

![low-res-image-thumbnail-preview](./public/changelog/assets/2.1.0/low-res-image-thumbnail-preview.webp)

#### جستجوی سریع

جستجوی سریع اکنون ۲ حالت دارد: غیرفعال و فعال:

- **حالت غیرفعال**: هنگام شروع تایپ به‌طور خودکار فعال می‌شود. ورودی‌ها را بدون فوکوس روی ورودی جستجو فیلتر می‌کند و مانع ناوبری نمی‌شود.
- **حالت فعال**: با `Ctrl+F` فعال می‌شود. روی ورودی جستجو فوکوس می‌کند و از ناوبری جلوگیری می‌کند اما کنترل دقیق‌تری روی پرس‌وجوی واردشده می‌دهد.

سایر تغییرات:

- **تایپ برای فیلتر**: تایپ کلیدهای حروف و اعداد اکنون همیشه جستجوی سریع (حالت غیرفعال) را در پنل فعال شروع می‌کند؛
- **ناوبری صفحه‌کلید**: اولین آیتم منطبق به‌طور خودکار انتخاب می‌شود؛
- **طراحی پاپ‌اور**: پاپ‌اور جستجوی سریع فشرده‌تر است و آیتم‌های پوشه را نمی‌پوشاند؛

![quick-search](./public/changelog/assets/2.1.0/quick-search.webp)

#### ویرایشگر آدرس

ویرایشگر آدرس اکنون می‌تواند به‌عنوان راه‌انداز گسترده‌تر مسیر استفاده شود.

- **فایل‌ها و پوشه‌ها**: باز کردن فایل‌ها و همچنین پوشه‌ها از ویرایشگر آدرس؛
- **مسیرهای پرتکرار**: سوئیچ به حالتی متمرکز بر باز کردن سریع مسیرهای پرتکرار؛
- **پیشنهادها**: مرور ورودی‌های پوشه، تطابق‌های دقیق، مسیرهای اخیر، آیتم‌های برچسب‌گذاری‌شده، پوشه‌های کاربر و درایوهای سیستم؛
- **اقدامات صفحه‌کلید**: ناوبری عقب، جلو، بالا و نمایش یک ورودی در پوشه والد از ویرایشگر؛

![address-editor](./public/changelog/assets/2.1.0/address-editor.webp)

#### مرکز وضعیت

مرکز وضعیت اکنون یک ویجت فشرده نوار ابزار با گروه‌های عملیات واضح‌تر است.

- **شمارش فعال**: دکمه نوار ابزار به یک قرص گسترش می‌یابد که تعداد عملیات فعال را نشان می‌دهد؛
- **گروه‌های عملیات**: عملیات فعال و تکمیل‌شده جدا هستند و عملیات تکمیل‌شده در بخش جمع‌شونده قرار دارند؛
- **لغو همه**: لغو موازی عملیات فعال از سربرگ بخش؛
- **کارت‌های کار**: کارت‌های عملیات برچسب‌های نوع و وضعیت واضح‌تری مانند `کپی | موفقیت` یا `آرشیو | خطا` نشان می‌دهند؛
- **بازیابی کلیپ‌بورد**: چسباندن به‌محض صف شدن کار کلیپ‌بورد را پاک می‌کند و در صورت شکست کار آن را بازمی‌گرداند؛

![status-center](./public/changelog/assets/2.1.0/status-center.webp)

#### ناوبری و تب‌ها

جابه‌جایی در نویگیتور و رفتار تب‌ها قابل‌پیش‌بینی‌تر است.

- **درایوهای نوار کناری**: کلیک روی یک درایو در نوار کناری ناوبری آن را در تب فعلی باز می‌کند؛
- **پوشه فعلی**: بخش آدرس فعلی برجسته‌تر است و منوی زمینه آن با کلیک راست روی آخرین بخش آدرس باز می‌شود؛
- **تب‌های بسته‌شده**: تب‌های بازیابی‌شده به موقعیت قبلی بازمی‌گردند، مسیرهای تغییرنام‌داده‌شده را حفظ می‌کنند و مسیرهای حذف‌شده را به صفحه اصلی هدایت می‌کنند؛
- **چیدمان پاسخ‌گو**: دکمه‌های ناوبری نوار ابزار زودتر جمع می‌شوند، نوارهای آدرس نمای تقسیم‌شده در پنل‌های بسیار باریک به ردیف دوم می‌روند و تب‌های فشرده ارتفاع یکنواخت دارند؛

![nav-sidebar-drive-current-tab](./public/changelog/assets/2.1.0/nav-sidebar-drive-current-tab.webp)

![current-directory-address-bar](./public/changelog/assets/2.1.0/current-directory-address-bar.webp)

#### مدیریت میانبرها

ویرایش میانبر اکنون تعارض‌ها و سفارشی‌سازی را واضح‌تر مدیریت می‌کند.

- **چندین اتصال**: اختصاص چند میانبر به یک اقدام؛
- **میانبرهای لغو‌شده**: لغو اختصاص میانبرها؛
- **جایگزینی تعارض**: جایگزینی مستقیم میانبر متعارض از اعلان تعارض؛
- **منوی فهرست میانبرها**: مدیریت میانبرها از منوی زمینه در فهرست میانبرها؛

![shortcut-editor](./public/changelog/assets/2.1.0/shortcut-editor.webp)

#### کشیدن و رها کردن

امکان شروع کشیدن خروجی با جابه‌جایی بین برنامه‌ها. اکنون فایل‌ها را می‌توان با Alt+Tab بیرون کشید (نه فقط با خروج نشانگر از پنجره)؛

### بهبودهای رابط کاربری

- **حلقه انتخاب**: بهبود شفافیت حلقه انتخاب نویگیتور، افست، استایل سربرگ پنل و رفتار فوکوس صفحه‌کلید؛
- **نوار تب**: بهبود استایل‌های نوار تب و خوانایی تب فعال؛
- **انتخاب تم**: بهبود طراحی انتخاب تم؛
- **دسترسی سریع**: پالایش استایل پنل دسترسی سریع؛
- **صفحه آغازین**: افزودن صفحه آغازین برنامه هنگام راه‌اندازی؛
- **نمایش پاپ‌اور**: بهبود نمایش عناصر نیمه‌شفاف پاپ‌اور؛
- **راهنماهای ابزار**: افزودن راهنما به دکمه‌های بیشتر نوار ابزار؛
- **ترجمه‌ها**: بهبود رشته‌های زبان ژاپنی و ویتنامی و پاک‌سازی ساختار محلی‌سازی؛

![selection-ring](./public/changelog/assets/2.1.0/selection-ring.webp)

![tab-bar-styles](./public/changelog/assets/2.1.0/tab-bar-styles.webp)

![narrow-window-layout](./public/changelog/assets/2.1.0/narrow-window-layout.webp)

### رفع اشکالات

- **درایوهای نگاشت‌شده**: رفع کار نکردن کشیدن و رها کردن خروجی درایو شبکه نگاشت‌شده؛
- **پیمایش صفحه‌کلید**: رفع پنهان شدن ردیف اول پشت سربرگ چسبنده؛
- **یخ‌زدگی راه‌اندازی**: رفع یخ‌زدگی‌های نادر چنددقیقه‌ای راه‌اندازی در Windows ناشی از فراخوانی‌های همزمان کند سیستم هنگام راه‌اندازی و بررسی به‌روزرسانی؛
- **استخراج آرشیو**: حفظ حالت‌های فایل Unix هنگام استخراج آرشیوها؛
- **HTTP افزونه**: بازگرداندن مدیریت دائمی پاسخ‌های غیر 2xx و قابل‌لغو کردن انتظارهای تلاش مجدد؛
- **پالت فرمان**: رفع دکمه نوار ابزار پالت فرمان وقتی میانبر آن سفارشی شده است؛
- **انتخاب محدوده شبکه‌ای**: رفع انتخاب محدوده در نمای شبکه‌ای که ورودی‌های خارج از محدوده را انتخاب می‌کرد؛
- **منوهای زمینه**: رفع باز ماندن منوهای زمینه آیتم انتخاب‌شده و پوشه فعلی پس از کلیک روی اقدام؛
- **ثبت میانبر**: رفع خطاهای ثبت میانبر پس از بارگذاری مجدد پنجره؛
- **اعمال تم**: رفع اعمال نشدن تم‌های انتخاب‌شده در همه پنجره‌ها؛
- **انتقال‌های macOS**: رفع مدیریت انتقال بین جلدها در macOS و فعال‌سازی اهداف باندل؛
- **مدیر فایل پیش‌فرض**: ایمن‌تر کردن بازگردانی رجیستری مدیر فایل پیش‌فرض Windows هنگام شکست فعال‌سازی یا بازگردانی مقادیر قبلی سیستم؛

![keyboard-scroll-floating-header](./public/changelog/assets/2.1.0/keyboard-scroll-floating-header.webp)

---

## [2.0.0-beta.3] - April 2026

**خلاصه:** سیستم افزونه‌ها با فروشگاه، اشتراک‌گذاری فایل در شبکه محلی، منوی دسترسی سریع، آرشیوهای zip، درایوهای WSL، ویرایش برچسب‌ها، بهبود نمای سریع و جستجو، بهبود جلوه‌های بصری، و بسیاری از بهبودهای تجربه کاربری و پایداری.

### ویژگی‌های جدید

#### سیستم افزونه‌ها

سیستم کامل افزونه‌ها با فروشگاه آزاد.

- **فروشگاه**: مرور، نصب و مدیریت افزونه‌ها از فروشگاه؛
- **نصب محلی**: می‌توانید افزونه‌ها را از پوشه محلی نصب کنید؛
- **پالت فرمان**: روش جدید برای فعال‌سازی فرمان‌های برنامه و افزونه‌ها؛
- **قابلیت‌ها**: افزونه‌ها می‌توانند میانبرهای محلی و سراسری، آیتم‌های منوی زمینه، تنظیمات، صفحات کامل و فرمان‌ها را ثبت کنند؛
- **نسخه‌بندی**: می‌توانید نسخه‌های مختلف افزونه‌ها را نصب کنید و به‌روزرسانی خودکار را فعال کنید؛
- **بومی‌سازی**: افزونه‌ها می‌توانند ترجمه‌هایی برای زبان‌های مختلف ارائه دهند؛
- **مدیریت فایل‌های اجرایی**: افزونه‌ها می‌توانند از فایل‌های اجرایی (ffmpeg، deno، node، yt-dlp، 7z و هر فایل اجرایی دیگری) استفاده کنند؛
- **اجرای ایزوله**: افزونه‌ها در محیط‌های ایزوله ESM با مجوزهای دقیق اجرا می‌شوند؛

#### مدیر فایل پیش‌فرض

اکنون می‌توانید SFM را به عنوان مدیر فایل پیش‌فرض در Windows تنظیم کنید (`تنظیمات > آزمایشی`). هنگامی که این تنظیم فعال باشد، بیشتر عملیات فایل سیستم به SFM هدایت می‌شوند:

- آیکون برنامه File Explorer؛
- میانبر `Ctrl+E`؛
- نمایش فایل در پوشه؛
- نمایش دانلودها (هنگام دانلود فایل در مرورگر)؛
- فرمان‌های ترمینال: "start {path}"، "code {path}" و غیره.
- و موارد بیشتر؛

نماهای سیستمی مانند "سطل بازیافت"، "کنترل پنل" و برنامه‌های عمیقاً یکپارچه مشابه به File Explorer بومی بازگردانده می‌شوند.

#### اشتراک‌گذاری در شبکه محلی

فایل‌ها و پوشه‌ها را مستقیماً از برنامه در شبکه محلی خود به اشتراک بگذارید و پخش کنید.

از دکمه نوار ابزار در ناوبر یا از منوی زمینه روی هر فایل یا پوشه‌ای به اشتراک‌گذاری شبکه محلی دسترسی پیدا کنید. هنگامی که یک اشتراک‌گذاری فعال است، کد QR و آدرس‌های قابل اشتراک‌گذاری نمایش داده می‌شوند. دو حالت در دسترس است:

- **پخش**: فایل‌ها و پوشه‌ها را از طریق مرورگر وب به هر دستگاهی در شبکه خود پخش کنید؛
- **FTP**: فایل‌ها را از طریق FTP برای دسترسی مستقیم از سایر برنامه‌ها به اشتراک بگذارید. می‌توانید فایل‌ها را از دستگاه دیگر دانلود و آپلود کنید؛

#### منوی دسترسی سریع

دکمه "داشبورد" در نوار کناری اکنون به عنوان منوی دسترسی سریع عمل می‌کند. با نگه داشتن ماوس روی آن، پنلی حاوی موارد دلخواه و برچسب‌گذاری شده شما باز می‌شود.

تمام آیتم‌های پنل ورودی‌های واقعی پوشه هستند - می‌توانید آیتم‌ها را به داخل و خارج بکشید و رها کنید، با کلیک راست منوی زمینه باز کنید و هرگونه عملیات استاندارد فایل را انجام دهید.

می‌توان در `تنظیمات > ظاهر رابط کاربری > باز کردن پنل دسترسی سریع با نگه داشتن ماوس` غیرفعال کرد.

#### آرشیوهای Zip

فشرده‌سازی و استخراج آرشیوهای zip مستقیماً از منوی عملیات مرورگر فایل:

- **استخراج**: استخراج فایل `.zip` در پوشه فعلی یا در یک پوشه با نام مشخص؛
- **فشرده‌سازی**: فشرده‌سازی فایل‌ها و پوشه‌های انتخاب شده در یک آرشیو `.zip`؛

#### تشخیص درایوهای WSL

در Windows، برنامه اکنون به طور خودکار توزیع‌های WSL نصب شده را شناسایی کرده و درایوهای آن‌ها را در ناوبر نمایش می‌دهد و به شما امکان مرور بومی سیستم فایل WSL را می‌دهد.

#### ویرایش برچسب‌ها

اکنون می‌توانید نام و رنگ برچسب‌ها را ویرایش کنید. انتخابگر برچسب را روی هر فایل یا پوشه‌ای باز کنید تا برچسب‌ها را تغییر نام دهید، رنگ آن‌ها را عوض کنید یا حذف کنید.

#### به‌روزرسانی درون‌برنامه‌ای

اکنون می‌توانید به‌روزرسانی‌ها را مستقیماً از اعلان به‌روزرسانی بدون ترک برنامه دانلود و نصب کنید.

#### کپی مسیر

افزودن گزینه "کپی مسیر" به منوی زمینه فایل و پوشه.

#### بستن تب‌های تکراری

افزودن قابلیت بستن تب‌های تکراری از نوار تب، با حذف تمام تب‌هایی که به همان پوشه اشاره می‌کنند.

#### منوهای زمینه صفحه اصلی و داشبورد

آیتم‌ها در صفحه اصلی و داشبورد اکنون دارای منوی زمینه کامل هستند که با قابلیت‌های موجود در ناوبر مطابقت دارد.

### تنظیمات جدید

- **نمایش بنر رسانه صفحه اصلی**: نمایش یا پنهان کردن بنر رسانه صفحه اصلی (`تنظیمات > ظاهر رابط کاربری > بنر رسانه صفحه اصلی`)؛
- **تأخیر راهنمای ابزار**: پیکربندی تأخیر قبل از نمایش راهنمای ابزار (`تنظیمات > ظاهر رابط کاربری > راهنمای ابزار`)؛
- **زمان نسبی**: نمایش زمان‌های اخیر به صورت نسبی، مثلاً "۵ دقیقه پیش" (`تنظیمات > عمومی > تاریخ / زمان`)؛
- **فرمت تاریخ و زمان**: پیکربندی فرمت ماه، فرمت منطقه‌ای، ساعت ۱۲ ساعته، ثانیه و میلی‌ثانیه (`تنظیمات > عمومی > تاریخ / زمان`)؛
- **محو پس‌زمینه دیالوگ**: تنظیم شدت محوشدگی پس‌زمینه دیالوگ‌ها (`تنظیمات > ظاهر رابط کاربری > تنظیمات سبک`)؛
- **فیلترهای روشنایی و کنتراست**: تنظیم فیلترهای سبک روشنایی و کنتراست برای رابط کاربری برنامه (`تنظیمات > ظاهر رابط کاربری > تنظیمات سبک`)؛
- **روشنایی رسانه پوشش**: تنظیم روشنایی رسانه پوشش جلوه‌های بصری (`تنظیمات > ظاهر رابط کاربری > جلوه‌های بصری`)؛
- **حالت ترکیب جلوه‌های بصری**: تنظیم حالت ترکیب برای جلوه‌های بصری، به شما امکان می‌دهد نحوه ترکیب رسانه پس‌زمینه با رابط کاربری برنامه را انتخاب کنید (`تنظیمات > ظاهر رابط کاربری > جلوه‌های بصری`)؛
- **توقف ویدیوی پس‌زمینه**: توقف بنر صفحه اصلی و ویدیوی پس‌زمینه هنگام بیکار بودن یا کمینه شدن برنامه (`تنظیمات > ظاهر رابط کاربری > جلوه‌های بصری`)؛
- **مدیر فایل پیش‌فرض**: تنظیم Sigma File Manager به عنوان مدیر فایل پیش‌فرض در Windows (`تنظیمات > آزمایشی`)؛
- **اجرا هنگام ورود به سیستم**: اجرای خودکار برنامه هنگام ورود به سیستم (`تنظیمات > عمومی > رفتار راه‌اندازی`)؛

### میانبرهای جدید

- **کپی مسیر پوشه فعلی** (`Ctrl+Shift+C`): کپی مسیر پوشه فعلی به کلیپ‌بورد؛
- **بارگذاری مجدد پوشه فعلی** (`F5`): بازخوانی لیست فایل‌های ناوبر؛
- **بزرگنمایی / کوچک‌نمایی** (`Ctrl+=` / `Ctrl+-`): افزایش یا کاهش بزرگنمایی رابط کاربری؛
- **تمام صفحه** (`F11`): تغییر حالت تمام صفحه؛

### زبان‌های جدید

- **هندی**؛
- **اردو**؛

### بهبودهای تجربه کاربری

#### بهبودهای نمای سریع

- **ناوبری رسانه**: ناوبری بین فایل‌ها در پوشه فعلی بدون بستن نمای سریع؛
- **پیش‌نمایش فایل متنی**: بهبود پیش‌نمایش فایل متنی با تشخیص صحیح رمزگذاری، ویرایش درون‌خطی و رندر markdown تجزیه‌شده؛

#### بهبودهای جستجوی سریع

- **تمام ویژگی‌ها**: جستجو بر اساس هر ویژگی فایل - نام، اندازه، تعداد آیتم‌ها، تاریخ تغییر، تاریخ ایجاد، تاریخ دسترسی، مسیر، یا نوع MIME (مثلاً `modified: today`، `mime: image`)؛
- **محدوده اندازه**: فیلتر بر اساس اندازه با استفاده از مقایسه‌ها و محدوده‌ها (مثلاً `size: >=2mb`، `size: 1mb..10mb`)؛

#### عملیات فایل

- **ایمنی حل تعارض**: بهبود ایمنی فایل در پنجره حل تعارض برای جلوگیری از از دست رفتن تصادفی داده‌ها؛
- **چسباندن یکبار مصرف**: آیتم‌های کپی شده فقط یکبار قابل چسباندن هستند تا از چسباندن‌های تکراری تصادفی جلوگیری شود؛
- **کپی متن**: امکان کپی متن رابط کاربری با `Ctrl+C` هنگامی که هیچ فایلی انتخاب نشده است؛

#### جلوه‌های بصری

- **مدیر پس‌زمینه**: افزودن مدیر پس‌زمینه به صفحه تنظیمات برای سفارشی‌سازی متمرکز پس‌زمینه؛
- **بازنشانی جلوه‌های پس‌زمینه**: افزودن دکمه بازنشانی به تنظیمات جلوه‌های پس‌زمینه؛

#### سایر موارد

- **کاهش حجم برنامه**: کاهش حجم بسته برنامه با حذف تصاویر پس‌زمینه داخلی با وضوح بالا و استفاده از پیش‌نمایش‌های فشرده در ویرایشگر بنر رسانه؛
- **جستجوی سراسری**: نمایش دکمه "نمایش تنظیمات" در حالت خالی و افزایش عمق جستجوی پیش‌فرض؛
- **میانبرهای Windows**: فایل‌های `.lnk` اکنون هدف خود را در ناوبر باز می‌کنند به جای اجرای خارجی؛
- **داشبورد**: بهبود چیدمان بخش برچسب‌گذاری شده؛
- **منوی زمینه نوار آدرس**: افزودن منوی زمینه به آیتم‌های نوار آدرس؛
- **منوی زمینه ناوبر**: نمایش منوی زمینه هنگام کلیک روی فضای خالی در ناوبر؛
- **باز کردن در تب جدید**: باز کردن پوشه‌ها در تب جدید با کلیک وسط ماوس؛
- **پیمایش تب**: پیمایش خودکار تب‌های جدید اضافه شده به محدوده دید؛
- **فوکوس منو**: منوها دیگر هنگام بسته شدن با کلیک خارج، فوکوس را به دکمه فعال‌کننده خود بازنمی‌گردانند؛
- **بستن جستجو**: بستن جستجوی سراسری با `Escape`؛
- **راه‌اندازی سریع‌تر**: بهبود اندکی سرعت راه‌اندازی برنامه با پیش‌بارگذاری تنظیمات در Rust؛
- **پوشه‌های کاربر**: افزودن قابلیت اضافه و حذف پوشه‌های کاربر در صفحه اصلی؛
- **محدودیت‌های لیست**: کاهش محدودیت‌ها برای ورودی‌های لیست پرتکرار و تاریخچه برای بهبود عملکرد؛

### بهبودهای رابط کاربری

- **آیکون‌های نوار ابزار**: یکسان‌سازی رنگ آیکون‌های نوار ابزار در سراسر برنامه؛
- **انیمیشن‌های کارت**: افزودن جلوه‌های ظاهر شدن تدریجی و متوالی به کارت‌ها؛
- **تم روشن**: بهبود رنگ‌ها و کنتراست تم روشن؛
- **پایداری راه‌اندازی**: بهبود پایداری بصری هنگام راه‌اندازی برنامه برای کاهش چشمک زدن؛
- **اعلان‌ها**: بهبود طراحی اعلان‌ها برای هماهنگی بهتر؛
- **پیمایش خودکار تب**: پیمایش خودکار تب انتخاب شده به محدوده دید هنگام باز کردن صفحه ناوبر؛
- **برچسب‌های مسیر ریشه**: نرمال‌سازی برچسب‌های مسیر ریشه در تب‌ها و پنل اطلاعات؛
- **ترجمه‌ها**: بهبود ترجمه‌ها در سراسر برنامه؛

### رفع اشکالات

- رفع مسدود شدن رابط کاربری هنگام کپی یا انتقال تعداد زیادی آیتم؛ افزودن نمایش پیشرفت عملیات فایل به مرکز وضعیت؛
- رفع مسدود شدن رابط کاربری هنگام حذف تعداد زیادی آیتم؛ افزودن نمایش پیشرفت حذف به مرکز وضعیت؛
- رفع مشکل باز نشدن منوی زمینه در نمای شبکه‌ای برای پوشه فعلی هنگامی که آیتم دیگری قبلاً منوی باز دارد؛
- رفع مشکل نمایش نامناسب تمام اطلاعات پوشه فعلی در پنل اطلاعات؛
- رفع ثبت شدن میانبرهای برنامه در پنجره نمای سریع به جای فقط پنجره اصلی؛
- رفع مشکل عدم پردازش فایل‌های کشیده شده از مرورگرهای وب؛
- رفع مشکل حفظ نشدن بخش‌های معتبر نام فایل‌ها از آدرس‌های URL خارجی؛
- رفع قابل کشیدن بودن بنر صفحه اصلی؛
- رفع مشکل عدم کلیدگذاری حافظه نهان آیکون سیستم بر اساس مسیر فایل که باعث نمایش آیکون‌های نادرست می‌شد؛
- رفع نمایش ورودی‌های ریشه Windows غیرقابل دسترس در ناوبر؛
- رفع مشکل شناسایی نشدن میانبرهای سفارشی در برخی چیدمان‌های صفحه‌کلید؛
- رفع اتصالات SSHFS در Linux؛
- رفع ایجاد ورودی‌های تکراری تاریخچه توسط نوار آدرس هنگام کلیک روی مسیر؛
- رفع عدم پاسخگویی نتایج جستجوی سراسری به ناوبری صفحه‌کلید؛
- رفع باز نشدن نتایج جستجوی سراسری هنگام کلیک؛
- رفع عدم همگام‌سازی وضعیت جستجوی سراسری پس از ایندکس‌گذاری تدریجی؛
- رفع مشکل عملکرد کشیدن و رها کردن فایل به خارج در برخی برنامه‌ها؛
- رفع طراحی ناهماهنگ نشان میانبر در سراسر برنامه؛
- رفع مشکل نمایش ستون‌های ناوبر در پنل‌های باریک؛

---

## [2.0.0-beta.2] - February 2026

**خلاصه:** میانبرهای سراسری، تنظیمات جدید، ویژگی‌های جدید، بهبود فیلتر فایل، بهبود نوار آدرس، بهبودهای بنر صفحه اصلی و رفع اشکالات.

### میانبرهای سراسری

اکنون می‌توانید از میانبرهای صفحه‌کلید برای تعامل با برنامه حتی زمانی که فوکوس نیست استفاده کنید.

میانبرهای اضافه شده:

- `Win+Shift+E` برای نمایش و فوکوس پنجره برنامه؛

### تنظیمات جدید

افزودن تنظیم برای انتخاب رفتار هنگام بسته شدن آخرین تب.

![تنظیم بستن آخرین تب](./public/changelog/assets/beta-2/setting-close-last-tab.png)

### ویژگی‌های جدید

افزودن ویژگی‌های پیش‌نمایش اولیه جدید:

- مکان‌های شبکه: امکان اتصال یک مکان شبکه (SSHFS (SSH) / NFS / SMB / CIFS)؛
- [Linux] نصب درایو: امکان جداسازی مکان‌ها؛

### فیلتر فایل

فیلتر فایل بهبود یافت:
- اکنون هنگام تغییر پوشه، به طور خودکار پاک و بسته می‌شود؛
- ویژگی "فیلتر هنگام تایپ" در پنل انتخاب شده فعال می‌شود، نه اولین پنل؛

### نوار آدرس

- بهبود طراحی و منطق تکمیل خودکار؛
- جداکننده‌های مسیر اکنون منوهای کشویی هستند که ناوبری سریع به هر پوشه والد را فراهم می‌کنند؛

![منوهای جداکننده](./public/changelog/assets/beta-2/divider-menus.png)

### بنر صفحه اصلی / جلوه‌های پس‌زمینه

- بهبود طراحی ویرایشگر بنر رسانه:
  - منوی گزینه‌های بنر رسانه اکنون به پایین باز می‌شود تا نمای آن را مسدود نکند؛
  - اکنون می‌توانید با کلیک خارج، ویرایشگر موقعیت پس‌زمینه را ببندید؛
  - ورودی URL به بالای پس‌زمینه‌های سفارشی منتقل شد؛
- تصاویر/ویدیوهای سفارشی می‌توانند در جلوه‌های بصری پس‌زمینه استفاده شوند؛
- برخی تصاویر پیش‌فرض بنر رسانه حذف شدند؛
- تصویر بنر جدید "Exile by Aleksey Hoffman" اضافه شد؛

### بهبودهای تجربه کاربری

- برنامه موقعیت پنجره قبلی را هنگام راه‌اندازی بازیابی می‌کند؛
- تب فعلی اکنون با میانبر `Ctrl+W` یا کلیک وسط ماوس قابل بستن است؛
- افزایش اندازه آیکون فایل در نمای شبکه‌ای؛

### رفع اشکالات

- رفع مشکل انتقال فایل‌ها بین تب‌ها که گاهی آن‌ها را به مکان اشتباه منتقل می‌کرد؛
- رفع مشکل نمایش گاهی آیکون‌های سیستمی اشتباه برای پوشه‌ها در ناوبر؛
- رفع ایجاد چندین نمونه برنامه و سینی؛
- رفع مشکل واکشی مجدد دوره‌ای داده‌ها توسط منوی افزونه‌های پوسته که باعث پیمایش اجباری لیست به بالا می‌شد؛

## [2.0.0-beta.1] - February 2026

**خلاصه:** بهبودهای اساسی قابلیت استفاده و طراحی شامل ناوبری صفحه‌کلید، میانبرهای جدید، باز کردن در ترمینال، بازخوانی خودکار پوشه، کشیدن و رها کردن، و بهبود جستجو و نماهای لیست.

### ناوبری صفحه‌کلید

ناوبری فایل‌ها با صفحه‌کلید با پشتیبانی کامل از چیدمان‌های شبکه‌ای و لیستی و نمای تقسیم شده.

- کلیدهای جهت‌نما برای ناوبری فضایی در نمای شبکه‌ای و ناوبری ترتیبی در نمای لیستی؛
- Enter برای باز کردن پوشه یا فایل انتخاب شده، Backspace برای بازگشت؛
- Ctrl+Left / Ctrl+Right برای تغییر فوکوس بین پنل‌های نمای تقسیم شده؛
- Ctrl+T برای باز کردن پوشه فعلی در تب جدید؛
- تمام میانبرهای ناوبری در تنظیمات > میانبرها قابل سفارشی‌سازی هستند؛

### بازخوانی خودکار پوشه

نمای ناوبر به طور خودکار هنگام ایجاد، حذف، تغییر نام یا تغییر فایل‌ها در پوشه فعلی بازخوانی می‌شود.

- اندازه فایل‌ها هنگام تغییر توسط برنامه‌های خارجی به طور خودکار به‌روزرسانی می‌شوند؛
- نظارت کارآمد بر سیستم فایل با تأخیر برای جلوگیری از بازخوانی‌های بیش از حد؛
- به‌روزرسانی‌های هوشمند مبتنی بر مقایسه فقط آیتم‌های تأثیرگذاری را تغییر می‌دهند و موقعیت پیمایش و انتخاب حفظ می‌شود؛

### کشیدن و رها کردن

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/beta-1/drag-and-drop.mp4"></video>

اکنون می‌توانید فایل‌ها و پوشه‌ها را برای کپی/انتقال آسان بکشید و رها کنید. بین پنل‌ها، از یا به لیست نتایج جستجو، از یا به برنامه‌های خارجی بکشید.

### تعارض‌های کپی

افزودن پنجره مودال برای حل آسان تعارض‌های کپی/انتقال.

### به‌روزرسانی خودکار

افزودن بررسی خودکار به‌روزرسانی‌ها (قابل کنترل از تنظیمات).

### ویرایشگر رسانه بنر صفحه اصلی

افزودن ویرایشگر برای سفارشی‌سازی بنر صفحه اصلی. اکنون می‌توانید تصاویر و ویدیوهای سفارشی آپلود کنید (هم فایل‌های محلی و هم فایل‌های URL راه دور پشتیبانی می‌شوند)

### بهبودهای نمای لیست

- بهبود طراحی و رفع مشکلات جزئی؛
- افزودن سفارشی‌سازی نمایش ستون‌ها: انتخاب ستون‌هایی که نمایش داده شوند؛
- افزودن مرتب‌سازی ستون: کلیک بر سربرگ ستون‌ها برای مرتب‌سازی ورودی‌ها؛
- چیدمان پیش‌فرض ناوبر به نمای لیستی تغییر یافت؛

### بهبودهای جستجوی سراسری

- به‌روزرسانی چیدمان و طراحی با پشتیبانی از کشیدن و رها کردن؛
- جستجو اکنون در حین ایندکس شدن درایوها نیز در دسترس است؛

### باز کردن در ترمینال

باز کردن پوشه‌ها در ترمینال مورد نظر مستقیماً از منوی زمینه.

- تشخیص خودکار ترمینال‌های نصب شده در Windows، macOS و Linux؛
- Windows Terminal تمام پروفایل‌های پوسته پیکربندی شده را با آیکون‌های فایل اجرایی نمایش می‌دهد؛
- ترمینال پیش‌فرض Linux به طور خودکار شناسایی و ابتدا نمایش داده می‌شود؛
- شامل حالت‌های عادی و مدیر/بالا دست؛
- میانبر پیش‌فرض: Alt+T؛

### بومی‌سازی

- افزودن زبان اسلوونیایی (با تشکر از: @anderlli0053)؛

### بهبودهای رابط کاربری / تجربه کاربری

- افزودن انتخابگر فونت: انتخاب فونت رابط کاربری از فونت‌های نصب شده سیستم؛
- افزودن منوی "ایجاد جدید" برای ایجاد سریع فایل‌ها یا پوشه‌ها؛
- نمایش نمای حالت خالی هنگام ناوبری به پوشه‌های خالی؛
- نوار وضعیت تعداد کل آیتم‌ها با تعداد پنهان شده را هنگام فیلتر شدن لیست نمایش می‌دهد؛
- آیتم‌های تازه ایجاد، کپی و منتقل شده به طور خودکار به محدوده دید پیمایش می‌شوند؛
- نوار ابزار کلیپ‌بورد یکبار زیر پنل‌ها نمایش داده می‌شود به جای هر پنل؛
- ساده‌سازی طراحی پنجره تغییر نام؛
- آیکون‌های نوار ابزار واکنش‌گرا که در اندازه‌های کوچک پنجره به منوی کشویی تبدیل می‌شوند؛
- حذف تب خالی "ناوبری" از تنظیمات؛
- تغییر نام یک پوشه اکنون مسیر آن را در تمام تب‌ها، فضاهای کاری، موارد دلخواه، برچسب‌ها، تاریخچه و آیتم‌های پرتکرار به‌روزرسانی می‌کند؛
- حذف یک فایل یا پوشه اکنون آن را از تمام لیست‌های ذخیره شده حذف می‌کند و تب‌های مرتبط را به صفحه اصلی هدایت می‌کند؛
- مسیرهای ناموجود در موارد دلخواه، برچسب‌ها، تاریخچه و آیتم‌های پرتکرار اکنون هنگام راه‌اندازی به طور خودکار پاکسازی می‌شوند؛

### رفع اشکالات

- رفع عدم به‌روزرسانی وضعیت ایندکس‌گذاری جستجوی سراسری به صورت لحظه‌ای؛
- رفع عدم به‌روزرسانی پنل نمای تقسیم شده هنگام حذف یا تغییر نام پوشه آن از پنل دیگر؛
- رفع بارگذاری تب‌ها با خطا هنگامی که مسیر ذخیره شده آن‌ها دیگر وجود ندارد؛
- رفع نمایش آیکون یکسان سیستمی برای تمام فایل‌های هم‌نوع به جای آیکون‌های منحصر به فرد هر فایل؛
- رفع عدم کارکرد میانبرهای صفحه‌کلید در پنل دوم نمای تقسیم شده؛
- رفع توقف کارکرد میانبرهای صفحه‌کلید پس از ناوبری صفحه؛
- رفع نشت حافظه با عدم پاکسازی شنونده‌های رویداد کلید فیلتر هنگام حذف از DOM؛
- Linux: افزودن پشتیبانی از بازیابی برنامه پیش‌فرض در منوی "باز کردن با"؛

---

## [2.0.0-alpha.6] - January 2026

**خلاصه:** پنجره تازه‌ها، نمای سریع، بهبودهای منوی زمینه و تنظیمات جدید.

### پنجره تازه‌ها

پنجره تاریخچه تغییرات که ویژگی‌ها و بهبودهای جدید هر نسخه را نمایش می‌دهد.

- به طور خودکار پس از به‌روزرسانی‌ها نمایش داده می‌شود (قابل غیرفعال‌سازی)؛
- مرور تمام نسخه‌ها؛
- مشاهده توضیحات و تصاویر دقیق برای هر ویژگی؛

### نمای سریع

پیش‌نمایش فایل‌ها بدون باز کردن کامل آن‌ها با استفاده از یک پنجره پیش‌نمایش سبک.

- `Space` یا گزینه "نمای سریع" در منوی زمینه را فشار دهید تا فایل‌ها را سریع مشاهده کنید؛
- بستن فوری با `Space` یا `Escape`.
- پشتیبانی از تصاویر، ویدیوها، صداها، فایل‌های متنی، PDF و موارد بیشتر؛

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/alpha-6/quick-view.mp4"></video>

### محاسبه اندازه پوشه

- اندازه پوشه‌ها اکنون به طور خودکار محاسبه می‌شود؛
- می‌توانید اندازه کل تمام پوشه‌ها، شامل تمام زیرپوشه‌ها و فایل‌ها، را به محض باز کردن هر پوشه‌ای مشاهده کنید؛

![باز کردن با](./public/changelog/assets/alpha-6/size.png)

### گزینه‌های جدید منوی زمینه

#### باز کردن با

- انتخاب برنامه‌ای که فایل با آن باز شود؛
- تنظیم پیش‌تنظیم‌های سفارشی برای باز کردن فایل‌ها در برنامه‌ها با پرچم‌ها؛
- مشاهده تمام برنامه‌های سازگار برای هر نوع فایل؛
- تنظیم برنامه‌های پیش‌فرض برای انواع خاص فایل؛

![باز کردن با](./public/changelog/assets/alpha-6/open-with.png)

#### افزونه‌های پوسته

- دسترسی به آیتم‌های منوی زمینه پوسته Windows؛
- دسترسی به افزونه‌های پوسته شخص ثالث (7-Zip، Git و غیره)؛

![افزونه‌های پوسته](./public/changelog/assets/alpha-6/shell-extensions.png)

### تنظیمات جدید

#### تشخیص درایو

- فوکوس برنامه هنگام اتصال درایوهای قابل جابجایی (قابل غیرفعال‌سازی)؛
- کنترل رفتار باز شدن خودکار Windows Explorer برای درایوهای قابل جابجایی؛

#### فیلتر هنگام تایپ

شروع به تایپ در هر جای ناوبر برای فیلتر فوری آیتم‌ها در پوشه فعلی؛

#### میانبر جستجوی تنظیمات

میانبر صفحه‌کلید جدید برای دسترسی سریع به جستجوی تنظیمات؛

#### داده‌های آمار کاربر

- افزودن بخش تنظیمات آمار؛
- در صفحه داشبورد می‌توانید تاریخچه، موارد دلخواه و آیتم‌های پرکاربرد را مشاهده، ناوبری و پاکسازی کنید؛

### بهبودهای جستجو

بهبود جستجوی سراسری با سیستم ترکیبی ایندکس شده + جستجوی مستقیم برای نتایج قابل اعتمادتر و به‌روزتر.

- جستجوها اکنون به طور مداوم کمتر از ۱ ثانیه طول می‌کشند (~۱ ترابایت درایو کاملاً پر)، فارغ از محل قرارگیری فایل‌ها در درایوها؛
- هنگام جستجوی "مسیرهای اولویت‌دار" (مسیرهایی که اغلب باز می‌کنید)، نتایج فوری دریافت می‌کنید و فایل‌ها حتی اگر تازه ایجاد شده و هنوز ایندکس نشده باشند پیدا می‌شوند.

#### مسیرهای اولویت‌دار شامل:
- پوشه‌های کاربر: دانلودها، اسناد، دسکتاپ، تصاویر، ویدیوها، موسیقی؛
- موارد دلخواه؛
- اخیراً باز شده؛
- پرکاربرد؛
- برچسب‌گذاری شده؛

---

## [2.0.0-alpha.5] - January 2026

**خلاصه:** عملیات فایل، جستجوی سراسری و سفارشی‌سازی میانبرها.

### جستجوی سراسری

جستجوی قدرتمند تمام دیسک که فایل‌ها را در تمام درایوها ایندکس و جستجو می‌کند. دارای تطبیق فازی برای یافتن فایل‌ها حتی با غلط‌های تایپی، ایندکس‌گذاری مجدد دوره‌ای خودکار، ایندکس‌گذاری اولویت‌دار برای پوشه‌های پرکاربرد و اسکن موازی اختیاری برای ایندکس‌گذاری سریع‌تر.

![جستجوی سراسری](./public/changelog/assets/alpha-5/search.png)

### عملیات فایل

پشتیبانی کامل از عملیات فایل با قابلیت‌های کپی، انتقال و حذف شامل پیگیری پیشرفت. همچنین شامل تغییر نام فایل و پوشه در محل.

### ویرایشگر میانبرها

سفارشی‌سازی تمام میانبرهای صفحه‌کلید در برنامه. مشاهده اتصالات فعلی، تشخیص تعارض‌ها و بازنشانی به پیش‌فرض.

### بهبودهای ناوبر

افزودن گزینه نمایش آیکون‌های سیستمی بومی برای فایل‌ها و پوشه‌ها به جای نمادهای مینیمالیستی. تب‌های ناوبری تنظیمات اکنون هنگام پیمایش به صفحه چسبیده می‌مانند.

---

## [2.0.0-alpha.4] - January 2026

**خلاصه:** صفحه اصلی، جلوه‌های بصری و گزینه‌های سفارشی‌سازی کاربر.

### صفحه اصلی

صفحه اصلی زیبا با بنر رسانه‌ای متحرک، لیست درایوها و دسترسی سریع به پوشه‌های رایج کاربر مانند اسناد، دانلودها، تصاویر و موارد بیشتر.

### جلوه‌های بصری

بخش جلوه‌های بصری قابل سفارشی‌سازی در تنظیمات که محوشدگی، شفافیت و جلوه‌های نویز را به پس‌زمینه برنامه اضافه می‌کند. از تنظیمات مختلف برای هر صفحه پشتیبانی می‌کند.

### ویرایشگر پوشه‌های کاربر

سفارشی‌سازی کارت‌های پوشه کاربر با عناوین، آیکون‌ها و مسیرهای سفارشی. شخصی‌سازی نحوه نمایش پوشه‌های دسترسی سریع در صفحه اصلی.

### ویرایشگر موقعیت بنر

تنظیم دقیق موقعیت پس‌زمینه‌های بنر صفحه اصلی. تنظیم بزرگنمایی، موقعیت افقی و عمودی برای ظاهر مناسب.

### بهبودهای تنظیمات

- جستجوی تنظیمات اکنون در هر زبانی کار می‌کند، نه فقط زبان فعلی؛
- برنامه آخرین تب تنظیمات بازدید شده را هنگام بارگذاری مجدد بازیابی می‌کند به جای باز کردن اولین تب هر بار؛

---

## [2.0.0-alpha.3] - December 2025

**خلاصه:** نمای ناوبر با تب‌ها، فضاهای کاری و سیستم طراحی جدید.

### نمای ناوبر

تجربه اصلی مرور فایل با سیستم تب مدرن با پشتیبانی از فضاهای کاری، طراحی جدید نوار ابزار پنجره با کنترل‌های یکپارچه، و ناوبری دوپنله برای مدیریت کارآمد فایل.

### تصاویر بندانگشتی ویدیو

افزودن تصاویر بندانگشتی پیش‌نمایش برای فایل‌های ویدیویی در ناوبر.

### مهاجرت سیستم طراحی

مهاجرت برنامه از Vuetify به Sigma-UI برای طراحی مدرن‌تر و فضادارتر با کیفیت کد بهبود یافته.

---

## [2.0.0-alpha.1] - January 2024

**خلاصه:** بازنویسی کامل با استفاده از فناوری‌های مدرن.

### مهاجرت به Tauri

Sigma File Manager نسخه ۲ از صفر با استفاده از Vue 3 Composition API، TypeScript و Tauri v2 بازسازی شده است. حجم نصب برنامه از ۱۵۳ مگابایت به تنها ۴ مگابایت در Windows کاهش یافت. حجم برنامه نصب شده از ۴۱۹ مگابایت به ۱۲ مگابایت کاهش یافت.

### پنل‌های قابل تغییر اندازه

افزودن ویژگی پنل‌های قابل تغییر اندازه که به شما امکان می‌دهد نمای ناوبر را به دو نیمه تقسیم کنید و با ۲ پوشه کنار هم کار کنید.

### ویژگی‌های اولیه

ناوبری پایه فایل با لیست پوشه، مدیریت پنجره با کنترل‌های کمینه‌سازی، بیشینه‌سازی و بستن، و ساختار اولیه صفحه تنظیمات.
