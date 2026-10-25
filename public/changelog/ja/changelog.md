# 変更履歴
## [3.6.1] - October 2026

**Summary:** Dragging a file out to another program now works whether this window is maximized or not. Until now the system-level drag only began once the pointer left this window, and a maximized window covers the whole screen, so the pointer was still "inside" the window while it sat over a chat program in front of it — the file was never handed to the system at all. The application now asks Windows what is actually under the pointer and switches to the system-level drag as soon as the pointer rests on another program. The same pass makes the window you are dragging towards come to the front while the drag runs, and hands the foreground back to it afterwards.

### What changed

**Fixed: a file could not be dragged into another program while this window was maximized.** The system-level drag used to start only when the pointer left the application window. With the window maximized that never happens: the window covers the screen, so a pointer sitting on a chat program in front of it is still within this window's coordinates, and nothing was ever dragged out — the drag simply ended when the button came up. The application now asks Windows what is under the pointer, and as soon as the pointer rests on a different program the file is handed over to the system's own drag-and-drop, which is what lets it land in a chat window. The answer has to hold for a moment before the drag begins, so that merely passing over a window on the way somewhere else does not start a drag by accident. Dragging inside this window is unaffected: a file dropped on a folder here is still moved the way it always was.

**Fixed: the program you are dragging towards now comes to the front, and keeps the focus afterwards.** Windows does not raise the window under the pointer during a system-level drag, and when the drag ends it activates the window the drag came from — which put this application on top of the program you had just dropped the file into. On the new route the application raises the target while the drag is in progress and hands the foreground back to it when the drag ends, so the drop can be seen and the program you dropped into stays in front.

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

**概要:** 他のアプリとのシステムクリップボード連携、ボックス選択、連動分割ビュー、リンク操作、パスワード付きZIP、Windows標準のプロパティ、拡張機能APIの拡充、ヘブライ語対応、ナビゲーターの操作性向上。

### 新機能

#### システムクリップボード連携

Sigma File Managerと他のアプリの間で、システムクリップボード経由でファイル、フォルダー、画像をコピー＆ペーストできます。

- **アプリ間のファイル転送**: SFMで項目をコピーまたは切り取り、エクスプローラーなどのアプリに貼り付けられます。他のアプリでコピーしたパスやファイルを `Ctrl+V` でナビゲーターに貼り付けることもできます;
- **画像の貼り付け**: ブラウザや他のアプリでコピーした画像をフォルダーに直接貼り付けられます;
- **競合ダイアログ**: 貼り付け先に同名の項目がある場合は `名前を変更` または `マージ` を選択でき、ファイルごとの競合は `置換`、`スキップ`、`両方を保持`、`すべてに適用` で解決できます;
- **クリップボードツールバー**: 他のアプリでコピーした画像やファイルパスを、必要に応じてツールバーにプレビュー表示できます;

ツールバーの表示は `設定 > 外観 > クリップボード` で制御できます。ツールバーを非表示にしても `Ctrl+V` での貼り付けは動作します。

![system-clipboard](./public/changelog/assets/2.2.0/system-clipboard.webp)

#### ボックス選択

ナビゲーターの空白部分をドラッグして、選択ボックスで複数の項目を選択できます。

- **修飾キー**: `Ctrl` または `Shift` を押しながらドラッグすると現在の選択に追加し、`Alt` を押しながらドラッグすると選択状態を反転できます;
- **ドラッグしやすい表示間隔**: リストの余白やグリッドの間隔を広げ、空白部分からドラッグを開始しやすくできます;

`設定 > 一般 > ファイルビュー > ボックス選択を有効にする` で有効化します。

![box-selection](./public/changelog/assets/2.2.0/box-selection.webp)

#### 連動分割ビュー

カラム表示のように操作できる、新しい `連動` 分割ビューモードが追加されました。1つ目のペインでフォルダーをクリックすると、その内容が2つ目のペインに表示されます。

既存の独立した `分割` モードはこれまでどおり利用できます。ナビゲーターのオプションメニューにある `分割表示モード` からモードを選択し、`Ctrl+S` で分割ビューの表示を切り替えられます。

情報パネルのアイコンも更新され、分割表示のアイコンと区別しやすくなりました。

![linked-split-view](./public/changelog/assets/2.2.0/linked-split-view.webp)

#### リンク操作

ナビゲーターからファイルシステムのリンクを作成・確認できます。

- **リンクを作成**: コンテキストメニュー（`リンクを作成`）からシンボリックリンク、ショートカット、ハードリンク、ジャンクションを作成;
- **リンク関連の列**: 種類、リンク、リンク先、リンク状態（`有効`、`破損`、`不明`、`非対応`）を、必要に応じてリストに表示できます;
- **開くときの動作**: ディレクトリのショートカットとフォルダーのシンボリックリンクはリンク先へ移動し、それ以外のリンク先は既定のアプリで開きます;

![link-handling](./public/changelog/assets/2.2.0/link-handling.webp)

#### Windows標準のプロパティウィンドウ

Windowsでは、コンテキストメニュー、アクションメニュー、`Alt+Enter`、または `Alt` + ダブルクリックで、選択した項目のWindows標準のプロパティダイアログを開けます。

![native-properties](./public/changelog/assets/2.2.0/native-properties.webp)

#### リストビューの列のリサイズと並べ替え

リストビューの列は、用途に合わせて幅や順序を変更できます。

- **リサイズ**: 列の端をドラッグして幅を変更;
- **並べ替えと表示**: リストヘッダーの `列` ポップオーバーで、列の順序と表示・非表示を管理;
- **幅のオプション**: `利用可能な幅を埋める` と `最小幅を設定`;

![list-column-resize](./public/changelog/assets/2.2.0/list-column-resize.webp)

#### ルートの `場所`

ルート階層の `場所` にはドライブと仮想ロケーションが一覧表示され、すばやく切り替えられます。

- **アドレスバー**: ドライブのルートから1つ上へ移動するか、アドレスバーまたはアドレスエディターから `場所` を開けます;
- **お気に入りとタグ**: `場所` は他のディレクトリと同様に、お気に入りへの追加やタグ付けができます;
- **分割表示**: ナビゲーターを離れずにペイン間でドライブを切り替えるのに特に便利;

![root-locations-address](./public/changelog/assets/2.2.0/root-locations-address.webp)

### 拡張機能

#### 拡張機能のAPIとビュー

拡張機能から利用できるホスト側の機能とUIコンポーネントが増えました。

- **ローカルバイナリ**: 自動セットアップ、または手動で選択したローカルバイナリを使って、拡張機能の依存関係を設定（`拡張機能 > 依存関係`）;
- **HTTPリクエスト**: 拡張機能はマニフェストで許可されたホストへHTTPリクエストを送信可能;
- **ビュー制御**: ビュー権限がある拡張機能は、ナビゲーターのレイアウトと並べ替え設定を適用可能;
- **クリップボードAPI**: 権限がある拡張機能はクリップボードを読み書き可能;
- **リスト詳細ビュー**: 検索可能なリストと詳細ペインを組み合わせた、新しい拡張機能向けUIパターン;

