# Dnevnik sprememb
## [3.6.2] - October 2026

**Summary:** Copying files to and from a remote server (SFTP, FTP or FTPS) now tells you what is actually happening. Uploading used to fail with nothing but a number in the way — no reason, and no way to tell whether the server had refused the file or the application had quietly skipped it. Pasting files into the remote pane reported *Destination path does not exist*, which was never a statement about the server at all: the remote path was being handed to the local copy engine, which asked the local file system and of course found nothing there. The remote transfer channel now has its own path, shows a progress bar while it works, and asks before it replaces anything.

### What changed

**Fixed: a failed upload now says why it failed.** When the remote already held a file with the same name, the old policy was to skip it silently — the file was left alone and the reason never reached the interface. The result dialog used to show counts and nothing else. It now reports what happened to every file: which ones were transferred, which ones were skipped, which ones failed, and why. A file you chose to skip is no longer listed twice.

**Fixed: pasting into the remote pane no longer reports a path that does not exist.** Pasting into a remote panel sent a `sfm://remote/...` path to the local copy engine, which asked the local file system whether that path exists and was told no, every time. Pasting into a remote panel now goes through the remote transfer channel, and the same rules apply there as for a transfer started from the toolbar.

**Added: a remote transfer now asks before it overwrites anything.** If the remote already has a file with the same name, a dialog lists them and lets you decide one by one — overwrite, or skip. Tick *use the same choice for all files with the same name* and one decision settles the whole batch, which is what you want when you are moving a folder of files across. The files you chose to overwrite are the only ones the application is allowed to replace; nothing else on the server is touched.

**Added: remote transfers show a progress bar.** Uploading or downloading a large tree used to be a wait with nothing to look at. The progress dialog says what is being transferred, how many items are done out of how many, and the totals are worked out before the transfer starts — so the bar moves forward instead of jumping to the end and back to the start again. Downloading a remote file is available from the right-click menu of the remote entry.

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

**Povzetek:** Integracija s sistemskim odložiščem, izbiranje z okvirjem, povezani razdeljeni pogled, upravljanje povezav, ZIP-arhivi z geslom, sistemsko okno Lastnosti v sistemu Windows, nove zmožnosti API-jev za razširitve, podpora za hebrejščino in izboljšave navigatorja.

### Nove funkcije

#### Integracija sistemskega odložišča

Kopirajte in prilepite datoteke, mape in slike med Sigma File Manager in drugimi aplikacijami prek sistemskega odložišča.

- **Prenos datotek med aplikacijami**: kopirajte ali izrežite elemente v SFM in jih prilepite v aplikacije, kot je Raziskovalec, ali pa s `Ctrl+V` v navigator prilepite poti in datoteke, kopirane v drugih aplikacijah;
- **Lepljenje slik**: prilepite slike, kopirane iz brskalnikov in drugih aplikacij, neposredno v mapo;
- **Razreševanje sporov**: če prilepljeni elementi že obstajajo, izberite `Preimenuj` ali `Združi`; za posamezne datoteke so na voljo možnosti Zamenjaj, Preskoči, Obdrži obe ali Uporabi za vse;
- **Orodna vrstica odložišča**: po želji v orodni vrstici prikažite slike in poti datotek, kopirane v drugih aplikacijah;

Vidnost orodne vrstice lahko nastavite v `Nastavitve > Videz uporabniškega vmesnika > Odložišče`. Lepljenje s `Ctrl+V` deluje tudi, ko je orodna vrstica skrita.

![system-clipboard](./public/changelog/assets/2.2.0/system-clipboard.webp)

#### Izbiranje z okvirjem

Po praznem prostoru v navigatorju povlecite izbirni okvir in z njim izberite več elementov.

- **Modifikacijske tipke**: držite `Ctrl` ali `Shift`, da elemente dodate trenutnemu izboru; držite `Alt`, da izbor obrnete;
- **Lažji začetek izbiranja**: po želji povečajte odmike v seznamu in mreži, da boste okvir lažje začeli vleči na praznem prostoru;

Omogočite v `Nastavitve > Splošno > Pogled datotek > Omogoči izbiranje z okvirjem`.

![box-selection](./public/changelog/assets/2.2.0/box-selection.webp)

#### Povezani razdeljeni pogled

Novi način razdeljenega pogleda `Povezan` poenostavi delo v stolpcih: ko v prvem podoknu izberete mapo, se njena vsebina prikaže v drugem.

Obstoječi neodvisni način `Razdeljen` ostaja nespremenjen. Način izberite v meniju možnosti navigatorja pod `Način razdeljenega pogleda`, razdeljeni pogled pa vklopite ali izklopite s `Ctrl+S`.

Posodobljena je tudi ikona podokna z informacijami, da jo je lažje razlikovati od ikone razdeljenega pogleda.

![linked-split-view](./public/changelog/assets/2.2.0/linked-split-view.webp)

#### Upravljanje povezav

Ustvarjajte datotečne povezave in preverjajte njihove podatke neposredno v navigatorju.

- **Ustvarjanje povezav**: v kontekstnem meniju izberite `Ustvari povezavo`, da ustvarite simbolno ali trdo povezavo, bližnjico oziroma spoj;
- **Stolpci povezav**: seznam lahko prikaže stolpce Vrsta, Povezave, Cilj povezave in Stanje povezave (`Veljavna`, `Prekinjena`, `Neznana`, `Nepodprta`);
- **Odpiranje povezav**: bližnjice imenikov in simbolne povezave do map odprejo ciljni imenik v navigatorju, drugi cilji pa se odprejo s privzeto aplikacijo;

![link-handling](./public/changelog/assets/2.2.0/link-handling.webp)

#### Sistemsko okno Lastnosti

V sistemu Windows lahko sistemsko okno Lastnosti za izbrane elemente odprete iz kontekstnega menija, menija dejanj, z `Alt+Enter` ali dvojnim klikom ob pritisnjeni tipki `Alt`.

![native-properties](./public/changelog/assets/2.2.0/native-properties.webp)

#### Spreminjanje velikosti in prerazporejanje stolpcev v seznamskem pogledu

Širino in vrstni red stolpcev v seznamskem pogledu lahko prilagodite svojemu načinu dela.

- **Spreminjanje širine**: povlecite rob stolpca;
- **Vrstni red in vidnost**: nastavite ju v pojavnem meniju `Stolpci` v glavi seznama;
- **Možnosti širine**: `Zapolni razpoložljivo širino` in `Nastavi najmanjše širine`;

![list-column-resize](./public/changelog/assets/2.2.0/list-column-resize.webp)

#### Naslov korenskih lokacij

Novi korenski naslov `Lokacije` združuje pogone in navidezne lokacije, da lahko med njimi hitreje preklapljate.

- **Naslovna vrstica**: iz korena pogona se pomaknite eno raven višje ali odprite `Lokacije` iz naslovne vrstice oziroma urejevalnika naslova;
- **Priljubljene in oznake**: naslov `Lokacije` lahko tako kot druge imenike dodate med priljubljene in mu dodelite oznake;
- **Razdeljen pogled**: še posebej uporabno za preklapljanje pogonov med podokni, ne da bi zapustili navigator;

![root-locations-address](./public/changelog/assets/2.2.0/root-locations-address.webp)

### Razširitve

#### API-ji in pogledi razširitev

Razširitve imajo na voljo več zmožnosti aplikacije in gradnikov uporabniškega vmesnika.

