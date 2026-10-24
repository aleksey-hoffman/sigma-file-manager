# Değişiklik Günlüğü

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

**Özet:** Sistem panosu aracılığıyla diğer uygulamalarla entegrasyon, kutu seçimi, bağlı bölünmüş görünüm, bağlantı yönetimi, parola korumalı ZIP arşivleri, Windows'ta yerel Özellikler penceresi, genişletilmiş eklenti API'leri, İbranice dil desteği ve gezginde yapılan iyileştirmeler.

- [Yeni Özellikler](#yeni-özellikler)
  - [Sistem Panosu Entegrasyonu](#sistem-panosu-entegrasyonu)
  - [Kutu Seçimi](#kutu-seçimi)
  - [Bağlı Bölünmüş Görünüm](#bağlı-bölünmüş-görünüm)
  - [Bağlantı Yönetimi](#bağlantı-yönetimi)
  - [Yerel Özellikler Penceresi](#yerel-özellikler-penceresi)
  - [Liste Görünümünde Sütunları Yeniden Boyutlandırma ve Sıralama](#liste-görünümünde-sütunları-yeniden-boyutlandırma-ve-sıralama)
  - [Kök Konumlar Adresi](#kök-konumlar-adresi)
- [Eklentiler](#eklentiler)
  - [Eklenti API'leri ve Görünümleri](#eklenti-apileri-ve-görünümleri)
- [Yeni Ayarlar](#yeni-ayarlar)
- [Yeni Kısayollar](#yeni-kısayollar)
- [Yeni Diller](#yeni-diller)
- [Kullanıcı Deneyimi İyileştirmeleri](#kullanıcı-deneyimi-iyileştirmeleri)
  - [Arşiv Çıkarma](#arşiv-çıkarma)
  - [Izgara Sıralama](#ızgara-sıralama)
  - [Kabuk Uzantıları](#kabuk-uzantıları)
  - [Oturum Belleği](#oturum-belleği)
  - [Gezgin Performansı](#gezgin-performansı)
  - [Ana Sayfa ve Bağlam Menüleri](#ana-sayfa-ve-bağlam-menüleri)
- [Arayüz İyileştirmeleri](#arayüz-iyileştirmeleri)
- [Hata Düzeltmeleri](#hata-düzeltmeleri)

### Yeni Özellikler

#### Sistem Panosu Entegrasyonu

Sigma File Manager ile diğer uygulamalar arasında dosya, klasör ve görselleri sistem panosu aracılığıyla kopyalayıp yapıştırın.

- **Uygulamalar arası dosya aktarımı**: SFM'de öğeleri kopyalayın veya kesin ve Windows Dosya Gezgini gibi uygulamalara yapıştırın; diğer uygulamalardan kopyalanan yolları ve dosyaları da `Ctrl+V` ile gezgine yapıştırın;
- **Görsel yapıştırma**: tarayıcılardan ve diğer uygulamalardan kopyalanan görselleri doğrudan bir klasöre yapıştırın;
- **Çakışma pencereleri**: yapıştırılan öğeler zaten varsa `Yeniden adlandır` veya `Birleştir` seçeneğini kullanın; tek tek dosya çakışmalarını `Değiştir`, `Atla`, `İkisini de koru` veya `Tümüne uygula` seçenekleriyle çözün;
- **Pano araç çubuğu**: diğer uygulamalarda kopyalanan görseller ve dosya yolları için isteğe bağlı araç çubuğu önizlemesini kullanın;

Araç çubuğunun görünürlüğünü `Ayarlar > Arayüz görünümü > Pano` bölümünden ayarlayabilirsiniz. Araç çubuğu gizli olsa bile `Ctrl+V` ile yapıştırma çalışır.

![system-clipboard](./public/changelog/assets/2.2.0/system-clipboard.webp)

#### Kutu Seçimi

Gezginde boş alanda sürükleyerek bir seçim kutusuyla birden fazla öğe seçin.

- **Değiştiriciler**: mevcut seçime eklemek için `Ctrl` veya `Shift` tuşunu, seçimi tersine çevirmek için `Alt` tuşunu basılı tutun;
- **Daha kolay hedefleme**: sürüklemeyi daha kolay başlatmak için isteğe bağlı olarak liste öğelerinin iç boşluğunu ve ızgara aralıklarını artırın;

Bu özelliği `Ayarlar > Genel > Dosya görünümü > Kutu seçimini etkinleştir` bölümünden etkinleştirin.

![box-selection](./public/changelog/assets/2.2.0/box-selection.webp)

#### Bağlı Bölünmüş Görünüm

Daha sade, sütun düzenine benzer bir iş akışı sunan yeni `Bağlı` bölünmüş görünüm modunda, ilk panelde bir klasöre tıkladığınızda klasörün içeriği ikinci panelde gösterilir.

Mevcut bağımsız `Bölünmüş` modu değişmedi. Modu gezgin seçenekleri menüsündeki `Bölünmüş görünüm modu` bölümünden seçin veya `Ctrl+S` ile bölünmüş görünümü açıp kapatın.

Bilgi paneli simgesi de bölünmüş görünüm simgesinden daha kolay ayırt edilecek şekilde güncellendi.

![linked-split-view](./public/changelog/assets/2.2.0/linked-split-view.webp)

#### Bağlantı Yönetimi

Dosya sistemi bağlantılarını doğrudan gezginden oluşturun ve inceleyin.

- **Bağlantı oluşturma**: bağlam menüsündeki `Bağlantı oluştur` seçeneğiyle sembolik bağlantılar, kısayollar, sabit bağlantılar ve birleşimler oluşturun;
- **Bağlantı sütunları**: `Tür`, `Bağlantılar`, `Bağlantı hedefi` ve `Bağlantı durumu` için isteğe bağlı liste sütunlarını kullanın (`Geçerli`, `Bozuk`, `Bilinmiyor`, `Desteklenmiyor`);
- **Açma davranışı**: dizin kısayolları ve sembolik bağlantı klasörleri hedeflerine yönlendirir; diğer bağlantı hedefleri varsayılan uygulamayla açılır;

![link-handling](./public/changelog/assets/2.2.0/link-handling.webp)

#### Yerel Özellikler Penceresi

Windows'ta seçili öğeler için sistemin yerel `Özellikler` iletişim kutusunu bağlam menüsünden, eylemler menüsünden, `Alt+Enter` ile veya `Alt` + çift tıklamayla açın.

![native-properties](./public/changelog/assets/2.2.0/native-properties.webp)

#### Liste Görünümünde Sütunları Yeniden Boyutlandırma ve Sıralama

Liste görünümü sütunlarını çalışma biçiminize göre yeniden boyutlandırabilir ve sıralayabilirsiniz.

- **Yeniden boyutlandır**: genişlikleri değiştirmek için sütun kenarlarını sürükleyin;
- **Sıralama ve görünürlük**: sütunların sırasını ve görünürlüğünü liste başlığındaki `Sütunlar` açılır menüsünden yönetin;
- **Genişlik seçenekleri**: `Kullanılabilir genişliği doldur` ve `En küçük genişlikleri ayarla` seçeneklerini kullanın;

![list-column-resize](./public/changelog/assets/2.2.0/list-column-resize.webp)

#### Kök Konumlar Adresi

Kök `Konumlar` adresi, sürücüler ve sanal konumlar arasında daha hızlı geçiş yapabilmeniz için bunları tek bir yerde listeler.

- **Adres çubuğu**: bir sürücünün kök dizininden yukarı çıkın veya adres çubuğu ya da adres düzenleyici üzerinden `Konumlar`ı açın;
- **Sık kullanılanlar ve etiketler**: `Konumlar`, diğer dizinler gibi sık kullanılanlara eklenebilir ve etiketlenebilir;
- **Bölünmüş görünüm**: gezginden ayrılmadan panellerde farklı sürücülere geçmek için özellikle kullanışlıdır;

![root-locations-address](./public/changelog/assets/2.2.0/root-locations-address.webp)

### Eklentiler

#### Eklenti API'leri ve Görünümleri

Eklentiler artık ana uygulamanın daha fazla özelliğine ve yeni arayüz bileşenlerine erişebilir.

- **Yerel ikili dosyalar**: eklenti bağımlılıklarını otomatik kurulumla veya elle seçilen yerel ikili dosyalarla yapılandırın (`Eklentiler > Bağımlılıklar`);
- **HTTP istekleri**: eklentiler, manifestlerinde izin verilen adreslere HTTP istekleri gönderebilir;
- **Görünüm denetimi**: eklentiler gezgin düzeni ve sıralama tercihlerini uygulayabilir (görünüm izniyle);
- **Pano API'si**: eklentiler panoyu okuyup yazabilir (izinle);
- **Liste ve ayrıntı görünümü**: aranabilir bir liste ile ayrıntı panelini bir araya getiren yeni eklenti arayüzü;

![extension-local-binaries](./public/changelog/assets/2.2.0/extension-local-binaries.webp)

![extension-dependency-config](./public/changelog/assets/2.2.0/extension-dependency-config.webp)

![extension-list-detail](./public/changelog/assets/2.2.0/extension-list-detail.webp)

![extension-http-api](./public/changelog/assets/2.2.0/extension-http-api.webp)

### Yeni Ayarlar

- **Kutu seçimini etkinleştir**: boş alanda sürükleyerek birden fazla öğe seçin;
  `Ayarlar > Genel > Dosya görünümü > Kutu seçimini etkinleştir`
- **Dosya görünümü boşluklarını artır**: öğeleri daha kolay hedeflemek için liste iç boşluğunu ve ızgara aralıklarını artırın;
  `Ayarlar > Genel > Dosya görünümü > Dosya görünümü boşluklarını artır`
- **Quick View penceresini bellekte tut**: anında açılması için Quick View'ı bellekte yüklü tutun (yaklaşık 200 MB kullanır);
  `Ayarlar > Genel > Performans > Quick View penceresini bellekte tut`
- **Yazdırma penceresini bellekte tut**: anında açılması için Yazdırma penceresini bellekte yüklü tutun (yaklaşık 200 MB kullanır);
  `Ayarlar > Genel > Performans > Yazdırma penceresini bellekte tut`
- **Harici görseller için pano araç çubuğu**: diğer uygulamalarda kopyalanan görseller için pano araç çubuğunu göster;
  `Ayarlar > Arayüz görünümü > Pano`
- **Harici yollar için pano araç çubuğu**: diğer uygulamalarda kopyalanan dosya yolları için pano araç çubuğunu göster;
  `Ayarlar > Arayüz görünümü > Pano`
- **Dinamik bilgi paneli boyutu**: bilgi panelinin boyutunun içeriğe göre otomatik ayarlanmasını sağlayın; paneli elle yeniden boyutlandırmak bu seçeneği kapatır;
  `Ayarlar > Arayüz görünümü > Bilgi paneli > Dinamik bilgi paneli boyutu`
- **Bilgi paneli önizlemesinde tam boyutlu görüntü göster**: bilgi panelinde tam çözünürlüklü görselleri göster;
  `Ayarlar > Arayüz görünümü > Bilgi paneli > Bilgi paneli önizleme alanında tam boyutlu görüntüyü göster`
- **Video önizlemesini varsayılan olarak sessize al**: gezinirken bilgi paneli video önizlemelerini sessize al;
  `Ayarlar > Arayüz görünümü > Bilgi paneli > Video önizlemesini varsayılan olarak sessize al`
- **Video önizlemelerini otomatik oynat**: seçildiğinde bilgi panelinde videoları otomatik oynat;
  `Ayarlar > Arayüz görünümü > Bilgi paneli > Video önizlemelerini otomatik oynat`

### Yeni Kısayollar

- **Yerel Özellikler** (`Alt+Enter`): Windows'ta seçili öğelerin yerel Özellikler penceresini açın;

### Yeni Diller

- **İbranice** (`עברית`): sağdan sola yerleşim desteğiyle eksiksiz çeviri (`Ayarlar > Genel > Dil`);

### Kullanıcı Deneyimi İyileştirmeleri

#### Arşiv Çıkarma

ZIP çıkarma artık parolayla korunan arşivleri ve UTF-8 olmayan dosya adlarını destekler.

- **Parola korumalı ZIP**: çıkarma sırasında istendiğinde arşiv parolasını girin;
- **Dosya adı kodlaması**: `Arşiv çıkarma seçenekleri` bölümünden kodlama seçin; otomatik algılama tercih edilir, bölgesel kodlamalar ise gruplandırılmış yedek seçenekler olarak sunulur;

![archive-extraction-options](./public/changelog/assets/2.2.0/archive-extraction-options.webp)

![archive-extraction-encoding](./public/changelog/assets/2.2.0/archive-extraction-encoding.webp)

#### Izgara Sıralama

Izgara düzeni artık gezgin seçenekleri menüsünde kendine ait sıralama denetimleri sunar.

- **Sıralama ölçütü**: Ad, Öğeler, Boyut, Değiştirilme, Oluşturulma, Etiketler, Tür, Bağlantılar ve Bağlantı durumu;
- **Yön**: artan veya azalan sıralama tercihi, liste görünümünün sıralamasından ayrı olarak saklanır;

![grid-sorting](./public/changelog/assets/2.2.0/grid-sorting.webp)

#### Kabuk Uzantıları

Bağlam menüsünde, diğer uygulamaların kaydettiği modern kabuk uzantısı eylemleri `Kabuk uzantıları` altında gösterilebilir.

![shell-extensions](./public/changelog/assets/2.2.0/shell-extensions.webp)

#### Oturum Belleği

Bir sayfa veya panelden ayrılıp aynı oturumda geri döndüğünüzde kaydırma konumları ve etkin sekmeler geri yüklenir.

#### Gezgin Performansı

Büyük klasörlere ve medya dosyalarına göz atmak artık daha hızlıdır ve daha az bellek kullanır.

- **İlk yükleme**: dizinler açılırken ilk yükleme daha hızlı tamamlanır;
- **Simge yükleme**: özel ve sistem simgeleri daha az gecikmeyle görünür;
- **Liste kaydırma**: büyük dizinlerde daha akıcı liste kaydırma;
- **Medya önizlemeleri**: görsel, GIF ve video önizlemeleri daha duyarlıdır ve daha az bellek kullanır;
- **Dizin oluşturma**: genel arama için dizin oluşturma işlemi daha kararlıdır;

#### Ana Sayfa ve Bağlam Menüleri

- **Bağlantıyı kes**: desteklendiğinde ağ bağlantılarını veya çıkarılabilir aygıt bağlantılarını bağlam menüsünden kesin;
- **Tüm yinelenenleri kapat**: sekme menüsündeki `Tüm yinelenenleri kapat` seçeneği artık yalnızca geçerli sekmenin yinelenenlerini değil, çalışma alanındaki tüm yinelenen yolları kapatır;
- **Sağ tıklamayla seçimi temizleme**: gezginin boş arka planına sağ tıklamak, arka plan menüsü açılmadan önce geçerli seçimi temizler;
- **Ana sayfa eylemleri**: ana sayfa bağlam menüleri bir eylem seçildikten sonra kapanır, `Yeni sekmede aç` gezgini açar ve yeni sekmeler görünür alana kaydırılır;
- **Pencere sürükleme bölgesi**: Linux tarzı başlık çubuklarında sürükleme bölgesi, pencereyi daha kolay taşımak için araç çubuğu düğmelerinin üzerine uzanır;

![window-drag-region](./public/changelog/assets/2.2.0/window-drag-region.webp)

### Arayüz İyileştirmeleri

- **Etkin panel göstergesi**: bölünmüş görünüm açıkken durum çubuğunda etkin paneli daha net gösteren bir işaretçi;
- **Yeniden boyutlandırılabilir bilgi paneli**: bilgi panelinin genişliğini ve önizleme ile ayrıntılar arasındaki bölmeyi sürükleyerek yeniden boyutlandırın;
- **Kompakt bilgi paneli**: bilgi panelindeki özellikler için daha yoğun bir düzen;
- **Bağlam menüsü eylemleri**: `Kartı düzenle` seçeneği bir eylem düğmesi olarak gösterilir; eylem düğmeleri genel olarak daha küçüktür;
- **Gezgin stilleri**: uyarlanabilir düzen, bölünmüş görünümdeki etkin sekme stilleri ve komut paletindeki eklenti görünümü tasarımı iyileştirildi;
- **RTL düzen**: sağdan sola diller için daha temiz hizalama;

![resizable-info-panel](./public/changelog/assets/2.2.0/resizable-info-panel.webp)

![compact-info-panel](./public/changelog/assets/2.2.0/compact-info-panel.webp)

### Hata Düzeltmeleri

- **Yazarak arama**: Latin olmayan klavye düzenlerinde hızlı aramanın etkinleşmemesi düzeltildi;
- **Dizin yükleme**: bir dizin yüklendikten sonra girdilerin kendiliğinden yeniden sıralanması düzeltildi;
- **Özel simgeler**: özel simgelerin belirgin gecikmeyle yüklenmesi düzeltildi;
- **Izgara kartları**: ızgara düzeni kartlarının yüklenirken boyut değiştirmesi düzeltildi;
- **Izgara kaydırma çubuğu**: ızgara kaydırma çubuğunun yapışkan başlıkların arkasında gizlenmesi düzeltildi;
- **Hızlı seçim**: hızlı dosya seçiminin bazen dosyayı açması düzeltildi;
- **Terminal kısayolu**: `Alt+T` seçili girdi yerine geçerli dizin için terminal açacak şekilde düzeltildi;
- **Dosyaları aç**: açılan dosyaların yanlış çalışma dizininden başlatılması düzeltildi;
- **SMB paylaşımları**: SMB paylaşımlarındaki dosyaların açılamaması düzeltildi;
- **WSL yolları**: Windows'ta WSL ana bilgisayarının UNC yollarını işleme sorunu düzeltildi; `//wsl.localhost` sanal dağıtım listesine eklendi;
- **Varsayılan dosya yöneticisi**: ayar doğrudan Windows kurulumlarında kullanılmaya devam eder; Microsoft Store sürümünde artık kullanılamaz olarak gösterilir;
- **AppImage (Linux)**: `Could not create default EGL display: EGL_BAD_PARAMETER` hatası düzeltildi;
- **Eklenti yükleme (Linux)**: çok dosyalı dağıtım paketine sahip eklentilerdeki yükleme hataları düzeltildi;
- **Eklenti ayrıntıları**: genel bakış sayfasındaki hizalama stilleri düzeltildi;
- **Cihaz uyanması**: cihaz uyandıktan sonra uygulamanın yükleme durumunda takılması düzeltildi;
- **Güncelleme bildirimleri**: henüz yayımlanmamış sürümler için güncelleme bildirimlerinin görünmesi düzeltildi;
- **RTL**: sağdan sola düzen sorunları düzeltildi;
- **Çeviriler**: eksik ve yanlış çeviri dizeleri düzeltildi;

---

## [2.1.0] - May 2026

**Özet:** Gezgin performansındaki iyileştirmeler, otomatik oluşturulan küçük resimler, eklenti temaları, yazdırma, dosya önizlemeleri, yeni kısayollar, geliştirilmiş adres düzenleyici, yeniden tasarlanan durum merkezi ve sekme ile gezinti deneyimindeki iyileştirmeler.

- [Yeni Özellikler](#yeni-özellikler)
  - [Yazdırma](#yazdırma)
  - [Dosyaları Sekmelere Bırakma](#dosyaları-sekmelere-bırakma)
  - [Bilgi Panelinde Dosya Önizleme](#bilgi-panelinde-dosya-önizleme)
  - [Gezginin Liste Görünümü Sütunları](#gezginin-liste-görünümü-sütunları)
- [Eklentiler](#eklentiler)
  - [Eklentilerin Sağladığı Uygulama Temaları](#eklentilerin-sağladığı-uygulama-temaları)
  - [Eklentilerin Sağladığı Simge Temaları](#eklentilerin-sağladığı-simge-temaları)
- [Yeni Ayarlar](#yeni-ayarlar)
- [Yeni Kısayollar](#yeni-kısayollar)
- [Kullanıcı Deneyimi İyileştirmeleri](#kullanıcı-deneyimi-iyileştirmeleri)
  - [Büyük Dizin Performansı](#büyük-dizin-performansı)
  - [Hızlı Arama](#hızlı-arama)
  - [Adres Düzenleyici](#adres-düzenleyici)
  - [Durum Merkezi](#durum-merkezi)
  - [Gezinti ve Sekmeler](#gezinti-ve-sekmeler)
  - [Kısayol Yönetimi](#kısayol-yönetimi)
- [Arayüz İyileştirmeleri](#arayüz-iyileştirmeleri)
- [Hata Düzeltmeleri](#hata-düzeltmeleri)

### Yeni Özellikler

#### Yazdırma

Seçili dosyaları bağlam menüsü, eylemler menüsü veya `Ctrl+O` aracılığıyla doğrudan gezginden yazdırın.

- **Desteklenen biçimler**: görseller, PDF, metin biçimleri;
- **Hızlı çıkış**: yazdırma görünümünü `Escape` ile kapatın;

![printing](./public/changelog/assets/2.1.0/printing.webp)

#### Dosyaları Sekmelere Bırakma

Dosya veya dizinleri sekmelere sürükleyerek başka bir sekmede açık olan dizine taşıyın veya kopyalayın.

- **Bırakma hedefi olarak sekmeler**: gezginde dosya sürüklerken sekmeleri bırakma hedefi olarak kullanın;
- **Üzerine gelince etkinleştirme**: sürükleme sırasında bir sekmenin üzerinde beklediğinizde, öğeyi bırakmadan önce o sekme etkinleşir;
- **Bölünmüş sekmeler**: dizin sekme grupları, bölünmüş görünümün sekme yapısını korurken normal bırakma davranışını sürdürür;

![file-drop-to-tabs](./public/changelog/assets/2.1.0/file-drop-to-tabs.webp)

#### Bilgi Panelinde Dosya Önizleme

Bilgi paneli artık yalnızca görselleri ve videoları değil, Quick View'ın desteklediği tüm dosya türlerini önizleyebilir.

- **Medya önizlemeleri**: görseller için oluşturulan küçük resimler kullanılır, video ve ses dosyalarında yerel denetimler sunulur, PDF'ler ise panel içinde görüntülenir;
- **Metin önizlemeleri**: metin dosyaları, güvenli bir boyut sınırıyla kod çözümü yapılmış kompakt bir önizleme gösterir;
- **Yedek görünüm**: desteklenmeyen dosya ve klasörler için basit simge yer tutucuları gösterilmeye devam eder;

![info-panel-file-preview](./public/changelog/assets/2.1.0/info-panel-file-preview.webp)

#### Gezginin Liste Görünümü Sütunları

Liste görünümü artık daha fazla isteğe bağlı sütun sunuyor ve meta verilerin doğrudan satır üzerinden yönetilmesini kolaylaştırıyor.

- **Oluşturulma sütunu**: oluşturma tarihini görüntüleyin ve bu tarihe göre sıralayın;
- **Etiketler sütunu**: etiketleri doğrudan liste görünümünde görüntüleyin; sütun üzerinden etiket ekleyin, kaldırın veya düzenleyin;

![navigator-list-columns](./public/changelog/assets/2.1.0/navigator-list-columns.webp)

### Eklentiler

#### Eklentilerin Sağladığı Uygulama Temaları

Eklentiler artık uygulamanın tamamında kullanılabilen renk temaları sağlayabilir. Yüklü tema eklentileri tema seçicide görünür.

#### Eklentilerin Sağladığı Simge Temaları

Eklentiler artık klasörler ve dosyalar için gezgin simge temaları sağlayabilir.

- **Ayrı seçimler**: klasör ve dosya simge temalarını `Ayarlar > Arayüz görünümü > Simge teması` içinde bağımsız seçin;
- **Yerleşik ve eklenti temaları**: yerleşik varsayılan veya sistem simge temalarını ya da etkinleştirilmiş herhangi bir eklenti temasını kullanın;
- **Tema eşleştirme**: eklentilerin sağladığı temalar dosya uzantısına, dosya adına, klasör adına ve klasörün genişletilmiş olup olmamasına göre simgeler tanımlayabilir;

### Yeni Ayarlar

- **Etkin sekme metnini kalın yap**: etkin sekme başlığını kalın yapın (`Ayarlar > Sekmeler > Sekme görünümü > Etkin sekme metnini kalın yap`);

![bold-active-tab-text-setting](./public/changelog/assets/2.1.0/bold-active-tab-text-setting.webp)

### Yeni Kısayollar

- **Bölünmüş görünümü aç/kapat** (`Ctrl+S`): gezginde bölünmüş görünümü gösterin veya gizleyin;
- **Kapatılan sekmeyi geri yükle** (`Ctrl+Shift+T`): en son kapatılan sekme grubunu geri yükleyin;
- **Dosya / dizin oluştur** (`Ctrl+Shift+M` / `Ctrl+Shift+N`): geçerli dizinde yeni bir dosya veya dizin oluşturun;
- **Seçili dosyayı yazdır** (`Ctrl+O`): seçili dosyayı yazdırın;
- **Kopyalanan yolu aç** (`Ctrl+Shift+V`): panodaki geçerli bir yolu açın;
- **Sayfalar arasında geç** (`Alt+1` - `Alt+5`): Ana Sayfa, Gezgin, Gösterge Paneli, Ayarlar ve Eklentiler arasında geçiş yapın;
- **Dizin geçmişinde gezin** (`Alt+Left` / `Alt+Right`): gezgin geçmişinde geri veya ileri gidin;
- **Üst dizine git** (`Alt+Up`): üst dizine gidin;
- **Fare geçmiş düğmeleri** (`Mouse Button 4` / `Mouse Button 5`): farenin yan düğmeleriyle geri ve ileri gidin;

![create-file-directory-shortcuts](./public/changelog/assets/2.1.0/create-file-directory-shortcuts.webp)

![navigator-shortcuts](./public/changelog/assets/2.1.0/navigator-shortcuts.webp)

### Kullanıcı Deneyimi İyileştirmeleri

#### Büyük Dizin Performansı

Gezinti, hızlı arama ve yoğun medya içeren klasörler artık daha hızlı yanıt verir ve daha az bellek kullanır.

- **Oluşturulan küçük resimler**: her dosya kartında tam boyutlu medya yüklemek yerine görsel ve videolar için daha küçük boyutlarda önizlemeler oluşturulur;
- **Aşamalı görseller**: ızgara görsel kartları, nihai küçük resim hazır olana kadar bulanık düşük çözünürlüklü bir küçük resim gösterebilir;
- **Küçük resim oluşturmayı iptal etme**: klasör veya görünür girdiler değiştiğinde küçük resim oluşturma işlemi iptal edilebilir;
- **Görüntüleme performansı**: büyük dizinlerdeki girdiler daha verimli görüntülenir; Quick View ise oluşturulan küçük resimleri sanal bir listeyle gösterir;

![low-res-image-thumbnail-preview](./public/changelog/assets/2.1.0/low-res-image-thumbnail-preview.webp)

#### Hızlı Arama

Hızlı aramanın artık iki modu vardır: pasif ve etkin:

- **Pasif mod**: yazmaya başladığınızda otomatik olarak etkinleşir. Arama alanına odaklanmadan girdileri filtreler ve gezinmeyi engellemez.
- **Etkin mod**: `Ctrl+F` ile etkinleşir. Arama alanına odaklanır ve gezinmeyi engeller ancak girilen sorgu üzerinde daha ayrıntılı denetim sağlar.

Diğer değişiklikler:

- **Yazarak filtreleme**: alfasayısal tuşlara basmak artık etkin panelde her zaman hızlı aramayı (pasif mod) başlatır;
- **Klavye gezintisi**: ilk eşleşen öğe otomatik seçilir;
- **Açılır panel tasarımı**: hızlı arama paneli artık daha kompakttır ve dizin öğelerinin üzerini kapatmaz;

![quick-search](./public/changelog/assets/2.1.0/quick-search.webp)

#### Adres Düzenleyici

Adres düzenleyici artık daha kapsamlı bir yol açma aracı olarak kullanılabilir.

- **Dosyalar ve dizinler**: adres düzenleyiciden dizinlerin yanı sıra dosyaları da açın;
- **Sık kullanılan yollar**: sık kullandığınız yolları hızla açmaya odaklanan moda geçin;
- **Öneriler**: dizin girdilerine, tam eşleşmelere, son yollara, etiketli öğelere, kullanıcı klasörlerine ve sistem sürücülerine göz atın;
- **Klavye eylemleri**: düzenleyiciden geri, ileri veya yukarı gidin ve bir girdiyi üst dizininde görüntüleyin;

![address-editor](./public/changelog/assets/2.1.0/address-editor.webp)

#### Durum Merkezi

Durum merkezi artık daha anlaşılır işlem grupları sunan, araç çubuğuna yerleştirilmiş kompakt bir bileşendir.

- **Etkin işlem sayısı**: araç çubuğu düğmesi, etkin işlem sayısını gösteren bir rozete dönüşür;
- **İşlem grupları**: etkin ve tamamlanan işlemler birbirinden ayrılır; tamamlanan işlemler daraltılabilir bir bölümde gösterilir;
- **Tümünü iptal et**: etkin işlemlerin tümünü bölüm başlığından tek seferde iptal edin;
- **İşlem kartları**: işlem kartlarında `Kopyalama | Başarılı` veya `Arşiv | Hata` gibi daha anlaşılır tür ve durum etiketleri gösterilir;
- **Pano kurtarma**: yapıştırma işlemi, bir görev kuyruğa alındığında panoyu hemen temizler ve görev başarısız olursa içeriği geri yükler;

![status-center](./public/changelog/assets/2.1.0/status-center.webp)

#### Gezinti ve Sekmeler

Gezginde dolaşma ve sekme davranışları artık daha öngörülebilirdir.

- **Kenar çubuğundaki sürücüler**: gezinti kenar çubuğunda bir sürücüye tıkladığınızda sürücü geçerli sekmede açılır;
- **Geçerli dizin**: adresin geçerli dizini gösteren son bölümü daha belirgindir; bu bölümün bağlam menüsü, üzerine sağ tıklayarak açılır;
- **Kapatılan sekmeler**: geri yüklenen sekmeler önceki konumlarına döner, yeniden adlandırılmış yolları korur ve silinen yolları ana sayfaya yönlendirir;
- **Duyarlı düzen**: araç çubuğundaki gezinti düğmeleri daha erken daralır, çok dar panellerde bölünmüş görünüm adres çubukları ikinci satıra geçer ve kompakt sekmeler tutarlı yüksekliklerini korur;

![nav-sidebar-drive-current-tab](./public/changelog/assets/2.1.0/nav-sidebar-drive-current-tab.webp)

![current-directory-address-bar](./public/changelog/assets/2.1.0/current-directory-address-bar.webp)

#### Kısayol Yönetimi

Kısayol düzenleme arayüzü artık çakışmaları ve özelleştirmeleri daha anlaşılır biçimde yönetir.

- **Birden fazla atama**: bir eyleme birden fazla kısayol atayın;
- **Kısayol atamasını kaldırma**: atanmış kısayolları kaldırın;
- **Çakışan kısayolu değiştirme**: çakışan bir kısayolu doğrudan çakışma iletişim kutusundan değiştirin;
- **Kısayol listesi menüsü**: kısayol listesindeki bir bağlam menüsünden kısayolları yönetin;

![shortcut-editor](./public/changelog/assets/2.1.0/shortcut-editor.webp)

#### Sürükle ve Bırak

`Alt+Tab` ile uygulamalar arasında geçerken dışarı sürükleme işlemini başlatabilirsiniz. Böylece dosyaları, yalnızca imleci pencerenin dışına çıkararak değil, uygulama değiştirerek de dışarı sürükleyebilirsiniz;

### Arayüz İyileştirmeleri

- **Seçim halkası**: gezgin seçim halkasının opaklığı ve konumu, panel başlığı stilleri ve klavye odak davranışı iyileştirildi;
- **Sekme çubuğu**: sekme çubuğunun stilleri ve etkin sekmenin okunabilirliği iyileştirildi;
- **Tema seçimi**: tema seçme arayüzünün tasarımı iyileştirildi;
- **Hızlı erişim**: hızlı erişim panelinin stilleri geliştirildi;
- **Açılış ekranı**: uygulama başlatılırken gösterilen bir açılış ekranı eklendi;
- **Açılır panel görünürlüğü**: yarı saydam açılır panel öğelerinin görünürlüğü iyileştirildi;
- **Araç ipuçları**: daha fazla araç çubuğu düğmesine araç ipuçları eklendi;
- **Çeviriler**: Japonca ve Vietnamca çeviri metinleri iyileştirildi, yerelleştirme yapısı sadeleştirildi;

![selection-ring](./public/changelog/assets/2.1.0/selection-ring.webp)

![tab-bar-styles](./public/changelog/assets/2.1.0/tab-bar-styles.webp)

![narrow-window-layout](./public/changelog/assets/2.1.0/narrow-window-layout.webp)

### Hata Düzeltmeleri

- **Eşlenmiş sürücüler**: eşlenmiş ağ sürücülerinden uygulama dışına sürükleyip bırakmanın çalışmaması düzeltildi;
- **Klavye kaydırma**: ilk satırın yapışkan başlığın arkasında gizlenmesi düzeltildi;
- **Başlangıç donması**: başlangıç ve güncelleme kontrolleri sırasında yavaş senkron sistem çağrılarının neden olduğu nadir çok dakikalık Windows başlangıç donmaları düzeltildi;
- **Arşiv çıkarma**: arşivler çıkarılırken Unix dosya modları korundu;
- **Eklenti HTTP istekleri**: kalıcı 2xx dışı yanıtların işlenmesi yeniden sağlandı ve yeniden denemeler arasındaki bekleme iptal edilebilir hale getirildi;
- **Komut paleti**: kısayolu özelleştirildiğinde komut paleti araç çubuğu düğmesi düzeltildi;
- **Izgara aralık seçimi**: ızgara görünümünde aralık seçiminin kapsam dışındaki girdileri seçmesi düzeltildi;
- **Bağlam menüleri**: seçili öğe ve geçerli dizin bağlam menülerinin eylem tıklamalarından sonra açık kalması düzeltildi;
- **Kısayol kaydı**: pencere yeniden yüklemesinden sonra kısayol kayıt hataları düzeltildi;
- **Tema uygulama**: seçili temaların tüm pencerelerde uygulanmaması düzeltildi;
- **macOS taşıma işlemleri**: macOS'ta birimler arası taşıma işlemleri düzeltildi ve paket hedeflerine taşıma etkinleştirildi;
- **Varsayılan dosya yöneticisi**: etkinleştirme başarısız olduğunda veya önceki sistem değerleri geri yüklenirken Windows'un varsayılan dosya yöneticisi kayıt defteri değerlerinin daha güvenli biçimde geri yüklenmesi sağlandı;

![keyboard-scroll-floating-header](./public/changelog/assets/2.1.0/keyboard-scroll-floating-header.webp)

---
## [2.0.0-beta.3] - April 2026

**Özet:** Mağazalı eklenti sistemi, LAN dosya paylaşımı, hızlı erişim menüsü, zip arşivleri, WSL sürücüleri, etiket düzenleme, geliştirilmiş hızlı önizleme ve arama, görsel efekt iyileştirmeleri ve birçok kullanıcı deneyimi ve kararlılık iyileştirmesi.

### Yeni Özellikler

#### Eklenti Sistemi

Açık mağazalı tam eklenti sistemi.

- **Mağaza**: mağazadan eklentilere göz atın, yükleyin ve yönetin;
- **Yerel yükleme**: eklentileri yerel klasörden yükleyebilirsiniz;
- **Komut paleti**: uygulama ve eklenti komutlarını etkinleştirmenin yeni yolu;
- **Yetenekler**: eklentiler yerel ve genel kısayolları, bağlam menüsü öğelerini, ayarları, tam sayfaları ve komutları kaydedebilir;
- **Sürüm yönetimi**: eklentilerin farklı sürümlerini yükleyebilir ve otomatik güncellemeyi etkinleştirebilirsiniz;
- **Yerelleştirme**: eklentiler farklı diller için çeviriler sağlayabilir;
- **İkili dosya yönetimi**: eklentiler ikili dosyaları kullanabilir (ffmpeg, deno, node, yt-dlp, 7z ve diğer mevcut ikili dosyalar);
- **Korumalı çalıştırma**: eklentiler ayrıntılı izinlerle yalıtılmış ESM korumalı alanlarında çalışır;

#### Varsayılan dosya yöneticisi

Artık SFM'yi Windows'ta varsayılan dosya yöneticisi yapabilirsiniz (`Ayarlar > Deneysel`). Bu ayar etkinleştirildiğinde, çoğu sistem dosya eylemi SFM'ye yönlendirilir:

- Dosya Gezgini uygulama simgesi;
- `Ctrl+E` kısayolu;
- Dosyayı klasörde göster;
- İndirmeleri göster (tarayıcıda dosya indirdiğinizde);
- Terminal komutları: "start {yol}", "code {yol}" vb.
- Ve daha fazlası;

"Geri Dönüşüm Kutusu", "Denetim Masası" gibi yerel sistem görünümleri ve bu tür derinden entegre programlar yerel Dosya Gezgini'ne geri yönlendirilir.

#### LAN Paylaşımı

Dosya ve dizinleri doğrudan uygulamadan yerel ağınız üzerinden paylaşın ve yayınlayın.

LAN paylaşımına gezgin araç çubuğundaki düğmeden veya herhangi bir dosya ya da dizin üzerindeki bağlam menüsünden erişin. Bir paylaşım etkin olduğunda, QR kodu ve paylaşılabilir URL'ler görüntülenir. İki mod mevcuttur:

- **Yayınlama**: dosya ve dizinleri web tarayıcısı aracılığıyla ağınızdaki herhangi bir cihaza yayınlayın;
- **FTP**: diğer uygulamalardan doğrudan erişim için dosyaları FTP üzerinden paylaşın. Diğer cihazdan bilgisayara dosya indirebilir ve yükleyebilirsiniz;

#### Hızlı Erişim Menüsü

Kenar çubuğundaki "Gösterge Paneli" düğmesi artık hızlı erişim menüsü olarak çalışır. Üzerine geldiğinizde Sık Kullanılanlarınızı ve Etiketli öğelerinizi gösteren bir panel açılır.

Paneldeki tüm öğeler gerçek dizin girdileridir - öğeleri sürükleyip bırakabilir, sağ tıkla bağlam menülerini açabilir ve tüm standart dosya işlemlerini gerçekleştirebilirsiniz.

`Ayarlar > Arayüz görünümü > Fareyle üzerine gelindiğinde hızlı erişim panelini aç` bölümünden devre dışı bırakılabilir.

#### Zip Arşivleri

Dosya tarayıcısı eylemler menüsünden doğrudan zip arşivlerini sıkıştırın ve çıkarın:

- **Çıkar**: bir `.zip` dosyasını geçerli dizine veya adlandırılmış bir klasöre çıkarın;
- **Sıkıştır**: seçili dosya ve dizinleri bir `.zip` arşivine sıkıştırın;

#### WSL Sürücü Algılama

Windows'ta uygulama artık yüklü WSL dağıtımlarını otomatik olarak algılar ve sürücülerini gezginde göstererek WSL dosya sistemlerini yerel olarak gezmenize olanak tanır.

#### Etiket Düzenleme

Artık etiket adlarını ve renklerini düzenleyebilirsiniz. Etiketleri yeniden adlandırmak, renklerini değiştirmek veya silmek için herhangi bir dosya ya da dizinde etiket seçiciyi açın.

#### Uygulama İçi Güncellemeler

Artık uygulamadan çıkmadan güncelleme bildiriminden doğrudan güncellemeleri indirip yükleyebilirsiniz.

#### Yolu Kopyala

Dosya ve dizin bağlam menüsüne "Yolu kopyala" seçeneği eklendi.

#### Yinelenen Sekmeleri Kapat

Sekme çubuğundan yinelenen sekmeleri kapatma özelliği eklendi; aynı dizine işaret eden tüm sekmeler kaldırılır.

#### Ana Sayfa ve Gösterge Paneli Bağlam Menüleri

Ana sayfa ve gösterge panelindeki öğeler artık gezginde mevcut olan işlevsellikle eşleşen tam bağlam menülerine sahiptir.

### Yeni Ayarlar

- **Ana sayfa medya afişini göster**: ana sayfa medya afişini gösterin veya gizleyin (`Ayarlar > Arayüz görünümü > Ana sayfa medya afişi`);
- **Araç ipucu gecikmesi**: araç ipuçlarının görünmesinden önceki gecikmeyi yapılandırın (`Ayarlar > Arayüz görünümü > Araç ipuçları`);
- **Göreli zaman**: son zaman damgalarını göreli biçimde görüntüleyin, ör. "5 dk önce" (`Ayarlar > Genel > Tarih / saat`);
- **Tarih ve saat biçimi**: ay biçimini, bölgesel biçimi, 12 saatlik saati, saniyeleri ve milisaniyeleri yapılandırın (`Ayarlar > Genel > Tarih / saat`);
- **İletişim kutusu arka plan bulanıklığı**: iletişim kutusu arka planları için bulanıklık yoğunluğunu ayarlayın (`Ayarlar > Arayüz görünümü > Stil ayarları`);
- **Parlaklık ve kontrast filtreleri**: uygulama arayüzü için parlaklık ve kontrast stil filtrelerini ayarlayın (`Ayarlar > Arayüz görünümü > Stil ayarları`);
- **Kaplama medya parlaklığı**: görsel efektler kaplama medyasının parlaklığını ayarlayın (`Ayarlar > Arayüz görünümü > Görsel efektler`);
- **Görsel Efektler Karıştırma Modu**: arka plan medyasının uygulama arayüzüyle nasıl karıştığını seçmenize olanak tanıyan görsel efektler için karıştırma modunu ayarlayın (`Ayarlar > Arayüz görünümü > Görsel efektler`);
- **Arka plan videosunu duraklat**: uygulama boşta veya simge durumuna küçültülmüşken ana sayfa afişini ve arka plan videosunu duraklatın (`Ayarlar > Arayüz görünümü > Görsel efektler`);
- **Varsayılan dosya yöneticisi**: Sigma File Manager'ı Windows'ta varsayılan dosya gezgini olarak ayarlayın (`Ayarlar > Deneysel`);
- **Sistem girişinde başlat**: sisteme giriş yaptığınızda uygulamayı otomatik olarak başlatın (`Ayarlar > Genel > Başlangıç davranışı`);

### Yeni Kısayollar

- **Geçerli dizin yolunu kopyala** (`Ctrl+Shift+C`): geçerli dizin yolunu panoya kopyalayın;
- **Geçerli dizini yenile** (`F5`): gezgin dosya listesini yenileyin;
- **Yakınlaştır / uzaklaştır** (`Ctrl+=` / `Ctrl+-`): arayüz yakınlaştırmasını artırın veya azaltın;
- **Tam ekran** (`F11`): tam ekran modunu açın/kapatın;

### Yeni Diller

- **Hintçe**;
- **Urduca**;

### Kullanıcı Deneyimi İyileştirmeleri

#### Hızlı Önizleme İyileştirmeleri

- **Medya gezintisi**: hızlı önizlemeyi kapatmadan geçerli dizindeki dosyalar arasında gezinin;
- **Metin dosyası önizlemesi**: doğru kodlama algılama, satır içi düzenleme ve ayrıştırılmış markdown oluşturma ile geliştirilmiş metin dosyası önizlemesi;

#### Hızlı Arama İyileştirmeleri

- **Tüm özellikler**: herhangi bir dosya özelliğine göre arama yapın - ad, boyut, öğe sayısı, değiştirilme, oluşturulma, erişilme, yol veya MIME türü (ör. `modified: today`, `mime: image`);
- **Boyut aralıkları**: karşılaştırmalar ve aralıklar kullanarak boyuta göre filtreleyin (ör. `size: >=2mb`, `size: 1mb..10mb`);

#### Dosya İşlemleri

- **Çakışma çözümü güvenliği**: kazara veri kaybını önlemek için çakışma çözümü penceresindeki dosya güvenliği iyileştirildi;
- **Tek kullanımlık yapıştırma**: kopyalanan öğeler yalnızca bir kez yapıştırılabilir, kazara yinelenen yapıştırmaları önler;
- **Metin kopyalama**: dosya seçili değilken `Ctrl+C` ile arayüz metnini kopyalamaya izin verir;

#### Görsel Efektler

- **Arka plan yöneticisi**: merkezi arka plan özelleştirmesi için ayarlar sayfasına arka plan yöneticisi eklendi;
- **Arka plan efektlerini sıfırla**: arka plan efektleri ayarlarına sıfırlama düğmesi eklendi;

#### Diğer

- **Uygulama boyutu küçültme**: yüksek çözünürlüklü yerleşik arka planlar hariç tutularak ve medya afişi düzenleyicisinde sıkıştırılmış önizlemeler kullanılarak uygulama paketi boyutu küçültüldü;
- **Genel arama**: boş durumda "ayarları göster" düğmesi gösteriliyor ve varsayılan arama derinliği artırıldı;
- **Windows kısayolları**: `.lnk` dosyaları artık harici olarak başlatmak yerine hedeflerini gezginde açar;
- **Gösterge paneli**: etiketli bölüm düzeni iyileştirildi;
- **Adres çubuğu bağlam menüsü**: adres çubuğu öğelerine bağlam menüsü eklendi;
- **Gezgin bağlam menüsü**: gezginde boş alana tıklandığında bağlam menüsü gösterme;
- **Yeni sekmede aç**: orta fare düğmesi tıklamasıyla dizinleri yeni sekmede açın;
- **Sekme kaydırma**: yeni eklenen sekmeler otomatik olarak görünüme kaydırılır;
- **Menü odağı**: menüler artık dışarı tıklanarak kapatıldığında tetikleyici düğmelerine odak döndürmez;
- **Aramayı kapat**: `Escape` ile genel aramayı kapatın;
- **Daha hızlı başlatma**: ayarların Rust'ta önceden yüklenmesiyle uygulama başlatma hızı hafifçe iyileştirildi;
- **Kullanıcı dizinleri**: ana sayfada kullanıcı dizinleri ekleme ve kaldırma özelliği eklendi;
- **Liste sınırları**: performansı artırmak için sık kullanılan ve geçmiş listesi girdileri sınırları azaltıldı;

### Arayüz İyileştirmeleri

- **Araç çubuğu simgeleri**: uygulama genelinde araç çubuğu simge renkleri birleştirildi;
- **Kart animasyonları**: kartlara kademeli ve belirme efektleri eklendi;
- **Açık tema**: açık tema renkleri ve kontrastı iyileştirildi;
- **Başlatma kararlılığı**: titreşimi azaltmak için uygulama başlatma sırasında görsel kararlılık iyileştirildi;
- **Bildirimler**: daha iyi tutarlılık için bildirim tasarımı iyileştirildi;
- **Sekme otomatik kaydırma**: gezgin sayfası açılırken seçili sekme otomatik olarak görünüme kaydırılır;
- **Kök yol etiketleri**: sekmeler ve bilgi paneli genelinde kök yol etiketleri normalleştirildi;
- **Çeviriler**: uygulama genelinde çeviriler iyileştirildi;

### Hata Düzeltmeleri

- Birçok öğe kopyalama veya taşımanın arayüzü dondurması düzeltildi; durum merkezine dosya işlemi ilerlemesi eklendi;
- Birçok öğe silmenin arayüzü dondurması düzeltildi; durum merkezine silme ilerlemesi eklendi;
- Izgara düzeninde başka bir öğenin zaten menüsü açıkken geçerli dizin için bağlam menüsünün açılmaması düzeltildi;
- Bilgi panelinin geçerli dizin için tüm bilgileri göstermemesi düzeltildi;
- Uygulama kısayollarının yalnızca ana pencere yerine hızlı önizleme penceresinde kaydedilmesi düzeltildi;
- Web tarayıcılarından sürüklenen dosyaların işlenmemesi düzeltildi;
- Harici URL bırakmalarından gelen dosya adlarının geçerli segmentleri korumaması düzeltildi;
- Ana sayfa afişinin sürüklenebilir olması düzeltildi;
- Dosya yoluna göre anahtarlanmayan sistem simgesi önbelleğinin yanlış simgelere neden olması düzeltildi;
- Gezginde erişilemeyen Windows kök girdilerinin gösterilmesi düzeltildi;
- Bazı klavye düzenlerinde özel kısayolların tanınmaması düzeltildi;
- Linux'ta SSHFS bağlantıları düzeltildi;
- Kırıntı tıklamasında adres çubuğunun yinelenen geçmiş girdileri oluşturması düzeltildi;
- Genel arama sonuçlarının klavye gezintisine yanıt vermemesi düzeltildi;
- Genel arama sonuçlarının tıklamada açılmaması düzeltildi;
- Artımlı indekslemeden sonra genel arama durumunun eşitlenmemesi düzeltildi;
- Bazı uygulamalarda giden dosya sürükle-bırakın çalışmaması düzeltildi;
- Uygulama genelinde tutarsız kısayol rozeti tasarımı düzeltildi;
- Dar panellerde gezgin sütun görünürlüğü düzeltildi;

---

## [2.0.0-beta.2] - February 2026

**Özet:** Genel kısayollar, yeni ayarlar, yeni özellikler, geliştirilmiş dosya filtreleme, geliştirilmiş adres çubuğu, ana sayfa afişi iyileştirmeleri ve hata düzeltmeleri.

### Genel Kısayollar

Artık uygulama odakta olmasa bile klavye kısayollarını kullanarak uygulamayla etkileşim kurabilirsiniz.

Eklenen kısayollar:

- Uygulama penceresini göstermek ve odaklamak için `Win+Shift+E`;

### Yeni ayarlar

Son sekme kapatıldığında ne olacağını seçmek için ayar eklendi.

![Son sekmeyi kapat ayarı](./public/changelog/assets/beta-2/setting-close-last-tab.png)

### Yeni özellikler

Yeni erken önizleme özellikleri eklendi:

- Ağ konumları: bir ağ konumuna bağlanmanızı sağlar (SSHFS (SSH) / NFS / SMB / CIFS);
- [Linux] Sürücü bağlama: konumları ayırmanızı sağlar;

### Dosya Filtresi

Dosya filtresi iyileştirildi:
- Artık dizin değiştirdiğinizde otomatik olarak temizlenir ve kapanır;
- "Yazarken filtrele" özelliği ilk panelde değil, seçili panelde etkinleşir;

### Adres Çubuğu

- Geliştirilmiş tasarım ve otomatik tamamlama mantığı;
- Yol ayırıcıları artık herhangi bir üst dizine hızlı gezinti sağlayan açılır menülerdir;

![Ayırıcı menüleri](./public/changelog/assets/beta-2/divider-menus.png)

### Ana Sayfa Afişi / Arka Plan Efektleri

- Geliştirilmiş medya afişi düzenleyici tasarımı:
  - Medya afişi seçenekler menüsü artık görünümü engellemamek için aşağı doğru açılır;
  - Artık arka plan konumu düzenleyicisini kapatmak için dışarı tıklayabilirsiniz;
  - URL girişi özel arka planların üstüne taşındı;
- Özel resimler/videolar arka plan görsel efektlerinde kullanılabilir;
- Bazı varsayılan medya afişi resimleri kaldırıldı;
- Yeni afiş resmi "Exile by Aleksey Hoffman" eklendi;

### Kullanıcı Deneyimi İyileştirmeleri

- Uygulama başlatıldığında önceki pencere konumunu geri yükler;
- Geçerli sekme artık `Ctrl+W` kısayolu veya orta fare düğmesi tıklamasıyla kapatılabilir;
- Izgara düzeni görünümünde dosya simgesi boyutu artırıldı;

### Hata Düzeltmeleri

- Sekmeler arasında dosya taşımanın bazen yanlış konuma taşıması düzeltildi;
- Gezginin bazen dizinler için yanlış sistem simgeleri göstermesi düzeltildi;
- Birden fazla uygulama ve sistem tepsisi örneği oluşturulması düzeltildi;
- Kabuk eklentileri menüsünün düzenli olarak verileri yeniden alarak listeyi sürekli en üste kaydırmaya zorlaması düzeltildi;

## [2.0.0-beta.1] - February 2026

**Özet:** Klavye gezintisi, yeni kısayollar, terminalde açma, dizin otomatik yenileme, sürükle-bırak ve geliştirilmiş arama ve liste görünümleri dahil büyük kullanılabilirlik ve tasarım iyileştirmeleri.

### Klavye Gezintisi

Izgara ve liste düzenleri ve bölünmüş görünüm için tam destekle klavye kullanarak dosyalarda gezinin.

- Izgara görünümünde mekansal gezinti ve liste görünümünde sıralı gezinti için ok tuşları;
- Seçili dizin veya dosyayı açmak için Enter, geri gitmek için Backspace;
- Bölünmüş görünüm panelleri arasında odak geçişi için Ctrl+Sol / Ctrl+Sağ;
- Geçerli dizini yeni sekmede açmak için Ctrl+T;
- Tüm gezinti kısayolları Ayarlar > Kısayollar bölümünde özelleştirilebilir;

### Dizin Otomatik Yenileme

Gezgin görünümü, geçerli dizinde dosyalar oluşturulduğunda, silindiğinde, yeniden adlandırıldığında veya değiştirildiğinde otomatik olarak yenilenir.

- Harici uygulamalar tarafından değiştirildiğinde dosya boyutları otomatik olarak güncellenir;
- Aşırı yenilemeleri önlemek için geciktirmeli verimli dosya sistemi izleme;
- Akıllı fark tabanlı güncellemeler yalnızca etkilenen öğeleri değiştirir, kaydırma konumunu ve seçimi korur;

### Sürükle ve Bırak

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/beta-1/drag-and-drop.mp4"></video>

Artık dosya ve klasörleri kolayca kopyalamak/taşımak için sürükleyebilirsiniz. Paneller arasında, arama sonuçları listelerinden veya listelerine, harici uygulamalardan veya uygulamalara sürükleyin.

### Kopyalama Çakışmaları

Kolay kopyalama/taşıma çakışma çözümü için modal pencere eklendi.

### Otomatik Güncelleme

Otomatik güncelleme kontrolü eklendi (ayarlardan kontrol edilebilir).

### Ana Sayfa Afişi Medya Düzenleyici

Ana sayfa afişi özelleştirmesi için düzenleyici eklendi. Artık özel resim ve videolar yükleyebilirsiniz (hem yerel hem de uzak URL dosyaları desteklenir).

### Liste Görünümü İyileştirmeleri

- Geliştirilmiş tasarım ve küçük rahatsızlıklar düzeltildi;
- Sütun görünürlüğü özelleştirmesi eklendi: hangi sütunların görüntüleneceğini seçin;
- Sütun sıralaması eklendi: girdileri sıralamak için sütun başlıklarına tıklayın;
- Varsayılan gezgin düzeni liste görünümüne değiştirildi;

### Genel Arama İyileştirmeleri

- Sürükle-bırak desteğiyle güncellenmiş düzen ve tasarım;
- Sürücüler hâlâ indekslenirken arama artık kullanılabilir;

### Terminalde Aç

Dizinleri doğrudan bağlam menüsünden tercih ettiğiniz terminalde açın.

- Windows, macOS ve Linux'ta yüklü terminallerin otomatik algılanması;
- Windows Terminal, yürütülebilir simgeleriyle tüm yapılandırılmış kabuk profillerini gösterir;
- Linux varsayılan terminali otomatik algılanır ve ilk sırada gösterilir;
- Normal ve yönetici/yükseltilmiş modları içerir;
- Varsayılan kısayol: Alt+T;

### Yerelleştirme

- Slovence dili eklendi (teşekkürler: @anderlli0053);

### Arayüz / Kullanıcı Deneyimi İyileştirmeleri

- Yazı tipi seçici eklendi: yüklü sistem yazı tiplerinden arayüz yazı tipini seçin;
- Hızlı dosya veya dizin oluşturmak için "Yeni oluştur" menüsü eklendi;
- Boş dizinlere gidildiğinde boş durum görünümü gösteriliyor;
- Durum çubuğu, liste filtrelendiğinde gizli sayısıyla birlikte toplam öğeleri gösterir;
- Yeni oluşturulan, kopyalanan ve taşınan öğeler otomatik olarak görünüme kaydırılır;
- Pano araç çubuğu her panelde yerine panellerin altında bir kez gösterilir;
- Basitleştirilmiş yeniden adlandırma modal tasarımı;
- Küçük pencere boyutlarında açılır menüye daralan duyarlı araç çubuğu simgeleri;
- Ayarlardan boş "Gezinti" sekmesi kaldırıldı;
- Bir dizini yeniden adlandırmak artık yolunu tüm sekmeler, çalışma alanları, sık kullanılanlar, etiketler, geçmiş ve sık kullanılan öğeler genelinde günceller;
- Bir dosya veya dizini silmek artık onu tüm depolanan listelerden kaldırır ve etkilenen sekmeleri ana sayfaya yönlendirir;
- Sık kullanılanlar, etiketler, geçmiş ve sık kullanılan öğelerdeki mevcut olmayan yollar artık başlangıçta otomatik temizlenir;

### Hata Düzeltmeleri

- Genel arama indeksleme durumunun gerçek zamanlı güncellenmemesi düzeltildi;
- Bölünmüş görünüm panelinin dizini diğer panelden silindiğinde veya yeniden adlandırıldığında güncellenmemesi düzeltildi;
- Depolanan yolları artık mevcut olmayan sekmelerinin hatayla yüklenmesi düzeltildi;
- Sistem simgelerinin dosya başına benzersiz simgeler yerine aynı türdeki tüm dosyalar için aynı simgeyi göstermesi düzeltildi;
- Bölünmüş görünümün ikinci panelinde klavye kısayollarının çalışmaması düzeltildi;
- Sayfa gezintisinden sonra klavye kısayollarının çalışmayı durdurması düzeltildi;
- Kaldırma sırasında temizlenmeyen filtre tuş dinleyicileriyle bellek sızıntısı düzeltildi;
- Linux: "birlikte aç" menüsünde varsayılan uygulama alma desteği eklendi;

---

## [2.0.0-alpha.6] - January 2026

**Özet:** Yenilikler penceresi, Hızlı Önizleme, bağlam menüsü geliştirmeleri ve yeni ayarlar.

### Yenilikler Penceresi

Her sürüm için yeni özellikleri ve iyileştirmeleri gösteren bir değişiklik günlüğü penceresi.

- Güncellemelerden sonra otomatik olarak görünür (devre dışı bırakılabilir);
- Tüm sürümler arasında gezinin;
- Her özellik için ayrıntılı açıklamaları ve ekran görüntülerini görün;

### Hızlı Önizleme

Hafif bir önizleme penceresi kullanarak dosyaları tamamen açmadan önizleyin.

- Dosyaları hızlıca görüntülemek için `Space` tuşuna veya bağlam menüsündeki "Hızlı önizleme" seçeneğine basın;
- `Space` veya `Escape` ile anında kapatın.
- Resimleri, videoları, sesleri, metin dosyalarını, PDF'leri ve daha fazlasını destekler;

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/alpha-6/quick-view.mp4"></video>

### Dizin Boyutu Hesaplama

- Dizinlerin boyutu artık otomatik olarak hesaplanır;
- Herhangi bir dizini açar açmaz tüm alt dizinler ve dosyalar dahil tüm dizinlerin toplam boyutunu görebilirsiniz;

![Birlikte Aç](./public/changelog/assets/alpha-6/size.png)

### Yeni Bağlam Menüsü Seçenekleri

#### Birlikte Aç

- Bir dosyayı hangi uygulamayla açacağınızı seçin;
- Dosyaları bayraklarla uygulamalarda açmak için özel ön ayarlar yapın;
- Herhangi bir dosya türü için tüm uyumlu uygulamaları görüntüleyin;
- Belirli dosya türleri için varsayılan uygulamaları ayarlayın;

![Birlikte Aç](./public/changelog/assets/alpha-6/open-with.png)

#### Kabuk Eklentileri

- Windows kabuk bağlam menüsü öğelerine erişin;
- Üçüncü taraf kabuk eklentilerine erişin (7-Zip, Git vb.);

![Kabuk Eklentileri](./public/changelog/assets/alpha-6/shell-extensions.png)

### Yeni Ayarlar

#### Sürücü Algılama

- Çıkarılabilir sürücüler bağlandığında uygulamayı odaklar (devre dışı bırakılabilir);
- Çıkarılabilir sürücüler için Windows Gezgini otomatik açma davranışını kontrol edin;

#### Yazarken Filtrele

Geçerli dizindeki öğeleri anında filtrelemek için gezginde herhangi bir yerde yazmaya başlayın;

#### Ayar Arama Kısayolu

Ayar aramasına hızlı erişim için yeni klavye kısayolu;

#### Kullanıcı İstatistik Verileri

- İstatistik ayarları bölümü eklendi;
- Gösterge paneli sayfasında geçmişi, sık kullanılanları ve sık kullanılan öğeleri görüntüleyebilir, gezinebilir ve temizleyebilirsiniz;

### Arama İyileştirmeleri

Daha güvenilir ve güncel sonuçlar için hibrit indeksli + doğrudan arama sistemiyle geliştirilmiş genel arama.

- Aramalar artık dosyaların sürücülerinizde nerede olduğuna bakılmaksızın tutarlı olarak 1 saniyeden az sürer (~1 TB tamamen dolu sürücü);
- "Öncelikli yollarınızda" (sık açtığınız yollar) arama yaptığınızda, sonuçları anında alırsınız ve henüz oluşturulmuş ve indekslenmemiş dosyaları bile bulur.

#### Öncelikli yollar şunları içerir:
- Kullanıcı dizinleri: İndirilenler, Belgeler, Masaüstü, Resimler, Videolar, Müzik;
- Sık kullanılanlar;
- Son açılanlar;
- Sık kullanılanlar;
- Etiketliler;

---

## [2.0.0-alpha.5] - January 2026

**Özet:** Dosya işlemleri, genel arama ve kısayol özelleştirmesi.

### Genel Arama

Tüm sürücülerinizde dosyaları indeksleyen ve arayan güçlü tam disk araması. Yazım hatalarıyla bile dosyaları bulmak için bulanık eşleştirme, otomatik periyodik yeniden indeksleme, sık kullanılan dizinler için öncelikli indeksleme ve daha hızlı indeksleme için isteğe bağlı paralel tarama özellikleri sunar.

![Genel Arama](./public/changelog/assets/alpha-5/search.png)

### Dosya İşlemleri

İlerleme takibi dahil kopyalama, taşıma ve silme işlevselliğiyle tam dosya işlemi desteği. Ayrıca yerinde dosya ve klasör yeniden adlandırma içerir.

### Kısayol Düzenleyici

Uygulamadaki tüm klavye kısayollarını özelleştirin. Mevcut atamaları görüntüleyin, çakışmaları algılayın ve varsayılanlara sıfırlayın.

### Gezgin İyileştirmeleri

Dosya ve dizinler için minimalist glifler yerine yerel sistem simgelerini görüntüleme seçeneği eklendi. Ayarlar gezinti sekmeleri artık kaydırma sırasında sayfaya yapışır.

---

## [2.0.0-alpha.4] - January 2026

**Özet:** Ana sayfa, görsel efektler ve kullanıcı özelleştirme seçenekleri.

### Ana Sayfa

Animasyonlu medya afişi, sürücü listesi ve Belgeler, İndirilenler, Resimler ve daha fazlası gibi yaygın kullanıcı dizinlerine hızlı erişim içeren güzel bir ana sayfa.

### Görsel Efektler

Uygulama arka planına bulanıklık, opaklık ve gürültü efektleri ekleyen ayarlardaki özelleştirilebilir görsel efektler bölümü. Her sayfa için farklı ayarları destekler.

### Kullanıcı Dizinleri Düzenleyici

Kullanıcı dizin kartlarınızı özel başlıklar, simgeler ve yollarla özelleştirin. Hızlı erişim dizinlerinizin ana sayfada nasıl göründüğünü kişiselleştirin.

### Afiş Konumu Düzenleyici

Ana sayfa afişi arka planlarınızın konumunu ince ayarlayın. Mükemmel görünüm için yakınlaştırma, yatay ve dikey konumlandırmayı ayarlayın.

### Ayar İyileştirmeleri

- Ayar araması artık yalnızca mevcut dilde değil, herhangi bir dilde çalışır;
- Uygulama yeniden yüklemede her seferinde ilkini açmak yerine son ziyaret edilen ayarlar sekmesini geri yükler;

---

## [2.0.0-alpha.3] - December 2025

**Özet:** Sekmeler, çalışma alanları ve yeni bir tasarım sistemi ile gezgin görünümü.

### Gezgin Görünümü

Çalışma alanlarını destekleyen modern sekme sistemi, entegre kontrollerle yeni pencere araç çubuğu tasarımı ve verimli dosya yönetimi için çift panelli gezinti ile temel dosya tarama deneyimi.

### Video Küçük Resimleri

Gezginde video dosyaları için önizleme küçük resimleri eklendi.

### Tasarım Sistemi Geçişi

Daha ferah, modern bir tasarım ve geliştirilmiş kod kalitesi için uygulama Vuetify'dan Sigma-UI'ye taşındı.

---

## [2.0.0-alpha.1] - January 2024

**Özet:** Modern teknolojiler kullanılarak tamamen yeniden yazım.

### Tauri Geçişi

Sigma File Manager v2, Vue 3 Composition API, TypeScript ve Tauri v2 kullanılarak sıfırdan yeniden inşa edildi. Uygulama kurulum boyutu Windows'ta 153 MB'den yalnızca 4 MB'ye düşürüldü. Yüklü uygulama boyutu 419 MB'den 12 MB'ye düşürüldü.

### Yeniden Boyutlandırılabilir Paneller

Gezgin görünümünü ikiye bölmenize ve 2 dizinle yan yana çalışmanıza olanak tanıyan yeniden boyutlandırılabilir paneller özelliği eklendi.

### İlk Özellikler

Dizin listeleme ile temel dosya gezintisi, küçültme, büyütme ve kapatma kontrolleriyle pencere yönetimi ve ilk ayarlar sayfası yapısı.