![extension-local-binaries](./public/changelog/assets/2.2.0/extension-local-binaries.webp)

![extension-dependency-config](./public/changelog/assets/2.2.0/extension-dependency-config.webp)

![extension-list-detail](./public/changelog/assets/2.2.0/extension-list-detail.webp)

![extension-http-api](./public/changelog/assets/2.2.0/extension-http-api.webp)

### 新しい設定

- **ボックス選択を有効にする**: 空白をドラッグして複数選択;
  `設定 > 一般 > ファイルビュー > ボックス選択を有効にする`
- **ファイルビューの間隔を広げる**: リストの余白とグリッドの間隔を広げ、ドラッグを開始しやすくする;
  `設定 > 一般 > ファイルビュー > ファイルビューの間隔を広げる`
- **Quick Viewウィンドウをメモリに保持**: Quick Viewを読み込んだままにして即座に開く（約200 MB使用）;
  `設定 > 一般 > パフォーマンス > Quick Viewウィンドウをメモリに保持`
- **印刷ウィンドウをメモリに保持**: 印刷ウィンドウを読み込んだままにして即座に開く（約200 MB使用）;
  `設定 > 一般 > パフォーマンス > 印刷ウィンドウをメモリに保持`
- **外部画像のクリップボードツールバー**: 他アプリでコピーした画像のクリップボードツールバーを表示;
  `設定 > 外観 > クリップボード`
- **外部パスのクリップボードツールバー**: 他アプリでコピーしたファイルパスのクリップボードツールバーを表示;
  `設定 > 外観 > クリップボード`
- **情報パネルの動的サイズ**: 情報パネルのサイズを内容に合わせて自動調整。手動でサイズを変更すると無効になります;
  `設定 > 外観 > 情報パネル > 情報パネルの動的サイズ`
- **情報パネルのプレビューにフルサイズ画像を表示**: 情報パネルでフル解像度の画像を表示;
  `設定 > 外観 > 情報パネル > 情報パネルのプレビュー領域にフルサイズ画像を表示`
- **動画プレビューをデフォルトでミュート**: 閲覧中に情報パネルの動画プレビューをミュート;
  `設定 > 外観 > 情報パネル > 動画プレビューをデフォルトでミュート`
- **動画プレビューを自動再生**: 選択時に情報パネルで動画を自動再生;
  `設定 > 外観 > 情報パネル > 動画プレビューを自動再生`

### 新しいショートカット

- **Windows標準のプロパティ**（`Alt+Enter`）: Windowsで選択した項目の標準プロパティウィンドウを開く;

### 新しい言語

- **ヘブライ語**（`עברית`）: 右から左へのレイアウト対応を含む完全な翻訳（`設定 > 一般 > 言語`）;

### UX改善

#### アーカイブ展開

ZIPの展開が、暗号化されたアーカイブとUTF-8以外でエンコードされたファイル名に対応しました。

- **パスワード付きZIP**: 展開に必要な場合にアーカイブのパスワードを入力;
- **ファイル名のエンコーディング**: `アーカイブ展開オプション` でエンコーディングを選択できます。自動検出が優先され、必要に応じて地域別にまとめられたエンコーディングを選べます;

![archive-extraction-options](./public/changelog/assets/2.2.0/archive-extraction-options.webp)

![archive-extraction-encoding](./public/changelog/assets/2.2.0/archive-extraction-encoding.webp)

#### グリッドの並べ替え

グリッドレイアウト専用の並べ替え項目が、ナビゲーターのオプションメニューに追加されました。

- **並べ替え**: 名前、項目数、サイズ、更新日、作成日、タグ、種類、リンク、リンク状態;
- **方向**: 昇順または降順。リストビューの並べ替えとは別に保存;

![grid-sorting](./public/changelog/assets/2.2.0/grid-sorting.webp)

#### シェル拡張機能

コンテキストメニューの `シェル拡張機能` から、他のアプリが登録したモダンなシェル拡張の操作を利用できます。

![shell-extensions](./public/changelog/assets/2.2.0/shell-extensions.webp)

#### セッションメモリ

同じセッション中にページやペインを離れて戻ると、スクロール位置とアクティブなタブが復元されます。

#### ナビゲーターのパフォーマンス

大きなフォルダーやメディアの閲覧がより高速になり、メモリ使用量も減りました。

- **初回読み込み**: ディレクトリを開いたときの初回読み込みを高速化;
- **アイコン読み込み**: カスタムおよびシステムアイコンの表示遅延を軽減;
- **リストスクロール**: 大きなディレクトリでのリストスクロールがより滑らかに;
- **メディアプレビュー**: 画像、GIF、動画プレビューの応答性が向上し、メモリ使用量が減少;
- **インデックス作成**: グローバル検索のインデックス作成がより安定;

#### ホームページとコンテキストメニュー

- **切断**: 対応時にコンテキストメニューからネットワークまたはリムーバブルマウントを切断;
- **すべての重複を閉じる**: タブメニューの `すべての重複を閉じる` は、現在のタブの重複だけでなく、ワークスペース内のすべての重複パスを閉じる;
- **右クリックで選択解除**: ナビゲーターの空白を右クリックすると、背景メニューを開く前に現在の選択を解除;
- **ホームの操作**: ホームページのコンテキストメニューが操作後に閉じるようになり、`新しいタブで開く` を選ぶとナビゲーターが開きます。新しいタブは自動的に表示範囲へスクロールします;
- **ウィンドウのドラッグ領域**: Linuxスタイルのタイトルバーでは、ドラッグ領域がツールバーボタンまで広がり、ウィンドウ移動が容易に;

![window-drag-region](./public/changelog/assets/2.2.0/window-drag-region.webp)

### UI改善

- **アクティブペイン表示**: 分割表示有効時、ステータスバーのアクティブペイン表示をより明確に;
- **リサイズ可能な情報パネル**: ドラッグで情報パネル幅とプレビュー/詳細の分割を変更;
- **コンパクトな情報パネル**: 情報パネルのプロパティを、より省スペースなレイアウトで表示;
- **コンテキストメニューの操作**: `カードを編集` を操作ボタンとして表示し、操作ボタン全体を小型化;
- **ナビゲーターのスタイル**: 画面幅に応じたレイアウト、分割ビューでのアクティブタブ表示、コマンドパレットの拡張機能ビューを改善;
- **RTLレイアウト**: 右から左の言語向けの整列を改善;

![resizable-info-panel](./public/changelog/assets/2.2.0/resizable-info-panel.webp)