- **Lokalne izvršljive datoteke**: nastavite samodejno namestitev odvisnosti razširitve ali ročno izberite lokalne izvršljive datoteke (`Razširitve > Odvisnosti`);
- **Zahteve HTTP**: razširitve lahko pošiljajo zahteve HTTP gostiteljem, dovoljenim v njihovem manifestu;
- **Nadzor pogleda**: razširitve z ustreznim dovoljenjem lahko spreminjajo postavitev in razvrščanje navigatorja;
- **API odložišča**: razširitve z ustreznim dovoljenjem lahko berejo in spreminjajo vsebino odložišča;
- **Pogled s seznamom in podrobnostmi**: nov vzorec uporabniškega vmesnika razširitve z iskanjem po seznamu in podoknom s podrobnostmi;

![extension-local-binaries](./public/changelog/assets/2.2.0/extension-local-binaries.webp)

![extension-dependency-config](./public/changelog/assets/2.2.0/extension-dependency-config.webp)

![extension-list-detail](./public/changelog/assets/2.2.0/extension-list-detail.webp)

![extension-http-api](./public/changelog/assets/2.2.0/extension-http-api.webp)

### Nove nastavitve

- **Omogoči izbiranje z okvirjem**: po praznem prostoru povlecite okvir in izberite več elementov;
  `Nastavitve > Splošno > Pogled datotek > Omogoči izbiranje z okvirjem`
- **Povečaj razmike v pogledu datotek**: povečajte odmike v seznamu in mreži, da boste lažje začeli izbirati;
  `Nastavitve > Splošno > Pogled datotek > Povečaj razmike v pogledu datotek`
- **Ohrani okno hitrega predogleda v pomnilniku**: okno ostane naloženo in se odpre takoj (porabi približno 200 MB);
  `Nastavitve > Splošno > Zmogljivost > Ohrani okno hitrega predogleda v pomnilniku`
- **Ohrani okno za tiskanje v pomnilniku**: okno ostane naloženo in se odpre takoj (porabi približno 200 MB);
  `Nastavitve > Splošno > Zmogljivost > Ohrani okno za tiskanje v pomnilniku`
- **Orodna vrstica odložišča za zunanje slike**: prikažite orodno vrstico odložišča za slike, kopirane v drugih aplikacijah;
  `Nastavitve > Videz uporabniškega vmesnika > Odložišče`
- **Orodna vrstica odložišča za zunanje poti**: prikažite orodno vrstico odložišča za poti datotek, kopirane v drugih aplikacijah;
  `Nastavitve > Videz uporabniškega vmesnika > Odložišče`
- **Dinamična velikost podokna z informacijami**: velikost naj se prilagaja samodejno; ročno spreminjanje velikosti to možnost izklopi;
  `Nastavitve > Videz uporabniškega vmesnika > Podokno z informacijami > Dinamična velikost podokna z informacijami`
- **Slika polne velikosti v predogledu**: v podoknu z informacijami prikažite slike v polni ločljivosti;
  `Nastavitve > Videz uporabniškega vmesnika > Podokno z informacijami > Prikaži sliko polne velikosti v predogledu`
- **Privzeto utišaj predogled videoposnetka**: med brskanjem predvajajte videoposnetke v podoknu z informacijami brez zvoka;
  `Nastavitve > Videz uporabniškega vmesnika > Podokno z informacijami > Privzeto utišaj predogled videoposnetka`
- **Samodejno predvajaj predoglede videoposnetkov**: izbrani videoposnetek se samodejno začne predvajati v podoknu z informacijami;
  `Nastavitve > Videz uporabniškega vmesnika > Podokno z informacijami > Samodejno predvajaj predogled videoposnetka`

### Nove bližnjice

- **Sistemsko okno Lastnosti** (`Alt+Enter`): odprite sistemsko okno Lastnosti za izbrane elemente v sistemu Windows;

### Novi jeziki

- **Hebrejščina** (`עברית`): popoln prevod s podporo za vmesnik od desne proti levi (`Nastavitve > Splošno > Jezik`);

### Izboljšave uporabniške izkušnje

#### Razpakiranje arhivov

Zdaj lahko razpakirate šifrirane ZIP-arhive in arhive z imeni datotek v kodiranjih, ki niso UTF-8.

- **ZIP z geslom**: ko ga razpakiranje zahteva, vnesite geslo arhiva;
- **Kodiranje imen datotek**: kodiranje izberite v `Možnosti razpakiranja arhiva`; najprej se uporabi samodejno zaznavanje, regionalna kodiranja pa so združena med nadomestnimi možnostmi;

![archive-extraction-options](./public/changelog/assets/2.2.0/archive-extraction-options.webp)

![archive-extraction-encoding](./public/changelog/assets/2.2.0/archive-extraction-encoding.webp)

#### Razvrščanje mreže

Mrežni pogled ima zdaj v meniju možnosti navigatorja lastne nastavitve razvrščanja.

- **Razvrsti po**: Ime, Elementi, Velikost, Spremenjeno, Ustvarjeno, Oznake, Vrsta, Povezave in Stanje povezave;
- **Smer**: naraščajoči ali padajoči vrstni red se shrani ločeno od razvrščanja v seznamskem pogledu;

![grid-sorting](./public/changelog/assets/2.2.0/grid-sorting.webp)

#### Razširitve lupine

V razdelku `Razširitve lupine` kontekstnega menija so zdaj na voljo sodobna dejanja lupine, ki so jih registrirale druge aplikacije.

![shell-extensions](./public/changelog/assets/2.2.0/shell-extensions.webp)

#### Obnovitev stanja seje

Ko se med isto sejo vrnete na stran ali v podokno, se obnovijo položaji pomikanja in aktivni zavihki.

#### Zmogljivost navigatorja

Brskanje po velikih mapah in predstavnostnih datotekah je hitrejše in porabi manj pomnilnika.

- **Prvo nalaganje**: imeniki se ob prvem odpiranju naložijo hitreje;
- **Nalaganje ikon**: prilagojene in sistemske ikone se prikažejo z manjšo zakasnitvijo;
- **Pomikanje po seznamu**: seznami v velikih imenikih se pomikajo bolj gladko;
- **Predogledi predstavnostnih datotek**: slike, GIF-i in videoposnetki se odzivajo hitreje in porabijo manj pomnilnika;
- **Indeksiranje**: indeksiranje globalnega iskanja je zanesljivejše;

#### Domača stran in kontekstni meniji

- **Prekini povezavo**: kadar je podprto, lahko omrežne ali izmenljive nosilce odklopite iz kontekstnega menija;
- **Zapri vse dvojnike**: ukaz `Zapri vse dvojnike` v meniju zavihka zdaj zapre vse zavihke s podvojenimi potmi v delovnem prostoru, ne le kopij trenutnega zavihka;
- **Desni klik za počistitev**: desni klik na prazno ozadje navigatorja pred odpiranjem menija ozadja počisti trenutno izbiro;
- **Dejanja domače strani**: kontekstni meni se po izbiri dejanja zapre, ukaz `Odpri v novem zavihku` odpre navigator, novi zavihki pa se samodejno pomaknejo v vidno območje;
- **Območje vlečenja okna**: pri naslovnih vrsticah v slogu Linuxa območje vlečenja poteka tudi čez gumbe orodne vrstice, zato je okno lažje premikati;

![window-drag-region](./public/changelog/assets/2.2.0/window-drag-region.webp)

### Izboljšave uporabniškega vmesnika

- **Kazalnik aktivnega podokna**: jasnejša oznaka aktivnega podokna v vrstici stanja, ko je razdeljen pogled vklopljen;
- **Podokno z informacijami s spremenljivo velikostjo**: z vlečenjem spremenite širino podokna in razmerje med predogledom ter podrobnostmi;
- **Kompaktno podokno z informacijami**: gostejša razporeditev lastnosti;
- **Dejanja kontekstnega menija**: ukaz `Uredi kartico` je prikazan kot poseben gumb, vsi gumbi dejanj pa so manjši;
- **Slog navigatorja**: izboljšave vključujejo prilagodljivo postavitev, videz aktivnih zavihkov v razdeljenem pogledu in pogled razširitev v ukazni paleti;
- **Vmesnik od desne proti levi**: izboljšana poravnava za jezike, ki se pišejo od desne proti levi;

![resizable-info-panel](./public/changelog/assets/2.2.0/resizable-info-panel.webp)

![compact-info-panel](./public/changelog/assets/2.2.0/compact-info-panel.webp)

### Popravki napak

- **Iskanje med tipkanjem**: odpravljena je napaka, zaradi katere se hitro iskanje pri nelatiničnih razporeditvah tipkovnice ni vklopilo;
- **Nalaganje imenika**: elementi po končanem nalaganju imenika ne spremenijo več vrstnega reda;
- **Prilagojene ikone**: zmanjšana je bila opazna zakasnitev pri nalaganju prilagojenih ikon;
- **Kartice mreže**: kartice med nalaganjem ne spreminjajo več velikosti;
- **Drsnik mreže**: drsnik se ne skriva več za pritrjenimi glavami;
- **Hitra izbira**: odpravljena je napaka, zaradi katere je hitra izbira včasih odprla datoteko;
- **Bližnjica terminala**: `Alt+T` zdaj odpre terminal za izbrani element namesto za trenutni imenik;
- **Odpiranje datotek**: datoteke se ne zaženejo več iz napačnega delovnega imenika;
- **Skupne rabe SMB**: datoteke v skupnih rabah SMB je znova mogoče odpreti;
- **Poti WSL**: popravljeno je obravnavanje gostiteljskih poti UNC za WSL v sistemu Windows; `//wsl.localhost` se prepozna kot navidezni seznam distribucij;
- **Privzeti upravitelj datotek**: nastavitev ostaja na voljo pri neposrednih namestitvah za Windows; v različici iz trgovine Microsoft Store je zdaj prikazana kot nedostopna;
- **AppImage (Linux)**: popravljeno `Could not create default EGL display: EGL_BAD_PARAMETER`;
- **Namestitev razširitev (Linux)**: odpravljene so napake pri nameščanju paketov razširitev z več datotekami;
- **Podrobnosti razširitve**: popravljena je poravnava strani s pregledom;
- **Prebuditev naprave**: aplikacija po prebuditvi naprave ne obtiči več v stanju nalaganja;
- **Obvestila o posodobitvah**: obvestila se ne prikazujejo več za neizdane različice;
- **Vmesnik od desne proti levi**: odpravljene so težave s postavitvijo;
- **Prevodi**: popravljeni manjkajoči in napačni prevodni nizi;

---

## [2.1.0] - May 2026

**Povzetek:** Hitrejši navigator, ustvarjene sličice, teme iz razširitev, tiskanje, predogledi datotek, nove bližnjice, izboljšan urejevalnik naslova, prenovljeno središče stanja ter boljša uporaba zavihkov in navigacije.

### Nove funkcije

#### Tiskanje

Natisnite izbrane datoteke neposredno iz navigatorja prek kontekstnega menija, menija dejanj ali s `Ctrl+O`.

- **Podprti formati**: slike, PDF, besedilni formati;
- **Hiter izhod**: zaprite pogled tiskanja s `Escape`;

![printing](./public/changelog/assets/2.1.0/printing.webp)

#### Vlečenje datotek na zavihke

Povlecite datoteke ali imenike na zavihke, da jih premaknete ali kopirate v imenik drugega zavihka.

- **Zavihki kot cilji**: med vlečenjem datotek v navigatorju jih lahko spustite na zavihke;
- **Preklop ob zadržanju kazalca**: med vlečenjem zadržite kazalec nad zavihkom, da ga pred spustom odprete;
- **Razdeljeni zavihki**: skupine zavihkov imenikov sprejemajo datoteke kot prej, pri tem pa ohranijo strukturo zavihkov razdeljenega pogleda;

![file-drop-to-tabs](./public/changelog/assets/2.1.0/file-drop-to-tabs.webp)

#### Predogled datotek v podoknu z informacijami

Podokno z informacijami lahko zdaj prikaže vse vrste datotek, ki jih podpira hitri predogled, ne le slik in videoposnetkov.

- **Predogledi predstavnostnih datotek**: slike uporabljajo ustvarjene sličice, videoposnetki in zvok imajo običajne kontrolnike, PDF-ji pa se prikažejo neposredno v podoknu;
- **Predogledi besedila**: besedilne datoteke prikažejo kratek, dekodiran predogled z varno omejitvijo velikosti;
- **Nepodprte datoteke**: pri nepodprtih datotekah in mapah se še naprej prikažejo preproste nadomestne ikone;

![info-panel-file-preview](./public/changelog/assets/2.1.0/info-panel-file-preview.webp)

#### Stolpci seznama navigatorja

Seznamski pogled ima več izbirnih stolpcev in priročnejše upravljanje metapodatkov neposredno v seznamu.

- **Stolpec Ustvarjeno**: prikažite in razvrščajte po datumu ustvarjanja;
- **Stolpec Oznake**: prikažite oznake neposredno v seznamskem pogledu ter dodajajte, odstranjujte ali urejajte oznake iz stolpca;

![navigator-list-columns](./public/changelog/assets/2.1.0/navigator-list-columns.webp)

### Razširitve

#### Teme aplikacije iz razširitev

Razširitve lahko zdaj dodajajo celovite barvne teme aplikacije. Nameščene teme razširitev se prikažejo v izbirniku tem.

#### Teme ikon iz razširitev

Razširitve lahko zdaj dodajajo teme ikon za mape in datoteke v navigatorju.

- **Ločene izbire**: teme ikon map in datotek izberite neodvisno v `Nastavitve > Videz uporabniškega vmesnika > Tema ikon`;
- **Vgrajene teme in teme razširitev**: uporabite vgrajeno privzeto ali sistemsko temo ikon oziroma katero koli temo omogočene razširitve;
- **Pravila ikon**: teme lahko določijo ikone glede na končnico ali ime datoteke, ime mape in stanje razširjene mape;

### Nove nastavitve

- **Krepko besedilo aktivnega zavihka**: naslov aktivnega zavihka izpišite krepko (`Nastavitve > Zavihki > Videz zavihkov > Krepko besedilo aktivnega zavihka`);

![bold-active-tab-text-setting](./public/changelog/assets/2.1.0/bold-active-tab-text-setting.webp)

### Nove bližnjice

- **Preklopi razdeljen pogled** (`Ctrl+S`): prikažite ali skrijte razdeljen pogled v navigatorju;
- **Obnovi zaprti zavihek** (`Ctrl+Shift+T`): obnovite nazadnje zaprto skupino zavihkov;
- **Ustvari datoteko / imenik** (`Ctrl+Shift+M` / `Ctrl+Shift+N`): ustvarite novo datoteko ali imenik v trenutnem imeniku;
- **Natisni izbrano datoteko** (`Ctrl+O`): natisnite izbrano datoteko;
- **Odpri kopirano pot** (`Ctrl+Shift+V`): odprite veljavno pot iz odložišča;
- **Preklopi strani** (`Alt+1` - `Alt+5`): preklapljajte med Domov, Navigator, Nadzorna plošča, Nastavitve in Razširitve;
- **Navigacija po zgodovini imenika** (`Alt+Left` / `Alt+Right`): pojdite nazaj ali naprej po zgodovini navigatorja;
- **Pojdi v nadrejeni imenik** (`Alt+Up`): pojdite v nadrejeni imenik;
- **Gumbi zgodovine miške** (`Mouse Button 4` / `Mouse Button 5`): krmarite nazaj in naprej s stranskimi gumbi miške;

![create-file-directory-shortcuts](./public/changelog/assets/2.1.0/create-file-directory-shortcuts.webp)