![compact-info-panel](./public/changelog/assets/2.2.0/compact-info-panel.webp)

### バグ修正

- **入力による検索**: 非ラテン文字のキーボードレイアウトでクイック検索が起動しない問題を修正;
- **ディレクトリ読み込み**: ディレクトリの読み込み完了後にエントリが並び替わる問題を修正;
- **カスタムアイコン**: カスタムアイコンの表示に時間がかかる問題を修正;
- **グリッドカード**: 読み込み中にグリッドレイアウトのカードサイズが変わる問題を修正;
- **グリッドのスクロールバー**: グリッドのスクロールバーが固定ヘッダーの後ろに隠れる問題を修正;
- **クイック選択**: クイックファイル選択がファイルを開いてしまうことがある問題を修正;
- **ターミナルショートカット**: `Alt+T` が選択エントリではなく現在のディレクトリのターミナルを開く問題を修正;
- **ファイルを開く**: 開いたファイルが誤った作業ディレクトリから起動される問題を修正;
- **SMB共有**: SMB共有上のファイルを開けない問題を修正;
- **WSLパス**: WindowsでのWSLホストUNCパスの処理を修正し、`//wsl.localhost` を仮想的なディストリビューション一覧として扱うように変更;
- **デフォルトファイルマネージャー**: Windowsへの直接インストールでは引き続き設定可能で、Microsoft Store版では利用不可と表示されるように変更;
- **AppImage（Linux）**: `Could not create default EGL display: EGL_BAD_PARAMETER` を修正;
- **拡張機能のインストール（Linux）**: 配布物が複数ファイルで構成される拡張機能のインストール失敗を修正;
- **拡張機能の詳細**: 概要ページの整列スタイルを修正;
- **デバイス復帰**: デバイス復帰後にアプリが読み込み状態で止まる問題を修正;
- **更新通知**: 未リリース版に対する更新通知が表示される問題を修正;
- **RTL**: 右から左レイアウトの問題を修正;
- **翻訳**: 欠落および誤った翻訳文字列を修正;

---

## [2.1.0] - May 2026

**概要:** ナビゲーターのパフォーマンス向上、生成サムネイル、拡張機能によるテーマ、印刷、ファイルプレビュー、新しいショートカット、アドレスエディターの改善、ステータスセンターの再設計、タブとナビゲーションの操作性向上。

### 新機能

#### 印刷

コンテキストメニュー、アクションメニュー、または `Ctrl+O` で、ナビゲーターから選択したファイルを直接印刷できます。

- **対応形式**: 画像、PDF、テキスト形式;
- **すばやく終了**: `Escape` で印刷画面を閉じる;

![printing](./public/changelog/assets/2.1.0/printing.webp)

#### タブへのファイルドロップ

ファイルやフォルダーをタブへドラッグして、別タブのディレクトリへ移動またはコピーできます。

- **ドロップ先のタブ**: ナビゲーターでファイルをドラッグしている間、タブをドロップ先として選択可能;
- **ホバーで切り替え**: ドラッグ中にタブへカーソルを合わせると、ドロップする前にそのタブへ切り替え可能;
- **分割ビューのタブ**: ディレクトリのタブグループは、分割ビューのタブ構造を維持したまま、従来どおりドロップ先として利用可能;

![file-drop-to-tabs](./public/changelog/assets/2.1.0/file-drop-to-tabs.webp)

#### 情報パネルのファイルプレビュー

情報パネルは、画像と動画だけでなく、Quick Viewが対応するすべてのファイル種類をプレビューできるようになりました。

- **メディアプレビュー**: 画像は生成サムネイル、動画と音声はネイティブコントロール、PDFはインライン表示;
- **テキストプレビュー**: テキストファイルは、安全なサイズ上限の範囲内でデコードした内容をコンパクトに表示;
- **フォールバック**: 未対応のファイルとフォルダーはシンプルなアイコンプレースホルダーのまま;

![info-panel-file-preview](./public/changelog/assets/2.1.0/info-panel-file-preview.webp)

#### ナビゲーターのリスト列

リストビューで選べる列が増え、一覧上でメタデータをより簡単に管理できるようになりました。

- **作成日列**: 作成日の表示と並べ替え;
- **タグ列**: リストビューにタグを直接表示し、列から追加・削除・編集;

![navigator-list-columns](./public/changelog/assets/2.1.0/navigator-list-columns.webp)

### 拡張機能

#### 拡張機能からのアプリテーマ

拡張機能からアプリ全体のカラーテーマを追加できるようになりました。インストールしたテーマ拡張機能はテーマ選択画面に表示されます。

#### 拡張機能からのアイコンテーマ

拡張機能がフォルダーとファイル用のナビゲーターアイコンテーマを提供できるようになりました。

- **個別選択**: `設定 > 外観 > アイコンテーマ` でフォルダーとファイルのアイコンテーマを個別に選択;
- **内蔵と拡張機能テーマ**: 内蔵のデフォルト/システムアイコンテーマ、または有効な拡張機能テーマを使用;
- **テーマの割り当て条件**: 拡張機能のテーマでは、拡張子、ファイル名、フォルダー名、フォルダーの展開状態に応じてアイコンを定義可能;

### 新しい設定

- **アクティブなタブのテキストを太字にする**: アクティブなタブタイトルを太字にする（`設定 > タブ > タブの外観 > アクティブなタブのテキストを太字にする`）;

![bold-active-tab-text-setting](./public/changelog/assets/2.1.0/bold-active-tab-text-setting.webp)

### 新しいショートカット

- **分割ビューの切り替え**（`Ctrl+S`）: ナビゲーターの分割ビューを表示または非表示;
- **閉じたタブを復元**（`Ctrl+Shift+T`）: 直近に閉じたタブグループを復元;
- **ファイル / ディレクトリを作成**（`Ctrl+Shift+M` / `Ctrl+Shift+N`）: 現在のディレクトリに新しいファイルまたはディレクトリを作成;
- **選択したファイルを印刷**（`Ctrl+O`）: 選択したファイルを印刷;
- **コピーしたパスを開く**（`Ctrl+Shift+V`）: クリップボードの有効なパスを開く;
- **ページ切り替え**（`Alt+1` - `Alt+5`）: ホーム、ナビゲーター、ダッシュボード、設定、拡張機能を切り替え;
- **ディレクトリ履歴の移動**（`Alt+Left` / `Alt+Right`）: ナビゲーター履歴を戻るまたは進む;
- **親ディレクトリへ移動**（`Alt+Up`）: 親ディレクトリへ移動;
- **マウスの履歴ボタン**（`Mouse Button 4` / `Mouse Button 5`）: マウスのサイドボタンで履歴を戻る、または進む;

![create-file-directory-shortcuts](./public/changelog/assets/2.1.0/create-file-directory-shortcuts.webp)