![navigator-shortcuts](./public/changelog/assets/2.1.0/navigator-shortcuts.webp)

### Izboljšave uporabniške izkušnje

#### Zmogljivost velikih imenikov

Navigacija, hitro iskanje in mape z veliko predstavnostnimi datotekami delujejo hitreje ter porabijo manj pomnilnika.

- **Ustvarjene sličice**: slike in videoposnetki dobijo manjše sličice, zato posamezni kartici datoteke ni treba naložiti celotne predstavnostne datoteke;
- **Progresivne slike**: kartice slik v mreži lahko prikažejo zamegljeno sličico nizke ločljivosti, preden je končna sličica pripravljena;
- **Preklic ustvarjanja sličic**: ob spremembi mape ali vidnih elementov se lahko ustvarjanje prekine;
- **Zmogljivost upodabljanja**: vsebina velikih imenikov se upodablja učinkoviteje, hitri predogled pa uporablja ustvarjene sličice in navidezni seznam;

![low-res-image-thumbnail-preview](./public/changelog/assets/2.1.0/low-res-image-thumbnail-preview.webp)

#### Hitro iskanje

Hitro iskanje ima zdaj dva načina: pasivni in aktivni:

- **Pasivni način**: vklopi se samodejno ob začetku tipkanja, filtrira elemente brez prehoda v iskalno polje in ne ovira navigacije.
- **Aktivni način**: vklopi se s `Ctrl+F`, premakne fokus v iskalno polje in začasno onemogoči navigacijo, vendar omogoča natančnejše urejanje poizvedbe.

Druge spremembe:

- **Tipkanje za filtriranje**: alfanumerične tipke v aktivnem podoknu vedno zaženejo hitro iskanje v pasivnem načinu;
- **Navigacija s tipkovnico**: prvi rezultat se izbere samodejno;
- **Pojavno okno**: okno hitrega iskanja je kompaktnejše in manj prekriva vsebino imenika;

![quick-search](./public/changelog/assets/2.1.0/quick-search.webp)

#### Urejevalnik naslova

Urejevalnik naslova lahko zdaj uporabite za hitro odpiranje datotek in poti.

- **Datoteke in imeniki**: odprite datoteke in imenike iz urejevalnika naslova;
- **Pogoste poti**: preklopite v poseben način za hitro odpiranje pogosto uporabljenih poti;
- **Predlogi**: izbirajte med elementi imenika, natančnimi ujemanji, nedavnimi potmi, označenimi elementi, uporabniškimi mapami in sistemskimi pogoni;
- **Dejanja s tipkovnico**: iz urejevalnika se premikajte nazaj, naprej ali navzgor in prikažite element v nadrejenem imeniku;

![address-editor](./public/changelog/assets/2.1.0/address-editor.webp)

#### Središče stanja

Središče stanja je zdaj kompakten pripomoček v orodni vrstici z jasnejšo razvrstitvijo operacij.

- **Število aktivnih operacij**: gumb v orodni vrstici se razširi v kompaktno značko s številom dejavnih operacij;
- **Skupine operacij**: dejavne in dokončane operacije so ločene, dokončane pa so zbrane v zložljivem razdelku;
- **Prekliči vse**: iz glave razdelka lahko hkrati prekličete vse dejavne operacije;
- **Kartice operacij**: vrsta in stanje sta označena jasneje, na primer `Kopiranje | Uspeh` ali `Arhiviranje | Napaka`;
- **Obnovitev odložišča**: ko je operacija lepljenja dodana v čakalno vrsto, se odložišče počisti, ob neuspehu pa se njegova vsebina obnovi;

![status-center](./public/changelog/assets/2.1.0/status-center.webp)

#### Navigacija in zavihki

Krmarjenje po navigatorju in delovanje zavihkov sta predvidljivejša.

- **Pogoni v stranski vrstici**: klik na pogon v navigacijski stranski vrstici ga odpre v trenutnem zavihku;
- **Trenutni imenik**: zadnji del naslova je izrazitejši, z desnim klikom nanj pa odprete kontekstni meni trenutnega imenika;
- **Zaprti zavihki**: obnovljeni zavihki se vrnejo na prejšnje mesto, upoštevajo preimenovane poti, pri izbrisani poti pa odprejo domačo stran;
- **Odzivna postavitev**: navigacijski gumbi v orodni vrstici se skrčijo prej, naslovni vrstici razdeljenega pogleda se v zelo ozkih podoknih premakneta v drugo vrstico, kompaktni zavihki pa ohranijo enako višino;

![nav-sidebar-drive-current-tab](./public/changelog/assets/2.1.0/nav-sidebar-drive-current-tab.webp)

![current-directory-address-bar](./public/changelog/assets/2.1.0/current-directory-address-bar.webp)

#### Upravljanje bližnjic

Nastavljanje bližnjic in razreševanje sporov sta zdaj jasnejša.

- **Več vezav**: eni akciji dodelite več bližnjic;
- **Nedodeljene bližnjice**: dejanjem lahko odstranite dodeljene bližnjice;
- **Zamenjava ob sporu**: sporno bližnjico zamenjajte neposredno v opozorilu;
- **Kontekstni meni**: bližnjice upravljajte iz kontekstnega menija seznama;

![shortcut-editor](./public/changelog/assets/2.1.0/shortcut-editor.webp)

#### Povleci in spusti

Datoteke lahko zdaj povlečete v drugo aplikacijo tudi po preklopu z Alt+Tab; kazalca ni več treba najprej premakniti iz okna;

### Izboljšave uporabniškega vmesnika

- **Izbirni obris**: izboljšani so njegova prosojnost in odmik, videz glave podokna ter obnašanje fokusa pri uporabi tipkovnice;
- **Vrstica zavihkov**: izboljšani slogi vrstice zavihkov in berljivost aktivnega zavihka;
- **Izbira teme**: izboljšana zasnova izbire teme;
- **Hitri dostop**: dodelan je videz podokna za hitri dostop;
- **Zagonski zaslon**: med zagonom aplikacije se zdaj prikaže uvodni zaslon;
- **Vidnost pojavnih oken**: izboljšana vidnost prosojnih elementov pojavnih oken;
- **Namigi**: dodani namigi na več gumbov orodne vrstice;
- **Prevodi**: izboljšani japonski in vietnamski jezikovni nizi ter očiščena struktura lokalizacije;

![selection-ring](./public/changelog/assets/2.1.0/selection-ring.webp)

![tab-bar-styles](./public/changelog/assets/2.1.0/tab-bar-styles.webp)

![narrow-window-layout](./public/changelog/assets/2.1.0/narrow-window-layout.webp)

### Popravki napak

- **Preslikani pogoni**: obnovljeno je vlečenje datotek iz preslikanih omrežnih pogonov v druge aplikacije;
- **Pomikanje s tipkovnico**: prva vrstica se ne skrije več za pritrjeno glavo;
- **Zastoj ob zagonu**: odpravljeni so redki večminutni zastoji v sistemu Windows, ki so jih povzročali počasni sinhroni sistemski klici med zagonom in preverjanjem posodobitev;
- **Razpakiranje arhivov**: pri razpakiranju se zdaj ohranijo dovoljenja datotek Unix;
- **HTTP razširitev**: obnovljena je obravnava trajnih odgovorov s kodami, ki niso 2xx, čakanje pred ponovnim poskusom pa je mogoče preklicati;
- **Ukazna paleta**: gumb ukazne palete v orodni vrstici znova deluje po spremembi njene bližnjice;
- **Izbira obsega v mreži**: obseg ne vključuje več elementov zunaj svojih meja;
- **Kontekstni meniji**: menija izbranega elementa in trenutnega imenika se po izbiri dejanja zapreta;
- **Registracija bližnjic**: popravljene napake registracije bližnjic po ponovnem nalaganju okna;
- **Uporaba tem**: izbrana tema se zdaj uporabi v vseh oknih;
- **Premiki v macOS**: popravljeni so premiki med nosilci in dodana podpora za aplikacijske pakete kot cilje;
- **Privzeti upravitelj datotek**: obnovitev registra sistema Windows je varnejša, če nastavitev privzetega upravitelja ne uspe ali če se obnavljajo prejšnje sistemske vrednosti;