![navigator-shortcuts](./public/changelog/assets/2.1.0/navigator-shortcuts.webp)

### UX改善

#### 大きなディレクトリのパフォーマンス

ナビゲーションやクイック検索の応答性が向上し、メディアファイルの多いフォルダーでもメモリ使用量が減りました。

- **生成サムネイル**: 各ファイルカードに元の画像や動画を読み込む代わりに、小さいサイズのサムネイルを生成;
- **段階的な画像表示**: 最終的なサムネイルの準備が整うまで、グリッドの画像カードにぼかした低解像度サムネイルを表示可能;
- **サムネイル生成の中止**: フォルダーや表示中の項目が変わったときに、不要になったサムネイルの生成を中止;
- **描画パフォーマンス**: 大きなディレクトリの項目をより効率的に描画し、Quick Viewでは生成サムネイルと仮想リストを使用;

![low-res-image-thumbnail-preview](./public/changelog/assets/2.1.0/low-res-image-thumbnail-preview.webp)

#### クイック検索

クイック検索に、パッシブとアクティブの2つのモードが追加されました:

- **パッシブモード**: 文字入力を始めると自動的に有効になります。検索欄へフォーカスを移さずに項目を絞り込むため、そのままナビゲーションを続けられます。
- **アクティブモード**: `Ctrl+F` で有効になります。検索欄にフォーカスしてナビゲーション操作を抑え、検索条件をより細かく編集できます。

その他の変更:

- **入力で絞り込み**: 英数字キーの入力で、アクティブペインのクイック検索（パッシブモード）が常に開始;
- **キーボード操作**: 最初の一致項目が自動選択;
- **ポップオーバー設計**: クイック検索ポップオーバーをよりコンパクトにし、ディレクトリ項目を覆いにくく;

![quick-search](./public/changelog/assets/2.1.0/quick-search.webp)

#### アドレスエディター

アドレスエディターから、さまざまなパスをより柔軟に開けるようになりました。

- **ファイルとディレクトリ**: アドレスエディターからディレクトリだけでなくファイルも開く;
- **よく使うパス**: 使用頻度の高いパスをすばやく開く専用モードに切り替え;
- **候補**: ディレクトリエントリ、完全一致、最近のパス、タグ付き項目、ユーザーフォルダー、システムドライブを閲覧;
- **キーボード操作**: エディターから戻る、進む、上へ移動、親ディレクトリで項目を表示;

![address-editor](./public/changelog/assets/2.1.0/address-editor.webp)

#### ステータスセンター

ステータスセンターは、操作グループがより明確なコンパクトなツールバーウィジェットになりました。

- **実行中の件数**: ツールバーボタンがカプセル状に広がり、実行中の操作件数を表示;
- **操作グループ**: 実行中と完了済みの操作を分け、完了済みの操作は折りたたみ可能なセクションに表示;
- **すべてキャンセル**: セクションヘッダーから実行中の操作をまとめてキャンセル;
- **処理カード**: 操作カードに `コピー | 成功` や `アーカイブ | エラー` のような、わかりやすい種類と状態のラベルを表示;
- **クリップボードの復旧**: 貼り付け処理がキューに追加された時点でクリップボードをクリアし、処理に失敗した場合は復元;

![status-center](./public/changelog/assets/2.1.0/status-center.webp)

#### ナビゲーションとタブ

ナビゲーターの移動とタブの動作がより予測しやすくなりました。

- **サイドバーのドライブ**: ナビゲーションサイドバーのドライブをクリックすると現在のタブで開く;
- **現在のディレクトリ**: アドレスバーで現在のディレクトリをより強調し、最後のアドレス部分を右クリックするとコンテキストメニューを表示;
- **閉じたタブ**: 復元したタブは以前の位置に戻り、名前変更後のパスを保持し、削除されたパスはホームへリダイレクト;
- **レスポンシブレイアウト**: 画面幅に応じてツールバーのナビゲーションボタンを早めに折りたたみ、非常に狭いペインでは分割ビューのアドレスバーを2行目へ移動。コンパクトなタブの高さも統一;

![nav-sidebar-drive-current-tab](./public/changelog/assets/2.1.0/nav-sidebar-drive-current-tab.webp)

![current-directory-address-bar](./public/changelog/assets/2.1.0/current-directory-address-bar.webp)

#### ショートカット管理

ショートカット編集での競合とカスタマイズの扱いがより明確になりました。

- **複数の割り当て**: 1つの操作に複数のショートカットを割り当て;
- **割り当て解除**: ショートカットの割り当てを解除;
- **競合の置換**: 競合プロンプトから直接競合ショートカットを置換;
- **ショートカット一覧メニュー**: ショートカット一覧のコンテキストメニューから管理;

![shortcut-editor](./public/changelog/assets/2.1.0/shortcut-editor.webp)

#### ドラッグ＆ドロップ

ドラッグ中に `Alt+Tab` で別のアプリへ切り替えても、ファイルをSFMの外へドロップできるようになりました。カーソルを先にウィンドウの外へ移動する必要はありません。

### UI改善

- **選択枠**: ナビゲーターの選択枠の透明度と位置、ペインヘッダーのスタイル、キーボードフォーカス時の動作を改善;
- **タブバー**: タブバーのスタイルとアクティブタブの可読性を改善;
- **テーマ選択**: テーマ選択のデザインを改善;
- **クイックアクセス**: クイックアクセスパネルのスタイルを洗練;
- **スプラッシュ画面**: 起動時のアプリスプラッシュ画面を追加;
- **ポップオーバーの視認性**: 半透明のポップオーバー要素を見やすく改善;
- **ツールチップ**: より多くのツールバーボタンにツールチップを追加;
- **翻訳**: 日本語とベトナム語の文字列を改善し、ロケール構造を整理;

![selection-ring](./public/changelog/assets/2.1.0/selection-ring.webp)

![tab-bar-styles](./public/changelog/assets/2.1.0/tab-bar-styles.webp)

![narrow-window-layout](./public/changelog/assets/2.1.0/narrow-window-layout.webp)

### バグ修正

- **ネットワークドライブ**: 割り当て済みのネットワークドライブから外部へドラッグ＆ドロップできない問題を修正;
- **キーボードスクロール**: 最初の行が固定ヘッダーの後ろに隠れる問題を修正;
- **起動時のフリーズ**: 起動と更新確認中の遅い同期システムコールが原因の、Windowsでのまれな数分間の起動フリーズを修正;
- **アーカイブ展開**: アーカイブ展開時にUnixファイルモードを保持;
- **拡張機能のHTTP通信**: 恒久的な非2xxレスポンスの処理を復元し、再試行までの待機をキャンセル可能に変更;
- **コマンドパレット**: ショートカットを変更するとコマンドパレットのツールバーボタンが正しく動作しない問題を修正;
- **グリッドの範囲選択**: グリッドビューの範囲選択が範囲外のエントリを選択する問題を修正;
- **コンテキストメニュー**: 選択項目と現在のディレクトリのコンテキストメニューが、操作を選んだ後も開いたままになる問題を修正;
- **ショートカット登録**: ウィンドウ再読み込み後のショートカット登録エラーを修正;
- **テーマ適用**: 選択したテーマがすべてのウィンドウに適用されない問題を修正;
- **macOSでの移動**: macOSでボリュームをまたいで移動する処理を修正し、アプリバンドルも移動先として選択可能に変更;
- **デフォルトファイルマネージャー**: 有効化に失敗した場合や以前のシステム値へ戻す場合の、Windowsレジストリの復元処理をより安全に改善;