![keyboard-scroll-floating-header](./public/changelog/assets/2.1.0/keyboard-scroll-floating-header.webp)

---

## [2.0.0-beta.3] - April 2026

**Povzetek:** Sistem razširitev s tržnico, deljenje datotek v lokalnem omrežju, meni za hitri dostop, zip arhivi, WSL pogoni, urejanje oznak, izboljšan hitri predogled in iskanje, izboljšave vizualnih učinkov ter številne izboljšave uporabniške izkušnje in stabilnosti.

### Nove funkcije

#### Sistem razširitev

Popoln sistem razširitev z odprto tržnico.

- **Tržnica**: brskajte, nameščajte in upravljajte razširitve iz tržnice;
- **Lokalna namestitev**: razširitve lahko namestite iz lokalne mape;
- **Ukazna paleta**: nov način za aktiviranje ukazov aplikacije in razširitev;
- **Zmožnosti**: razširitve lahko registrirajo lokalne in globalne bližnjice, elemente kontekstnega menija, nastavitve, celotne strani in ukaze;
- **Upravljanje različic**: namestite lahko različne različice razširitev in omogočite samodejno posodabljanje;
- **Lokalizacija**: razširitve lahko ponudijo prevode za različne jezike;
- **Upravljanje binarnih datotek**: razširitve lahko uporabljajo binarne datoteke (ffmpeg, deno, node, yt-dlp, 7z in katero koli drugo obstoječo binarno datoteko);
- **Izolirana izvedba**: razširitve se izvajajo v izoliranih ESM peskovnikih z natančnimi dovoljenji;

#### Privzeti upravitelj datotek

SFM lahko zdaj nastavite kot privzeti upravitelj datotek v sistemu Windows (`Nastavitve > Eksperimentalno`). Ko je ta nastavitev omogočena, bo večina sistemskih dejanj z datotekami preusmerjena v SFM:

- Ikona aplikacije Raziskovalec;
- Bližnjica `Ctrl+E`;
- Pokaži datoteko v mapi;
- Pokaži prenose (ko prenesete datoteko v brskalniku);
- Terminalski ukazi: "start {pot}", "code {pot}" itd.
- In več;

Izvorni sistemski pogledi, kot so »Koš«, »Nadzorna plošča« in podobni globoko integrirani programi, so preusmerjeni nazaj v izvorni Raziskovalec.

#### Deljenje v lokalnem omrežju

Delite in pretakajte datoteke ter imenike prek lokalnega omrežja neposredno iz aplikacije.

Do deljenja v lokalnem omrežju dostopate prek gumba v orodni vrstici navigatorja ali prek kontekstnega menija na kateri koli datoteki ali imeniku. Ko je deljenje aktivno, se prikažeta QR koda in URL naslovi za deljenje. Na voljo sta dva načina:

- **Pretakanje**: pretakajte datoteke in imenike na katero koli napravo v omrežju prek spletnega brskalnika;
- **FTP**: delite datoteke prek FTP za neposreden dostop iz drugih aplikacij. Datoteke lahko prenašate in nalagajte z in na računalnik iz druge naprave;

#### Meni za hitri dostop

Gumb »Nadzorna plošča« v stranski vrstici zdaj deluje kot meni za hitri dostop. Ko se z miško pomaknete nanj, se odpre plošča s priljubljenimi in označenimi elementi.

Vsi elementi na plošči so dejanski vnosi imenika – elemente lahko vlečete in spuščate noter in ven, odprete kontekstne menije z desnim klikom in izvajate vse standardne operacije z datotekami.

Lahko se onemogoči v `Nastavitve > Videz uporabniškega vmesnika > Odpri ploščo za hitri dostop ob lebdenju`.

#### Zip arhivi

Stiskajte in razširjajte zip arhive neposredno iz menija dejanj brskalnika datotek:

- **Razširi**: razširite datoteko `.zip` v trenutni imenik ali v poimenovano mapo;
- **Stisni**: stisnite izbrane datoteke in imenike v arhiv `.zip`;

#### Zaznavanje WSL pogonov

V sistemu Windows aplikacija zdaj samodejno zazna nameščene WSL distribucije in prikaže njihove pogone v navigatorju, kar vam omogoča izvorno brskanje po datotečnih sistemih WSL.

#### Urejanje oznak

Zdaj lahko urejate imena in barve oznak. Odprite izbirnik oznak na kateri koli datoteki ali imeniku, da preimenujete oznake, spremenite njihovo barvo ali jih izbrišete.

#### Posodobitve v aplikaciji

Zdaj lahko posodobitve prenesete in namestite neposredno iz obvestila o posodobitvi, ne da bi zapustili aplikacijo.

#### Kopiraj pot

Dodana možnost »Kopiraj pot« v kontekstni meni datotek in imenikov.

#### Zapri podvojene zavihke

Dodana možnost zapiranja podvojenih zavihkov iz vrstice zavihkov, ki odstrani vse zavihke, ki kažejo na isti imenik.

#### Kontekstni meniji domače strani in nadzorne plošče

Elementi na domači strani in nadzorni plošči imajo zdaj polne kontekstne menije, ki se ujemajo s funkcionalnostjo, ki je na voljo v navigatorju.

### Nove nastavitve

- **Prikaži medijsko pasico domače strani**: prikažite ali skrijte medijsko pasico domače strani (`Nastavitve > Videz uporabniškega vmesnika > Medijska pasica domače strani`);
- **Zakasnitev namigov**: nastavite zakasnitev pred prikazom namigov (`Nastavitve > Videz uporabniškega vmesnika > Namigi`);
- **Relativni čas**: prikažite nedavne časovne žige v relativnem formatu, npr. »pred 5 min« (`Nastavitve > Splošno > Datum / čas`);
- **Format datuma in časa**: nastavite format meseca, regionalni format, 12-urno uro, sekunde in milisekunde (`Nastavitve > Splošno > Datum / čas`);
- **Zameglitev ozadja dialoga**: nastavite intenzivnost zameglitve za ozadja dialogov (`Nastavitve > Videz uporabniškega vmesnika > Nastavitve sloga`);
- **Filtri svetlosti in kontrasta**: prilagodite filtre svetlosti in kontrasta za uporabniški vmesnik aplikacije (`Nastavitve > Videz uporabniškega vmesnika > Nastavitve sloga`);
- **Svetlost prekrivnega medija**: prilagodite svetlost prekrivnega medija vizualnih učinkov (`Nastavitve > Videz uporabniškega vmesnika > Vizualni učinki`);
- **Način mešanja vizualnih učinkov**: prilagodite način mešanja za vizualne učinke, ki vam omogoča izbiro, kako se ozadje meša z uporabniškim vmesnikom aplikacije (`Nastavitve > Videz uporabniškega vmesnika > Vizualni učinki`);
- **Zaustavi video v ozadju**: zaustavite pasico domače strani in video v ozadju, ko je aplikacija nedejavna ali pomanjšana (`Nastavitve > Videz uporabniškega vmesnika > Vizualni učinki`);
- **Privzeti upravitelj datotek**: nastavite Sigma File Manager kot privzeti raziskovalec datotek v sistemu Windows (`Nastavitve > Eksperimentalno`);
- **Zagon ob prijavi v sistem**: samodejno zaženite aplikacijo ob prijavi v sistem (`Nastavitve > Splošno > Vedenje ob zagonu`);