![keyboard-scroll-floating-header](./public/changelog/assets/2.1.0/keyboard-scroll-floating-header.webp)

---

## [2.0.0-beta.3] - April 2026

**概要:** マーケットプレイス付き拡張機能システム、LANファイル共有、クイックアクセスメニュー、zipアーカイブ、WSLドライブ、タグ編集、クイックビューと検索の強化、ビジュアルエフェクトの改善、および多数のUXと安定性の改善。

### 新機能

#### 拡張機能システム

オープンマーケットプレイス付きの完全な拡張機能システム。

- **マーケットプレイス**: マーケットプレイスから拡張機能を閲覧、インストール、管理;
- **ローカルインストール**: ローカルフォルダから拡張機能をインストール可能;
- **コマンドパレット**: アプリと拡張機能のコマンドを実行する新しい方法;
- **機能**: 拡張機能はローカルおよびグローバルショートカット、コンテキストメニュー項目、設定、ページ全体、コマンドを登録可能;
- **バージョン管理**: 拡張機能の異なるバージョンをインストールし、自動更新を有効化可能;
- **ローカライゼーション**: 拡張機能は異なる言語の翻訳を提供可能;
- **バイナリ管理**: 拡張機能はバイナリ（ffmpeg、deno、node、yt-dlp、7z、その他の既存バイナリ）を使用可能;
- **サンドボックス実行**: 拡張機能は詳細な権限を持つ分離されたESMサンドボックスで実行;

#### デフォルトファイルマネージャー

SFMをWindowsのデフォルトファイルマネージャーに設定できるようになりました（`設定 > 実験的`）。この設定を有効にすると、ほとんどのシステムファイル操作がSFMに転送されます：

- エクスプローラーアプリアイコン;
- `Ctrl+E` ショートカット;
- フォルダ内のファイルを表示;
- ダウンロードを表示（ブラウザでファイルをダウンロードした時）;
- ターミナルコマンド: "start {パス}", "code {パス}" など;
- その他;

「ごみ箱」、「コントロールパネル」などのネイティブシステムビューや、このような深く統合されたプログラムはネイティブのエクスプローラーに委任されます。

#### LAN共有

アプリから直接ローカルネットワーク経由でファイルやディレクトリを共有・ストリーミングできます。

LAN共有にはナビゲーターのツールバーボタンまたは任意のファイルやディレクトリのコンテキストメニューからアクセスできます。共有が有効な場合、QRコードと共有可能なURLが表示されます。2つのモードが利用可能です：

- **ストリーミング**: Webブラウザを介してネットワーク上の任意のデバイスにファイルやディレクトリをストリーミング;
- **FTP**: 他のアプリからの直接アクセスのためにFTP経由でファイルを共有。他のデバイスからコンピューターへのファイルのダウンロードとアップロードの両方が可能;

#### クイックアクセスメニュー

サイドバーの「ダッシュボード」ボタンがクイックアクセスメニューとして機能するようになりました。ホバーするとお気に入りとタグ付きアイテムを表示するパネルが開きます。

パネル内のすべてのアイテムは実際のディレクトリエントリです。アイテムをドラッグ＆ドロップで出し入れしたり、右クリックでコンテキストメニューを開いたり、すべての標準ファイル操作を実行できます。

`設定 > UI外観 > ホバー時にクイックアクセスパネルを開く`で無効化できます。

#### Zipアーカイブ

ファイルブラウザのアクションメニューから直接zipアーカイブを圧縮・展開：

- **展開**: `.zip`ファイルを現在のディレクトリまたは名前付きフォルダに展開;
- **圧縮**: 選択したファイルとディレクトリを`.zip`アーカイブに圧縮;

#### WSLドライブ検出

Windowsでは、アプリがインストール済みのWSLディストリビューションを自動検出し、ナビゲーターにドライブを表示して、WSLファイルシステムをネイティブに閲覧できるようになりました。

#### タグ編集

タグ名と色を編集できるようになりました。任意のファイルやディレクトリでタグセレクターを開いて、タグの名前変更、色の変更、削除が可能です。

#### アプリ内アップデート

アプリを離れることなく、更新通知から直接アップデートをダウンロードしてインストールできるようになりました。

#### パスをコピー

ファイルとディレクトリのコンテキストメニューに「パスをコピー」オプションを追加しました。

#### 重複タブを閉じる

タブバーから重複タブを閉じる機能を追加。同じディレクトリを指すすべてのタブを削除します。

#### ホーム＆ダッシュボードのコンテキストメニュー

ホームページとダッシュボードのアイテムに、ナビゲーターで利用可能な機能と一致するフルコンテキストメニューが追加されました。

### 新しい設定

- **ホームメディアバナーを表示**: ホームページのメディアバナーの表示・非表示を切り替え（`設定 > UI外観 > ホームページメディアバナー`）;
- **ツールチップの遅延**: ツールチップが表示されるまでの遅延を設定（`設定 > UI外観 > ツールチップ`）;
- **相対時間**: 最近のタイムスタンプを相対形式で表示、例：「5分前」（`設定 > 一般 > 日付 / 時刻`）;
- **日付と時刻の形式**: 月の形式、地域形式、12時間制、秒、ミリ秒を設定（`設定 > 一般 > 日付 / 時刻`）;
- **ダイアログ背景ぼかし**: ダイアログ背景のぼかし強度を設定（`設定 > UI外観 > スタイル設定`）;
- **明るさとコントラストフィルター**: アプリUIの明るさとコントラストのスタイルフィルターを調整（`設定 > UI外観 > スタイル設定`）;
- **オーバーレイメディアの明るさ**: ビジュアルエフェクトのオーバーレイメディアの明るさを調整（`設定 > UI外観 > ビジュアルエフェクト`）;
- **ビジュアルエフェクトの合成モード**: ビジュアルエフェクトの合成モードを調整し、背景メディアがアプリUIとどのようにブレンドするかを選択可能（`設定 > UI外観 > ビジュアルエフェクト`）;
- **バックグラウンド動画を一時停止**: アプリがアイドル状態または最小化されている時にホームバナーと背景動画を一時停止（`設定 > UI外観 > ビジュアルエフェクト`）;
- **デフォルトファイルマネージャー**: Sigma File ManagerをWindowsのデフォルトファイルエクスプローラーに設定（`設定 > 実験的`）;
- **システムログイン時に起動**: システムにログインした時にアプリを自動起動（`設定 > 一般 > 起動動作`）;

### 新しいショートカット

- **現在のディレクトリパスをコピー**（`Ctrl+Shift+C`）: 現在のディレクトリパスをクリップボードにコピー;
- **現在のディレクトリを更新**（`F5`）: ナビゲーターのファイルリストを更新;
- **ズームイン / ズームアウト**（`Ctrl+=` / `Ctrl+-`）: UIのズームを拡大または縮小;
- **フルスクリーン**（`F11`）: フルスクリーンモードの切り替え;

### 新しい言語

- **ヒンディー語**;
- **ウルドゥー語**;

### UX改善

#### クイックビューの強化

- **メディアナビゲーション**: クイックビューを閉じずに現在のディレクトリ内のファイル間を移動;
- **テキストファイルプレビュー**: 適切なエンコーディング検出、インライン編集、パースされたmarkdownレンダリングによるテキストファイルプレビューの改善;

#### クイック検索の強化

- **すべてのプロパティ**: 任意のファイルプロパティで検索 - 名前、サイズ、アイテム数、更新日、作成日、アクセス日、パス、MIMEタイプ（例：`modified: today`、`mime: image`）;
- **サイズ範囲**: 比較や範囲を使用してサイズでフィルタリング（例：`size: >=2mb`、`size: 1mb..10mb`）;

#### ファイル操作

- **競合解決の安全性**: 偶発的なデータ損失を防ぐため、競合解決モーダル内のファイル安全性を改善;
- **ワンタイムペースト**: コピーされたアイテムは一度だけ貼り付け可能で、誤った重複貼り付けを防止;
- **テキストコピー**: ファイルが選択されていない時に`Ctrl+C`でUIテキストのコピーを許可;

#### ビジュアルエフェクト

- **背景マネージャー**: 一元的な背景カスタマイズのために設定ページに背景マネージャーを追加;
- **背景エフェクトリセット**: 背景エフェクト設定にリセットボタンを追加;

#### その他

- **アプリサイズの削減**: 高解像度の内蔵背景を除外し、メディアバナーエディターで圧縮プレビューを使用してアプリバンドルサイズを削減;
- **グローバル検索**: 空の状態で「設定を表示」ボタンを表示し、デフォルトの検索深度を増加;
- **Windowsショートカット**: `.lnk`ファイルが外部起動の代わりにナビゲーターでターゲットを開くように変更;
- **ダッシュボード**: タグセクションのレイアウトを改善;
- **アドレスバーのコンテキストメニュー**: アドレスバーアイテムにコンテキストメニューを追加;
- **ナビゲーターのコンテキストメニュー**: ナビゲーターの空の領域をクリックした時にコンテキストメニューを表示;
- **新しいタブで開く**: マウスの中ボタンクリックでディレクトリを新しいタブで開く;
- **タブスクロール**: 新しく追加されたタブを自動的にビューにスクロール;
- **メニューフォーカス**: 外側クリックで閉じた時にメニューがトリガーボタンにフォーカスを戻さないように変更;
- **検索を閉じる**: `Escape`でグローバル検索を閉じる;
- **高速起動**: Rustで設定をプリロードすることでアプリの起動速度をわずかに改善;
- **ユーザーディレクトリ**: ホームページでユーザーディレクトリの追加と削除機能を追加;
- **リスト制限**: パフォーマンス向上のため、頻繁使用リストと履歴リストのエントリ制限を削減;

### UI改善

- **ツールバーアイコン**: アプリ全体でツールバーアイコンの色を統一;
- **カードアニメーション**: カードにスタッガーとフェードインエフェクトを追加;
- **ライトテーマ**: ライトテーマの色とコントラストを改善;
- **起動時の安定性**: ちらつきを減らすためアプリ起動時の視覚的安定性を改善;
- **通知**: より良い一貫性のために通知デザインを改善;
- **タブの自動スクロール**: ナビゲーターページを開く時に選択されたタブを自動的にビューにスクロール;
- **ルートパスラベル**: タブと情報パネル全体でルートパスラベルを正規化;
- **翻訳**: アプリ全体で翻訳を改善;

### バグ修正

- 多数のアイテムのコピーまたは移動時にUIがフリーズする問題を修正; ステータスセンターにファイル操作の進捗を追加;
- 多数のアイテムの削除時にUIがフリーズする問題を修正; ステータスセンターに削除の進捗を追加;
- グリッドレイアウトで別のアイテムが既にメニューを開いている時に現在のディレクトリのコンテキストメニューが開かない問題を修正;
- 情報パネルが現在のディレクトリのすべての情報を表示しない問題を修正;
- アプリのショートカットがメインウィンドウではなくクイックビューウィンドウに登録される問題を修正;
- Webブラウザからドラッグされたファイルが処理されない問題を修正;
- 外部URLドロップからのファイル名が有効なセグメントを保持しない問題を修正;
- ホームバナーがドラッグ可能だった問題を修正;
- システムアイコンキャッシュがファイルパスでキー付けされていないため不正なアイコンが表示される問題を修正;
- アクセスできないWindowsルートエントリがナビゲーターに表示される問題を修正;
- 一部のキーボードレイアウトでカスタムショートカットが認識されない問題を修正;
- LinuxでのSSHFS接続を修正;
- パンくずクリック時にアドレスバーが重複する履歴エントリを作成する問題を修正;
- グローバル検索結果がキーボードナビゲーションに応答しない問題を修正;
- グローバル検索結果がクリックで開かない問題を修正;
- インクリメンタルインデックス作成後にグローバル検索のステータスが同期しない問題を修正;
- 一部のアプリケーションでアウトバウンドのファイルドラッグ＆ドロップが機能しない問題を修正;
- アプリ全体でショートカットバッジのデザインが不一致だった問題を修正;
- 狭いペインでのナビゲーター列の表示を修正;

---

## [2.0.0-beta.2] - February 2026

**概要:** グローバルショートカット、新しい設定、新機能、改善されたファイルフィルタリング、改善されたアドレスバー、ホームバナーの改善、バグ修正。

### グローバルショートカット

アプリがフォーカスされていない時でもキーボードショートカットを使用してアプリと対話できるようになりました。

追加されたショートカット：

- `Win+Shift+E` でアプリウィンドウを表示してフォーカス;

### 新しい設定

最後のタブを閉じた時の動作を選択する設定を追加しました。

![最後のタブを閉じる設定](./public/changelog/assets/beta-2/setting-close-last-tab.png)

### 新機能

新しい早期プレビュー機能を追加しました：