### Nove bližnjice

- **Kopiraj pot trenutnega imenika** (`Ctrl+Shift+C`): kopirajte pot trenutnega imenika v odložišče;
- **Osveži trenutni imenik** (`F5`): osvežite seznam datotek navigatorja;
- **Povečaj / pomanjšaj** (`Ctrl+=` / `Ctrl+-`): povečajte ali zmanjšajte povečavo uporabniškega vmesnika;
- **Celozaslonski način** (`F11`): preklopite celozaslonski način;

### Novi jeziki

- **hindijščina**;
- **urdujščina**;

### Izboljšave uporabniške izkušnje

#### Izboljšave hitrega predogleda

- **Navigacija po medijih**: pomikajte se med datotekami v trenutnem imeniku, ne da bi zaprli hitri predogled;
- **Predogled besedilnih datotek**: izboljšan predogled besedilnih datotek z ustreznim zaznavanjem kodiranja, urejanjem v vrstici in upodobitvijo razčlenjenega markdown-a;

#### Izboljšave hitrega iskanja

- **Vse lastnosti**: iščite po kateri koli lastnosti datoteke – ime, velikost, število elementov, spremenjeno, ustvarjeno, dostopano, pot ali vrsta MIME (npr. `modified: today`, `mime: image`);
- **Obsegi velikosti**: filtrirajte po velikosti s primerjavami in obsegi (npr. `size: >=2mb`, `size: 1mb..10mb`);

#### Operacije z datotekami

- **Varnost pri reševanju konfliktov**: izboljšana varnost datotek znotraj modalnega okna za reševanje konfliktov, da se prepreči nenamerna izguba podatkov;
- **Enkratno lepljenje**: kopirane elemente je mogoče prilepiti le enkrat, kar preprečuje nenamerno podvojeno lepljenje;
- **Kopiranje besedila**: omogočeno kopiranje besedila uporabniškega vmesnika s `Ctrl+C`, ko ni izbranih datotek;

#### Vizualni učinki

- **Upravitelj ozadja**: v nastavitve dodan upravitelj ozadja za centralizirano prilagajanje ozadja;
- **Ponastavitev učinkov ozadja**: dodana tipka za ponastavitev nastavitev učinkov ozadja;

#### Ostalo

- **Zmanjšanje velikosti aplikacije**: zmanjšana velikost paketa aplikacije z izključitvijo vgrajenih ozadij visoke ločljivosti in uporabo stisnjenih predogledov v urejevalniku medijske pasice;
- **Globalno iskanje**: v praznem stanju prikazan gumb »prikaži nastavitve« in povečana privzeta globina iskanja;
- **Bližnjice Windows**: datoteke `.lnk` zdaj odprejo svoj cilj v navigatorju namesto zunanjega zagona;
- **Nadzorna plošča**: izboljšana postavitev razdelka z oznakami;
- **Kontekstni meni naslovne vrstice**: dodan kontekstni meni elementom naslovne vrstice;
- **Kontekstni meni navigatorja**: prikaz kontekstnega menija ob kliku na prazno območje v navigatorju;
- **Odpri v novem zavihku**: odprite imenike v novem zavihku s srednjim klikom miške;
- **Pomikanje zavihkov**: novo dodani zavihki se samodejno pomaknejo v pogled;
- **Fokus menija**: meniji ne vračajo več fokusa na sprožilni gumb, ko so zaprti s klikom zunaj;
- **Zapri iskanje**: zaprite globalno iskanje s tipko `Escape`;
- **Hitrejši zagon**: rahlo izboljšana hitrost zagona aplikacije s prednalaganjem nastavitev v Rust;
- **Uporabniški imeniki**: dodana možnost dodajanja in odstranjevanja uporabniških imenikov na domači strani;
- **Omejitve seznamov**: zmanjšane omejitve za vnose pogostih in zgodovinskih seznamov za izboljšanje zmogljivosti;

### Izboljšave uporabniškega vmesnika

- **Ikone orodne vrstice**: poenotene barve ikon orodne vrstice po celotni aplikaciji;
- **Animacije kartic**: dodani učinki postopnega pojavljanja kartic;
- **Svetla tema**: izboljšane barve in kontrast svetle teme;
- **Stabilnost ob zagonu**: izboljšana vizualna stabilnost ob zagonu aplikacije za zmanjšanje utripanja;
- **Obvestila**: izboljšana zasnova obvestil za boljšo doslednost;
- **Samodejno pomikanje zavihkov**: samodejno pomikanje izbranega zavihka v pogled ob odpiranju strani navigatorja;
- **Oznake korenskih poti**: normalizirane oznake korenskih poti po zavihkih in informacijski plošči;
- **Prevodi**: izboljšani prevodi po celotni aplikaciji;

### Popravki napak

- Popravljeno zamrznitev uporabniškega vmesnika pri kopiranju ali premikanju številnih elementov; dodan napredek operacij z datotekami v statusni center;
- Popravljeno zamrznitev uporabniškega vmesnika pri brisanju številnih elementov; dodan napredek brisanja v statusni center;
- Popravljen kontekstni meni v mrežni postavitvi, ki se ni odprl za trenutni imenik, ko je imel drug element že odprt meni;
- Popravljena informacijska plošča, ki ni prikazovala vseh informacij za trenutni imenik;
- Popravljene bližnjice aplikacije, ki so se registrirale na oknu hitrega predogleda namesto le na glavnem oknu;
- Popravljeno, da datoteke, povlečene iz spletnih brskalnikov, niso bile obdelane;
- Popravljeno, da imena datotek iz zunanjih URL spustov niso ohranila veljavnih segmentov;
- Popravljeno, da je bila domača pasica vlečljiva;
- Popravljen predpomnilnik sistemskih ikon, ki ni bil vezan na pot datoteke, kar je povzročalo nepravilne ikone;
- Popravljeni nedostopni korenski vnosi Windows, ki so se prikazovali v navigatorju;
- Popravljene bližnjice po meri, ki niso bile prepoznane na nekaterih razporeditvah tipkovnic;
- Popravljene SSHFS povezave v sistemu Linux;
- Popravljena naslovna vrstica, ki je ustvarjala podvojene vnose zgodovine ob kliku na drobtine;
- Popravljeni rezultati globalnega iskanja, ki se niso odzivali na navigacijo s tipkovnico;
- Popravljeni rezultati globalnega iskanja, ki se niso odpirali ob kliku;
- Popravljen status globalnega iskanja, ki se ni sinhroniziral po inkrementalnem indeksiranju;
- Popravljen izhodilni povleci-in-spusti, ki ni deloval v nekaterih aplikacijah;
- Popravljena nedosledna zasnova značk bližnjic po celotni aplikaciji;
- Popravljena vidnost stolpcev navigatorja v ozkih podoknih;

---

## [2.0.0-beta.2] - February 2026

**Povzetek:** Globalne bližnjice, nove nastavitve, nove funkcije, izboljšano filtriranje datotek, izboljšana naslovna vrstica, izboljšave domače pasice in popravki napak.

### Globalne bližnjice

Zdaj lahko uporabljate bližnjice na tipkovnici za interakcijo z aplikacijo, tudi ko ta ni v fokusu.

Dodane bližnjice:

- `Win+Shift+E` za prikaz in fokusiranje okna aplikacije;

### Nove nastavitve

Dodana nastavitev za izbiro, kaj se zgodi, ko zaprete zadnji zavihek.

![Nastavitev zapri zadnji zavihek](./public/changelog/assets/beta-2/setting-close-last-tab.png)

### Nove funkcije

Dodane nove funkcije v zgodnjem predogledu:

- Omrežne lokacije: omogoča povezavo omrežne lokacije (SSHFS (SSH) / NFS / SMB / CIFS);
- [Linux] Pripenjanje pogonov: omogoča odpenjanje lokacij;