- ネットワークロケーション: ネットワークロケーション（SSHFS (SSH) / NFS / SMB / CIFS）への接続を可能にします;
- [Linux] ドライブマウント: ロケーションのアンマウントを可能にします;

### ファイルフィルター

ファイルフィルターが改善されました：
- ディレクトリを変更すると自動的にクリアされて閉じるようになりました;
- 「入力時フィルター」機能が最初のペインではなく選択されたペインで有効化されるようになりました;

### アドレスバー

- デザインとオートコンプリートロジックを改善;
- パス区切り文字が任意の親ディレクトリへのクイックナビゲーションを提供するドロップダウンメニューになりました;

![区切りメニュー](./public/changelog/assets/beta-2/divider-menus.png)

### ホームバナー / 背景エフェクト

- メディアバナーエディターのデザインを改善：
  - メディアバナーオプションメニューがビューを遮らないように下方向に開くように変更;
  - 外側をクリックして背景位置エディターを閉じることが可能に;
  - URL入力をカスタム背景の上に移動;
- カスタム画像/動画を背景ビジュアルエフェクトで使用可能;
- 一部のデフォルトメディアバナー画像を削除;
- 新しいバナー画像「Exile by Aleksey Hoffman」を追加;

### UX改善

- アプリが起動時に前のウィンドウ位置を復元;
- 現在のタブを`Ctrl+W`ショートカットまたはマウスの中ボタンクリックで閉じることが可能に;
- グリッドレイアウトビューでのファイルアイコンサイズを拡大;

### バグ修正

- タブ間でのファイル移動時に誤った場所に移動されることがある問題を修正;
- ナビゲーターがディレクトリに対して誤ったシステムアイコンを表示することがある問題を修正;
- 複数のアプリとトレイインスタンスが作成される問題を修正;
- シェル拡張メニューが定期的にデータを再取得し、リストが常にトップにスクロールされる問題を修正;

## [2.0.0-beta.1] - February 2026

**概要:** キーボードナビゲーション、新しいショートカット、ターミナルで開く、ディレクトリの自動更新、ドラッグ＆ドロップ、検索とリストビューの強化を含む、主要なユーザビリティとデザインの改善。

### キーボードナビゲーション

グリッドとリストレイアウトおよび分割ビューの完全サポートで、キーボードを使用してファイルをナビゲートできます。

- グリッドビューでの空間ナビゲーションとリストビューでの順次ナビゲーション用の矢印キー;
- 選択したディレクトリまたはファイルを開くにはEnter、戻るにはBackspace;
- 分割ビューペイン間のフォーカス切り替えにはCtrl+左 / Ctrl+右;
- 現在のディレクトリを新しいタブで開くにはCtrl+T;
- すべてのナビゲーションショートカットは設定 > ショートカットでカスタマイズ可能;

### ディレクトリの自動更新

現在のディレクトリでファイルが作成、削除、名前変更、または変更された時にナビゲータービューが自動的に更新されます。

- 外部アプリケーションによって変更された場合、ファイルサイズが自動的に更新;
- 過度な更新を避けるためのデバウンス付き効率的なファイルシステム監視;
- スマートな差分ベースの更新により影響を受けたアイテムのみを変更し、スクロール位置と選択を保持;

### ドラッグ＆ドロップ

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/beta-1/drag-and-drop.mp4"></video>

ファイルやフォルダをドラッグして簡単にコピー/移動できるようになりました。ペイン間、検索結果リストへの出し入れ、外部アプリへの出し入れでドラッグできます。

### コピー時の競合

コピー/移動の競合を簡単に解決するためのモーダルウィンドウを追加しました。

### 自動アップデート

アップデートの自動チェック機能を追加しました（設定から制御可能）。

### ホームバナーメディアエディター

ホームページバナーのカスタマイズ用エディターを追加しました。カスタム画像や動画をアップロードできるようになりました（ローカルファイルとリモートURLファイルの両方をサポート）。

### リストビューの強化

- デザインの改善と小さな不便の修正;
- 列の表示カスタマイズを追加: 表示する列を選択;
- 列ソートを追加: 列ヘッダーをクリックしてエントリをソート;
- デフォルトのナビゲーターレイアウトをリストビューに変更;

### グローバル検索の改善

- ドラッグ＆ドロップサポート付きのレイアウトとデザインを更新;
- ドライブのインデックス作成中でも検索が利用可能に;

### ターミナルで開く

コンテキストメニューから直接お好みのターミナルでディレクトリを開きます。

- Windows、macOS、Linuxでインストール済みターミナルの自動検出;
- Windows Terminalは実行可能ファイルのアイコン付きで設定済みのすべてのシェルプロファイルを表示;
- Linuxのデフォルトターミナルが自動検出され最初に表示;
- 通常モードと管理者/昇格モードを含む;
- デフォルトショートカット: Alt+T;

### ローカライゼーション

- スロベニア語を追加（感謝: @anderlli0053）;

### UI / UX改善

- フォントセレクターを追加: インストール済みシステムフォントからUIフォントを選択;
- ファイルやディレクトリをすばやく作成するための「新規作成」メニューを追加;
- 空のディレクトリに移動した時に空の状態ビューを表示;
- ステータスバーがリストがフィルタリングされている時に非表示数とともに合計アイテム数を表示;
- 新しく作成、コピー、移動されたアイテムが自動的にビューにスクロール;
- クリップボードツールバーが各ペインではなくペインの下に一度表示;
- 名前変更モーダルのデザインを簡素化;
- 小さいウィンドウサイズでドロップダウンに折りたたまれるレスポンシブツールバーアイコン;
- 設定から空の「ナビゲーション」タブを削除;
- ディレクトリの名前変更がすべてのタブ、ワークスペース、お気に入り、タグ、履歴、頻繁使用アイテム全体でパスを更新するように;
- ファイルまたはディレクトリの削除がすべての保存済みリストから削除し、影響を受けたタブをホームにナビゲートするように;
- お気に入り、タグ、履歴、頻繁使用アイテムの存在しないパスが起動時に自動クリーンアップされるように;

### バグ修正

- グローバル検索のインデックス作成ステータスがリアルタイムで更新されない問題を修正;
- 分割ビューペインのディレクトリが他のペインから削除または名前変更された時に更新されない問題を修正;
- 保存されたパスが存在しなくなった時にタブがエラーで読み込まれる問題を修正;
- システムアイコンがファイルごとの固有アイコンではなく同じ種類のすべてのファイルに同じアイコンを表示する問題を修正;
- 分割ビューの2番目のペインでキーボードショートカットが機能しない問題を修正;
- ページナビゲーション後にキーボードショートカットが機能しなくなる問題を修正;
- アンマウント時にクリーンアップされないフィルターのキーダウンリスナーによるメモリリークを修正;
- Linux: 「プログラムから開く」メニューでのデフォルトアプリ取得サポートを追加;