### Filter datotek

Filter datotek je bil izboljšan:
- Ko spremenite imenik, se zdaj samodejno počisti in zapre;
- Funkcija »filtriraj med tipkanjem« se aktivira v izbranem podoknu, ne v prvem;

### Naslovna vrstica

- Izboljšana zasnova in logika samodokončanja;
- Ločila poti so zdaj spustni meniji, ki omogočajo hitro navigacijo do katerega koli nadrejenega imenika;

![Meniji ločil](./public/changelog/assets/beta-2/divider-menus.png)

### Domača pasica / Učinki ozadja

- Izboljšana zasnova urejevalnika medijske pasice:
  - Meni možnosti medijske pasice se zdaj odpre navzdol, da ne zakriva pogleda;
  - Zdaj lahko kliknete zunaj, da zaprete urejevalnik položaja ozadja;
  - Vnos URL premaknjen nad ozadja po meri;
- Slike/videi po meri se lahko uporabljajo v vizualnih učinkih ozadja;
- Odstranjene nekatere privzete slike medijske pasice;
- Dodana nova slika pasice »Exile by Aleksey Hoffman«;

### Izboljšave uporabniške izkušnje

- Aplikacija ob zagonu obnovi prejšnji položaj okna;
- Trenutni zavihek je zdaj mogoče zapreti z bližnjico `Ctrl+W` ali srednjim klikom miške;
- Povečana velikost ikon datotek v pogledu mrežne postavitve;

### Popravki napak

- Popravljeno premikanje datotek med zavihki, ki jih je včasih premaknilo na napačno lokacijo;
- Popravljen navigator, ki je včasih prikazoval napačne sistemske ikone za imenike;
- Popravljeno ustvarjanje večkratnih primerkov aplikacije in sistemske vrstice;
- Popravljen meni razširitev lupine, ki je občasno ponovno pridobival podatke, kar je prisililo seznam, da se je ves čas pomaknil na vrh;

## [2.0.0-beta.1] - February 2026

**Povzetek:** Večje izboljšave uporabnosti in zasnove, vključno z navigacijo s tipkovnico, novimi bližnjicami, odpiranjem v terminalu, samodejnim osveževanjem imenika, povleci in spusti ter izboljšanim iskanjem in pogledi seznamov.

### Navigacija s tipkovnico

Navigirajte po datotekah s tipkovnico s polno podporo za mrežno in seznamsko postavitev ter razdeljeni pogled.

- Puščične tipke za prostorsko navigacijo v mrežnem pogledu in zaporedno navigacijo v seznamskem pogledu;
- Enter za odpiranje izbranega imenika ali datoteke, Backspace za navigacijo nazaj;
- Ctrl+Levo / Ctrl+Desno za preklop fokusa med podokni razdeljenega pogleda;
- Ctrl+T za odpiranje trenutnega imenika v novem zavihku;
- Vse navigacijske bližnjice so prilagodljive v Nastavitve > Bližnjice;

### Samodejno osveževanje imenika

Pogled navigatorja se samodejno osveži, ko so datoteke ustvarjene, izbrisane, preimenovane ali spremenjene v trenutnem imeniku.

- Velikosti datotek se samodejno posodobijo, ko jih spremenijo zunanji programi;
- Učinkovito opazovanje datotečnega sistema z odlogom za preprečevanje prekomernih osvežitev;
- Pametne posodobitve na podlagi razlik spremenijo le prizadete elemente, pri čemer ohranijo položaj pomika in izbiro;

### Povleci in spusti

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/beta-1/drag-and-drop.mp4"></video>

Zdaj lahko vlečete datoteke in mape za enostavno kopiranje/premikanje. Vlecite med podokni, iz ali v sezname rezultatov iskanja, iz ali v zunanje aplikacije.

### Konflikti pri kopiranju

Dodano modalno okno za enostavno reševanje konfliktov pri kopiranju/premikanju.

### Samodejna posodobitev

Dodano samodejno preverjanje posodobitev (mogoče upravljati v nastavitvah).

### Urejevalnik medijske pasice domače strani

Dodan urejevalnik za prilagajanje pasice domače strani. Zdaj lahko naložite slike in videe po meri (podprti so tako lokalni kot oddaljeni URL-ji).

### Izboljšave seznamskega pogleda

- Izboljšana zasnova in odpravljene manjše nevšečnosti;
- Dodana prilagoditev vidnosti stolpcev: izberite, katere stolpce prikazati;
- Dodano razvrščanje po stolpcih: kliknite glave stolpcev za razvrščanje vnosov;
- Privzeta postavitev navigatorja spremenjena na seznamski pogled;

### Izboljšave globalnega iskanja

- Posodobljena postavitev in zasnova s podporo za povleci in spusti;
- Iskanje je zdaj na voljo, medtem ko se pogoni še indeksirajo;

### Odpri v terminalu

Odprite imenike v želenem terminalu neposredno iz kontekstnega menija.

- Samodejna zaznava nameščenih terminalov v sistemih Windows, macOS in Linux;
- Windows Terminal prikaže vse konfigurirane profile lupin z ikonami izvršljivih datotek;
- Privzeti terminal v sistemu Linux samodejno zaznan in prikazan prvi;
- Vključuje navadne in skrbniške/dvignjene načine;
- Privzeta bližnjica: Alt+T;

### Lokalizacija

- Dodan slovenski jezik (zahvala: @anderlli0053);

### Izboljšave uporabniškega vmesnika in uporabniške izkušnje

- Dodan izbirnik pisav: izberite pisavo uporabniškega vmesnika iz nameščenih sistemskih pisav;
- Dodan meni »Ustvari novo« za hitro ustvarjanje datotek ali imenikov;
- Prikaz pogleda praznega stanja pri navigaciji v prazne imenike;
- Vrstica stanja prikazuje skupno število elementov s številom skritih, ko je seznam filtriran;
- Novo ustvarjeni, kopirani in premaknjeni elementi se samodejno pomaknejo v pogled;
- Orodna vrstica odložišča prikazana enkrat pod podokni namesto v vsakem podoknu;
- Poenostavljena zasnova modalnega okna za preimenovanje;
- Odzivne ikone orodne vrstice, ki se strnejo v spustni meni pri majhnih velikostih okna;
- Odstranjen prazen zavihek »Navigacija« iz nastavitev;
- Preimenovanje imenika zdaj posodobi njegovo pot po vseh zavihkih, delovnih prostorih, priljubljenih, oznakah, zgodovini in pogostih elementih;
- Brisanje datoteke ali imenika jo zdaj odstrani iz vseh shranjenih seznamov in prizadete zavihke preusmeri na domačo stran;
- Neobstoječe poti v priljubljenih, oznakah, zgodovini in pogostih elementih se zdaj samodejno počistijo ob zagonu;

### Popravki napak

- Popravljen status indeksiranja globalnega iskanja, ki se ni posodabljal v realnem času;
- Popravljeno podokno razdeljenega pogleda, ki se ni posodobilo, ko je bil njegov imenik izbrisan ali preimenovan iz drugega podokna;
- Popravljeni zavihki, ki so se nalagali z napako, ko njihova shranjena pot ni več obstajala;
- Popravljene sistemske ikone, ki so prikazovale enako ikono za vse datoteke iste vrste namesto edinstvenih ikon za posamezno datoteko;
- Popravljene bližnjice na tipkovnici, ki niso delovale v drugem podoknu razdeljenega pogleda;
- Popravljene bližnjice na tipkovnici, ki so prenehale delovati po navigaciji strani;
- Popravljen uhajanje pomnilnika s poslušalci tipk filtra, ki niso bili počiščeni ob odstranitvi;
- Linux: dodana podpora za pridobivanje privzete aplikacije v meniju »odpri z«;