---

## [2.0.0-alpha.6] - January 2026

**概要:** 新着情報ウィンドウ、クイックビュー、コンテキストメニューの強化、新しい設定。

### 新着情報ウィンドウ

各リリースの新機能と改善点を表示する変更履歴ウィンドウ。

- アップデート後に自動的に表示（無効化可能）;
- すべてのリリースを閲覧;
- 各機能の詳細な説明とスクリーンショットを確認;

### クイックビュー

軽量プレビューウィンドウを使用して、ファイルを完全に開かずにプレビューします。

- `Space`キーまたはコンテキストメニューの「クイックビュー」オプションでファイルをすばやく表示;
- `Space`または`Escape`で即座に閉じます。
- 画像、動画、音声、テキストファイル、PDF等をサポート;

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/alpha-6/quick-view.mp4"></video>

### ディレクトリサイズの計算

- ディレクトリのサイズが自動計算されるようになりました;
- 任意のディレクトリを開くとすぐに、すべてのサブディレクトリとファイルを含むすべてのディレクトリの合計サイズを確認できます;

![プログラムから開く](./public/changelog/assets/alpha-6/size.png)

### 新しいコンテキストメニューオプション

#### プログラムから開く

- ファイルを開くアプリケーションを選択;
- フラグ付きでアプリケーションでファイルを開くカスタムプリセットを設定;
- 任意のファイルタイプに対応するすべてのアプリケーションを表示;
- 特定のファイルタイプのデフォルトアプリケーションを設定;

![プログラムから開く](./public/changelog/assets/alpha-6/open-with.png)

#### シェル拡張

- Windowsシェルのコンテキストメニュー項目にアクセス;
- サードパーティのシェル拡張（7-Zip、Gitなど）にアクセス;

![シェル拡張](./public/changelog/assets/alpha-6/shell-extensions.png)

### 新しい設定

#### ドライブ検出

- リムーバブルドライブが接続された時にアプリをフォーカス（無効化可能）;
- リムーバブルドライブに対するWindowsエクスプローラーの自動オープン動作を制御;

#### 入力時フィルター

ナビゲーターのどこでも入力を開始すると、現在のディレクトリのアイテムを即座にフィルタリング;

#### 設定検索ショートカット

設定検索へのクイックアクセス用の新しいキーボードショートカット;

#### ユーザー統計データ

- 統計設定セクションを追加;
- ダッシュボードページで履歴、お気に入り、頻繁使用アイテムの表示、ナビゲート、クリアが可能;

### 検索の改善

より信頼性が高く最新の結果のための、ハイブリッドインデックス＋直接検索システムによる改善されたグローバル検索。

- ファイルがドライブのどこにあっても、検索が一貫して1秒未満で完了するようになりました（~1 TBフル使用ドライブ）;
- 「優先パス」（頻繁に開くパス）を検索すると、結果が即座に得られ、作成されたばかりでまだインデックスされていないファイルも見つかります。

#### 優先パスには以下が含まれます：
- ユーザーディレクトリ: ダウンロード、ドキュメント、デスクトップ、ピクチャ、ビデオ、ミュージック;
- お気に入り;
- 最近開いたもの;
- 頻繁に使用するもの;
- タグ付き;

---

## [2.0.0-alpha.5] - January 2026

**概要:** ファイル操作、グローバル検索、ショートカットのカスタマイズ。

### グローバル検索

すべてのドライブにわたってファイルをインデックス作成して検索する強力なフルディスク検索。タイプミスがあってもファイルを見つけるファジーマッチング、自動定期再インデックス、頻繁に使用するディレクトリの優先インデックス、より高速なインデックス作成のためのオプションの並列スキャン機能を搭載。

![グローバル検索](./public/changelog/assets/alpha-5/search.png)

### ファイル操作

進捗追跡を含むコピー、移動、削除機能による完全なファイル操作サポート。インプレースでのファイルとフォルダの名前変更も含みます。

### ショートカットエディター

アプリ内のすべてのキーボードショートカットをカスタマイズ。現在のバインディングの表示、競合の検出、デフォルトへのリセットが可能です。

### ナビゲーターの強化

ミニマルなグリフの代わりにファイルやディレクトリのネイティブシステムアイコンを表示するオプションを追加。設定のナビゲーションタブがスクロール時にページに固定されるようになりました。

---

## [2.0.0-alpha.4] - January 2026

**概要:** ホームページ、ビジュアルエフェクト、ユーザーカスタマイズオプション。

### ホームページ

アニメーションメディアバナー、ドライブリスト、ドキュメント、ダウンロード、ピクチャなどの一般的なユーザーディレクトリへのクイックアクセスを備えた美しいホームページ。

### ビジュアルエフェクト

アプリの背景にぼかし、不透明度、ノイズエフェクトを追加する設定内のカスタマイズ可能なビジュアルエフェクトセクション。各ページに異なる設定をサポート。

### ユーザーディレクトリエディター

カスタムタイトル、アイコン、パスでユーザーディレクトリカードをカスタマイズ。ホームページでのクイックアクセスディレクトリの表示をパーソナライズ。

### バナー位置エディター

ホームページバナーの背景位置を微調整。完璧な外観のためにズーム、水平・垂直位置を調整。

### 設定の改善

- 設定検索が現在の言語だけでなく、どの言語でも機能するように;
- アプリがリロード時に毎回最初のタブを開く代わりに、最後に訪問した設定タブを復元するように;

---

## [2.0.0-alpha.3] - December 2025

**概要:** タブ、ワークスペース、新しいデザインシステムを備えたナビゲータービュー。

### ナビゲータービュー

ワークスペースをサポートするモダンなタブシステム、統合コントロール付きの新しいウィンドウツールバーデザイン、効率的なファイル管理のためのデュアルペインナビゲーションを備えたコアファイルブラウジング体験。

### 動画サムネイル

ナビゲーターに動画ファイルのプレビューサムネイルを追加。

### デザインシステムの移行

より広々としたモダンなデザインとコード品質の向上のため、アプリをVuetifyからSigma-UIに移行。

---

## [2.0.0-alpha.1] - January 2024

**概要:** モダンな技術を使用した完全な書き直し。

### Tauriへの移行

Sigma File Manager v2はVue 3 Composition API、TypeScript、Tauri v2を使用してゼロから再構築されました。Windowsでのアプリインストールサイズが153 MBからわずか4 MBに削減。インストール済みアプリサイズが419 MBから12 MBに削減。

### リサイズ可能なペイン

ナビゲータービューを半分に分割して2つのディレクトリを並べて作業できるリサイズ可能なペイン機能を追加。

### 初期機能

ディレクトリリスティングによる基本的なファイルナビゲーション、最小化・最大化・閉じるコントロール付きのウィンドウ管理、および初期設定ページ構造。