---

## [2.0.0-alpha.6] - January 2026

**Povzetek:** Okno »Kaj je novega«, hitri predogled, izboljšave kontekstnega menija in nove nastavitve.

### Okno »Kaj je novega«

Okno z dnevnikom sprememb, ki prikazuje nove funkcije in izboljšave za vsako izdajo.

- Samodejno se prikaže po posodobitvah (mogoče onemogočiti);
- Brskajte po vseh izdajah;
- Oglejte si podrobne opise in posnetke zaslona za vsako funkcijo;

### Hitri predogled

Predoglejte datoteke brez polnega odpiranja z lahkim oknom za predogled.

- Pritisnite `Space` ali možnost »Hitri predogled« v kontekstnem meniju za hiter ogled datotek;
- Takoj zaprite s `Space` ali `Escape`.
- Podpira slike, videe, zvok, besedilne datoteke, PDF-je in več;

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/alpha-6/quick-view.mp4"></video>

### Izračun velikosti imenika

- Velikost imenikov se zdaj samodejno izračuna;
- Skupno velikost vseh imenikov, vključno z vsemi podimeniki in datotekami, lahko vidite takoj, ko odprete kateri koli imenik;

![Odpri z](./public/changelog/assets/alpha-6/size.png)

### Nove možnosti kontekstnega menija

#### Odpri z

- Izberite, s katero aplikacijo odpreti datoteko;
- Nastavite prednastavitve po meri za odpiranje datotek v aplikacijah z zastavicami;
- Oglejte si vse združljive aplikacije za katero koli vrsto datoteke;
- Nastavite privzete aplikacije za določene vrste datotek;

![Odpri z](./public/changelog/assets/alpha-6/open-with.png)

#### Razširitve lupine

- Dostopajte do elementov kontekstnega menija lupine Windows;
- Dostopajte do razširitev lupine tretjih oseb (7-Zip, Git itd.);

![Razširitve lupine](./public/changelog/assets/alpha-6/shell-extensions.png)

### Nove nastavitve

#### Zaznavanje pogonov

- Fokusira aplikacijo, ko so priključeni odstranljivi pogoni (mogoče onemogočiti);
- Nadzorujte vedenje samodejnega odpiranja Windows Explorerja za odstranljive pogone;

#### Filtriranje med tipkanjem

Začnite tipkati kjer koli v navigatorju za takojšnje filtriranje elementov v trenutnem imeniku;

#### Bližnjica za iskanje nastavitev

Nova bližnjica na tipkovnici za hiter dostop do iskanja nastavitev;

#### Podatki uporabniške statistike

- Dodan razdelek statistike v nastavitvah;
- Na strani nadzorne plošče si lahko ogledate, navigirate in počistite zgodovino, priljubljene in pogosto uporabljene elemente;

### Izboljšave iskanja

Izboljšano globalno iskanje s hibridnim indeksiranim + neposrednim iskalnim sistemom za bolj zanesljive in ažurne rezultate.

- Iskanja zdaj dosledno trajajo manj kot 1 sekundo (~1 TB polno napolnjen pogon), ne glede na to, kje so datoteke na vaših pogonih;
- Ko iščete po »prednostnih poteh« (tistih, ki jih pogosto odpirate), dobite rezultate takoj in najde datoteke, tudi če so bile pravkar ustvarjene in še niso bile indeksirane.

#### Prednostne poti vključujejo:
- Uporabniški imeniki: Prenosi, Dokumenti, Namizje, Slike, Videi, Glasba;
- Priljubljene;
- Nedavno odprte;
- Pogosto uporabljene;
- Označene;

---

## [2.0.0-alpha.5] - January 2026

**Povzetek:** Operacije z datotekami, globalno iskanje in prilagajanje bližnjic.

### Globalno iskanje

Zmogljivo iskanje po celotnem disku, ki indeksira in išče datoteke po vseh vaših pogonih. Vključuje mehko ujemanje za iskanje datotek tudi s tipkarskimi napakami, samodejno občasno ponovno indeksiranje, prednostno indeksiranje pogosto uporabljenih imenikov in opcijsko vzporedno skeniranje za hitrejše indeksiranje.

![Globalno iskanje](./public/changelog/assets/alpha-5/search.png)

### Operacije z datotekami

Polna podpora za operacije z datotekami s funkcijami kopiranja, premikanja in brisanja, vključno s sledenjem napredka. Vključuje tudi preimenovanje datotek in map na mestu.

### Urejevalnik bližnjic

Prilagodite vse bližnjice na tipkovnici v aplikaciji. Oglejte si trenutne vezave, zaznajte konflikte in ponastavite na privzete vrednosti.

### Izboljšave navigatorja

Dodana možnost prikaza izvornih sistemskih ikon za datoteke in imenike namesto minimalističnih glifov. Navigacijski zavihki nastavitev se zdaj držijo strani med pomikanjem.

---

## [2.0.0-alpha.4] - January 2026

**Povzetek:** Domača stran, vizualni učinki in možnosti prilagajanja uporabnika.

### Domača stran

Lepa domača stran z animirano medijsko pasico, seznamom pogonov in hitrim dostopom do pogostih uporabniških imenikov, kot so Dokumenti, Prenosi, Slike in več.

### Vizualni učinki

Prilagodljiv razdelek vizualnih učinkov v nastavitvah, ki doda zameglitev, prosojnost in šumne učinke ozadju aplikacije. Podpira različne nastavitve za vsako stran.

### Urejevalnik uporabniških imenikov

Prilagodite kartice uporabniških imenikov z naslovi, ikonami in potmi po meri. Personalizirajte videz imenikov za hitri dostop na domači strani.

### Urejevalnik položaja pasice

Natančno nastavite položaj ozadij pasice domače strani. Prilagodite povečavo, vodoravno in navpično pozicioniranje za popoln videz.

### Izboljšave nastavitev

- Iskanje nastavitev zdaj deluje v katerem koli jeziku, ne le v trenutnem;
- Aplikacija bo ob ponovnem nalaganju obnovila nazadnje obiskan zavihek nastavitev namesto odpiranja prvega vsakič;

---

## [2.0.0-alpha.3] - December 2025

**Povzetek:** Pogled navigatorja z zavihki, delovnimi prostori in novim sistemom zasnove.

### Pogled navigatorja

Osnovna izkušnja brskanja po datotekah s sodobnim sistemom zavihkov, ki podpira delovne prostore, novo zasnovo orodne vrstice okna z integriranimi kontrolami in navigacijo z dvojnim podoknom za učinkovito upravljanje datotek.

### Video sličice

Dodane predogledne sličice za video datoteke v navigatorju.

### Migracija sistema zasnove

Aplikacija preseljena iz Vuetify na Sigma-UI za bolj prostorno, sodobno zasnovo z izboljšano kakovostjo kode.

---

## [2.0.0-alpha.1] - January 2024

**Povzetek:** Popolna ponovna pisava z uporabo sodobnih tehnologij.

### Migracija na Tauri

Sigma File Manager v2 je bil na novo zgrajen od temeljev z uporabo Vue 3 Composition API, TypeScript in Tauri v2. Velikost namestitve aplikacije zmanjšana s 153 MB na le 4 MB v sistemu Windows. Velikost nameščene aplikacije zmanjšana s 419 MB na 12 MB.

### Spremenljiva podokna

Dodana funkcija spremenljivih podoken, ki vam omogoča razdelitev pogleda navigatorja na pol in delo z dvema imenikoma drug ob drugem.

### Začetne funkcije

Osnovna navigacija po datotekah s seznamom imenikov, upravljanje oken z gumbi za pomanjšanje, povečanje in zapiranje ter začetna struktura strani z nastavitvami.
