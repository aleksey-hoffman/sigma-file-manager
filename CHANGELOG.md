# CHANGELOG
# Release Notes: v1.6.0 (2023-02-15)

- 1 new major feature
- 6 new features
- 11 improvements
- 12 fixes

## New major features
- **Localization:** Added ability to change UI language. Added 9 most popular languages.
  >**Note for contributors**: Detailed instructions for adding/editing a language are available at https://github.com/aleksey-hoffman/sigma-file-manager/discussions/196.

## New minor features
- **UI design:** Added option to make toolbars transparent;
- **Fonts:** Added option to change font;
- **Tabs:** Added option to display navigator tab preview;
- **Tabs:** Added option to display storage indicator on navigator tab;
- **Tabs:** Added option to change navigator tab width;
- **Date/time format:** Added option to choose date / time regional format;

## Improvements
- **Navigator:** Improved user experience for file management tasks such as copying, moving, creating, and renaming files. Now files will be scrolled into view and selected automatically;
- **Navigator:** The copy / move operations will now be disabled when any modal window is opened to avoid accidental file transfer actions;
- **Drag & drop:** The `.url` link-files are now treated as files;
- **UI design:** Improved and unified design for drive cards on both home page and nav panel;
- **Home banner:** Added ability to easily set previous home media from the home page via switch button (by pressing `Alt + Click`);
- **Search:** Increase max possible search scan depth from 10 to 15;
- **Search:** Improved "Recent items" list design;
- **Search:** Improved list item design to fit in more text;
- **Navigator:** Dir items will now only get highlighted when selecting dir item range, not just when pressing `Shift`;
- **New guide:** Added video downloading guide.
- **Other improvements:** Various small improvements;

## Major fixes
- **App:** Fixed the issue with the app not exiting properly;
- **Workspaces:** Fixed broken functionality and improved feature in general;
- **QuickView:** Fixed the issue with QuickView not working in production build;
- **QuickView:** Fixed issues with media size and background colors:
  - Fixed media size issue on Win 11 (scrollbars and videos jumps);
  - Fixed text files showing white text on white background on dark theme;
- **Search:** Fixed 'end of file' error during interrupted search data scan;
- **Home banner:** Fixed animations, improved props adjustment UX;
- **Cards:** Fixed duplicate OneDrive cards issue;

## Minor fixes
- **Navigator:** Fixed the issue with navigator list stretching outside container when navigating directories with long address path;
- **Context menu:** Fixed the issue with active status for protected and pinned items not updating sometimes;
- **Styles:** Fixed broken styles in external program editor;
- **Styles:** Fixed visual filters not showing on the home page on first launch;

## Other changes
- **Home banner:** Added new default home banner image;
- **Search:** Search data compression setting is disabled by default, to avoid potential 'end of file' error;
- **Home banner:** Changed default overlay type to "mask-overlay";
- **Tabs:** Use traditional horizontal tab layout by default;

## Development
- **Dependencies:** Updated code dependencies.
- **Code refactor:** Various code refactoring.

# Release Notes: v1.5.0 (2022-08-10)

- 28 new features
- 64 improvements
- 26 fixes

## New minor features
- 5a7e7ea | New setting: option to disable global search feature and data scans
- a631a66 | New setting: option to open directories in new tab with `Middle click`
- 7ab2d46 | New setting: UI 'contrast' filter
- 9bc627f | New setting: UI 'brightness' filter
- 3eba483 | New setting: UI 'saturation' filter
- bf59c4e | New setting: option to display navigation panel drive letter overlay
- 1e886e1 | New setting: option to switch history navigation type;
- 273ff8c | New setting: option to switch to 'light filter' theme
- 702a88c | New setting: option to display accent color backgrounds
- c2e1328 | New setting: option to close the app window when the last workspace tab is closed
- b792520 | New setting: option to display seconds and milliseconds
- b5258c1 | New setting: option to change max width of name column of navigator item
- 25629c5 | New setting: option to show dividers between files and directories
- 43dd838 | New setting: option to show workspace title in window toolbar
- 8a9553a | New setting: option to choose style for home page cards. Added 2 new designs: Neoinfusive-extruded, Neoinfusive-flat-glow
- 577c0cd | New setting: option to activate item filtering when typing
- b021aee | New setting: added "traditional horizontal" tab layout
- 8f61753 | New feature: added filter on settings page
- dabaa2e | New setting: option to save navigator sorting type
- 8f61753 | New feature: add filter on settings page
- fa919bb | UX: improved archiver design, added new functionality:
  - Allow to specify compression level.
  - Allow to encrypt / extract an archive with password.
  - Allow to specify archive destination path.
  - Add option "delete files after compression".
  - Display archive info before extraction.
- c08553f | UX: add modifiers to change the type of copying to clipboard: "wrap with quotes", "add second slash"
- f7b3073 | UX: global search: show search results for recent files instantly
- 318c680 | UX: allow to customize user directories
- c95d9ee | UX: info panel: display directory item count
- ca45954 | New feature: display file media properties
- a1fcb13 | New feature: navigator sorting toolbar
- b0fbef3 | New feature: directory items: display color overlays for copy / move operations

## Major improvements
- 318c680 | UX: add context menu to home page items
- d8f4d43 | UI / UX: clipboard toolbar: improve design, add new functionality:
  - Display total size of items in clipboard
  - Improve filtering in the "show items" menu
  - Add icons and tooltips to action buttons
  - Adapt design to narrow window sizes
- 4eaf7aa | UI: address bar: improve design, add new functionality:
  - Add "Edit address" button to address bar container.
  - Add "Pin" button to address bar editor to allow closing the editor by clicking outside of it
  - Add ability to scroll address container with vertical axis scroll
  - Move address bar menu button inside the address bar container.
  - Improve styling
  - 0f96f67 | New feature: address-bar: ability to open context menu on `Right click`
  - 25d8eef | New feature: address-bar: ability to edit address on 'Ctrl + Click'
  - 25d8eef | UX: address-bar: improved design
- 8f0ecfd | UI / UX: improve design of global search component widget significantly
- 862213c | UX / performance: navigator: improve perceived UI rendering performance
- f121552 | UX / performance / refactor: greatly improve directory loading performance:
  - (reverted temporarily) Offload directory info fetching to worker_threads to avoid UI freezes.
  - Improve UI responsiveness when switching between pages.
  - Add preload function to load a small slice of the directory items immediately.
  - Refactor code.

## Minor improvements
- b93cf42 | UI: fix design issues of global search widget
- cbc5b22 | UX: improve item filtering performance
- decc53b | UI / dev: update notification card; add progress loader
- f51d796 | UI: display custom scrollbar in menus
- 411b63b | UX: change default windowTransparencyEffect blur value
- 49748c5 | UX: optimize guide images
- 426448e | UX: restore page scroll position on app reload
- 1867a44 | UX: update yt-dlp binaries; binary clean up
- 2db5bfe | UX: home page background manager: improve design
- a383a2f | UI: notes: fix visual freeze on page load
- 1343037 | UI: navigator: add loader element to indicate directory loading status
- f9affc0 | UX / performance: navigation panel: optimize UI render performance (20fps => 60fps) in some cases
- 9a5144a | UI: improve setting section design
- 3f4804d | UI: improve styling of accent color backgrounds
- 65c5733 | UI: context menu: add sub menu indicator
- d5ee9d2 | UX: copy paths without quotes by default, add quotes modifier
- 8bb25c6 | UI: improve accent color consistency
- c697d6c | UI: navigator info panel: remove border from preview container
- b6240eb | UI: context menu: change share icons
- 4aa6648 | UX: context menu: move quick-view button to the main context menu list
- 9287870 | UI: navigator dir item: remove checkbox, improve overlay visibility
- 17d8130 | UI: navigator dir item: improve file extension container styles
- 0f2f947 | UI: navigator dir item: improve spacing styles
- a6f722e | UI: navigator: display dividers under titles
- 487a4fd | UI / UX: menus: improve design and consistency; add filter; add item discard button
- 059112b | UX: extend window drag area to full height in maximized state
- b4ad52b | UI: window toolbar: improve styling of workspace button
- e67adbe | UI: window toolbar: display current workspace name
- cae0746 | UI: window toolbar: display current tab number
- 98909ba | UI: window toolbar: change styling of menu buttons
- db206d4 | UI: window toolbar: display "add new tab" button on window toolbar
- 83021e0 | UI: filter field: improve file menu styling
- 52cb517 | UI: filter field: add hover transition
- ada90d2 | UI: toolbars: refactor and restructure some code
- 1c94e15 | UI: remove scroll top button from window toolbar
- 92eff1f | UX: add shortcuts list to settings page
- 043ea01 | UI: move shortcuts list from window toolbar to app guide
- 1535092 | UI: change navigation panel width from 64px to 48px
- 6286676 | UX: increase window controls button size
- 0ebef1d | UI: refactor some notifications
- a5799f1 | UX: directory items will now display selected sorting type value
- 96ec98c | UX: new sorting type: "date modified meta"
- 4d0e243 | UX: updater: set default value of update.autoDownload to false
- e934410 | UX: new global shortcut: "open global search"
- bfbafb4 | UX: new shortcut: `Ctrl + Q`: close app window 
- 04a2430 | UX: new shortcut: `Ctrl + Shift + W`: close all tabs in current workspace / close app window
- 9e08e4e | UX: new shortcut: `Ctrl + W`: close current tab / window
- b554e33 | UI: tray-menu: add ability to open on `Left click`
- 93a4d87 | UI: tray-menu: improve and simplify design
- 52cd137 | UI: navigator-workspace-toolbar : improve design and consistency
- 9857049 | UX: input: change default actions for mouse buttons 3 and 4
- Update dependencies
- Small code refactor
- A few other small improvements

## Major fixes
- 7dcc834 | Fix: directory is flashing on update
- be9df05 | Fix: local directory share server is not closing properly and causing errors
- 50bebf7 | Fix: some user settings don't get saved to storage
- 6740b39 | Fix: quick view: PDF preview is not working
- a6d4710 | Fix: large OneDrive directory causes low performance / UI freezes
- 90af704 | Fix: settings with outdated object structure don't get applied
- 1a51ada | Fix: navigator: filter is cleared on directory reload
- 1f23c5b | Fix: navigator: range selection selects hidden items
- 55c1070 | Fix: navigator: when selecting all dir items with filtering enabled, only the visible items are selected
- 77128e3 | Fix: drag feature issues; minimal refactor
- 0fdbd32 | Fix: showing empty drive list when only 1 drive / partition is mounted
- ed5817c | Fix: global search: path pattern matching is not working; inits twice

## Minor fixes
- 031b0c8 | Fix: window visual effects are not applied on the first load
- 3f0e72c | Fix: window cannot be resized from the top side and corners
- 8744408 | Fix: shortcut: 'focusFilter' cannot unfocus the field
- 7607a53 | Fix: visual filters are not being applied to home banner glow
- 23877d9 | Fix: disable updater in Microsoft store build
- 7439c41 | Fix: info panel: was copying value on click without `Ctrl` modifier
- a5febab | Fix: directory is not loading fully sometimes
- 066dcda | Fix: global search field autofocus is not working
- 3d904b7 | Fix: dashboard: list item's action buttons don't work with 'single click' setting enabled
- 1e886e1 | Fix: broken logic in history navigation
- c4e1bb6 | Fix: small bugs in FilterField
- 5d0ef15 | Fix: window visual effects: blur is not applied on media change
- f783b62 | Fix: focusing app from taskbar is not working when the app window is closed
- Refactor some code styling and structure; fix potential errors

## Other changes
- 3aaba07 | Feature: remove ability to create hard links on Windows

# Release Notes: v1.4.0 (2021-09-04)

This release improves resource usage, brings a few new features, and a lot of improvements and fixes:

- 1 new major feature
- 1 new minor feature
- 18 improvements
- 7 fixes

##  Milestones
🔼 **by v2.0.0 (December 2021) | (Goal: 3 of 20):** Add 20 more new major features

## New major features
- 574787c: **Feature**: added support for cloud drives (OneDrive, Google Drive, etc.). 
**Edit:** If you have millions of files on OneDrive, the app will have high CPU usage and might stuck on the start screen. The issue will be fixed in the next update.

## New minor features
- 8401af7: **UX**: new setting: the date format can now be customized. Currently available numeric: `23.05.2021` and short format: `23 May 2021`. It adapts to the local format automatically. For example, in Japan it will be displayed as `2021/5/23` or `2021年5月23日`

## Big improvements
- 92a6fd5:  **UX / optimization**: the background manager for home banner will now display small artwork previews instead of loading original images. This reduced memory usage peaks from `700 MB` to `150 MB`,

## Other improvements
- 0d09def: **UX**: Window transparency effect can now be customized for every page independently.
- ec1e54e: **UX**: Window transparency effect: added settings to control parallax effect.
- ea1c8e9: **UI**: Window transparency effect: added 2 settings to control effect visibility
- 621c886: **UI**: Home banner: added "glow" effect.
- 9b2faf8: **UX**: Upgrade video downloader. It can now extract more video URLs.
- 520789d: **UI**: Info panel: improved performance, added visual improvements, added file status (if offline) and file mime.
- 4b3dd1b: **UX**: Drive cards will now display drive memory type (SSD or HDD).
- ec3f1a4: **UI**: Added new artwork "Slum by Vladimir Manyukhin (animated by Aleksey Hoffman)".
- 7084aae: **UI**: Added new artwork "INCREASE by Sweeper3d (Austin Richey)".
- b9b0664: **UI**: Added new artwork "Cyber Neon City by Laury Guintrand".
- b9b0664: **UI**: Added new artwork "Lip Sync by Han Yang".
- 7802ac8, 5a657e4: **UI**: Slightly improved notifications.
- 590fb02: **UI**: Inaccessible files will now display at least basic info like size and date it was modified and created.
- 05d1786: **UX**: the time of file creation / change will now be displayed along with the date.
- 05d1786: **UX**: the date and time of file creation / change will now be displayed in local format:
**Japan**: 2021年5月23日 23:16
**USA**: May 23, 2021, 11:16 PM
**Russia**: 23 мая 2021 г., 23:16
**Germany**: 23. Mai 2021, 23:16
- b2e210a: **UX**: the app will now show permissions dialog before activating the local share feature for the first time to make sure user understands why the app is asking network permissions.
- ce9a70e: Update dependencies (security fixes)
- A few other small improvements

## Big fixes
- 99f5792: **Fix**: Local network sharing feature is now working properly.
- 4b3dd1b: **Fix**: Drive labels containing non-ASCII characters are now displayed properly.
- 195d683: **Fix**: Window transparency effect now works on all screen sizes.
- 6281a45: **Fix**: the "get size" button in the info panel will now work properly and show the directory size.

## Other fixes
- 28766c1: **Fix**: the error during launch where the app couldn't get the paths to user directories (`~/pictures`, `~/documents`, etc).
- 728a1b2: **Fix**: the page scroll position will now be restored on all pages.
- 1176d7d: **Fix**:  `Linux`: tray icon will no longer duplicate on every page reload and tray menu update.
- A few other small fixes

# Release Notes: v1.3.0 (2021-08-14)

This release improves stability, performance, and also brings a few new features:

- 1 new major feature
- 2 new minor features
- 12 other improvements
- 4 fixes

## New major features:

- **Feature**: Customizable window transparency effect | e54418a

## New minor features:

- **Feature**: add new shortcuts: `addDirItemsForCopying`, `addDirItemsForMoving`, which allow you to copy / move items from multiple 
 different directories at once | 5ef4a9a
- **Feature**: add ability to create `symlinks`, `hard links` and Windows `.lnk shortcuts` from the context menu by pressing different modifiers | 478b3dc

## Other improvements:

- **UI**: added new artwork for home banner: "Ice Cave by Wang Jie" | 2d40d4c
- **UI**: added new artwork for home banner: "Slum by Vladimir Manyukhin" | cdbfefd
- **UX**: the current directory will now reload immediately after deleting / trashing items | 17cceba
- **UI**: notification cards will now have a nicer and more consistent design | 65b9a41
- **UI**: items in the range selection will now be highlighted immediately when `Shift` key is pressed | 0ca8ff2
- **UI**: filter field menu design was improved | 2a6ef8f
- **UX**: you can now specify a custom path when creating a new link / shortcut  | dc7ae34
- **UX**: icons in context-menu will now dynamically change when you press different key modifiers, and their tooltips will look nicer and more consistent | 106191f
- **UX (for developers)**: All copied paths will now be automatically wrapped with quotes. On Windows, selected paths will now be copied with single backward `\` slashes, or with double backward `\\` slashes by pressing a key modifier | 86695f2
- **UX**: `zoomIncrease` shortcut will now also be triggered with `Ctrl + Plus` on the numpad | 4f90117
- **Dev**: Code optimizations and refactoring
- A few other small improvements in UI

## Fixed:

- **UX**: fixed the issue with archiver feature not working on Linux and MacOS because of bin permissions | 1d646ca
- **UI**: the animation of navigation panel will now work correctly on home page | 24ebe35
- **UI**: removed excessive bottom padding when the bottom clipboard toolbar is shown | d78d7e8
- **UX**: fixed the issue with items getting added to copy / move clipboard when you select other items | 51f345a

# Release Notes: v1.2.0 (2021-06-23):

⚠**Warning:** the app is still in early development stage, use with caution! Before using the app, it's recommended, to copy important files to your cloud storage or an external drive in case something goes wrong. Try not to use it for working with important files, until it's thoroughly tested.

## Milestones:

💗 **(Goal: 1/500 individuals & 0/20 companies supporters)** The first supporter joined our community on Patreon: <a href="https://www.photoancestry.com/" title="Houston Photo Restoration">Houston Photo Restoration</a>
When we meet the goal, I will be able to dedicate more of my time improving the app, and add new features more frequently.

## New minor features:

- **New setting**: switch: "display hidden files". Allows you to toggle visibility of files with `hidden` attribute.
| Contributors: @mattm-malone, @aleksey-hoffman | PR: #75
- **New setting**: switch: "launch app on system login" | b018abc
- **New setting**: switch: "launch app in hidden state" | 3cf3f8b
- **New setting**: switch: "download updates automatically" | da5330b
- **New setting**: switch: "install updates automatically" | da5330b
- **New setting**: menu: "custom pointer buttons actions". Allows you to choose the behavior of mouse buttons `3` and `4` | Fixes #35 | 1ec99bf
- **Shortcuts**: new local shortcut  `F5: reloadDirectory` | Fixes #81 | 4a26f11
- **UX**: Display read-only and immutable directory items | ace9953
- **Archiver**: Added support for more file formats: | 774bbcf
    - **Packing / unpacking**: 7z, XZ, BZIP2, GZIP, TAR, ZIP, WIM.
    - **Unpacking only**: AR, ARJ, CAB, CHM, CPIO, CramFS, DMG, EXT, FAT, GPT, HFS, IHEX, ISO, LZH, LZMA, MBR, MSI, NSIS, NTFS, QCOW2, RAR, RPM, SquashFS, UDF, UEFI, VDI, VHD, VMDK, WIM, XAR, Z.

## Other improvements:

- **UI / community**: Added 3 new default artworks for the home banner | 0c251ec
-  **Community**: Added support links (icons) to the artwork cards, so users can easily find a way to support the artists | 3b73b1f
- **Animations**:
    - **UX**: Removed page transition animation to make the app feel more responsive and improve user workflow speed by `300ms` on every page transition | 3fae2d0
    - **UX**: Home page transition can now be disabled | 80ffd69
-  **Notifications**:
    - **UX**: Notifications will now have a color indicator, making it possible to check the operation status without even reading the notification title or message. The indicator was added only to a few notifications, more will be added soon | 4fb9b3e
    - **UX**: Notifications will now pause their timer when hovered by the cursor, preventing them from closing before you finish reading them | 4fb9b3e
    - **UX**: Dismissed notifications / operations will now be displayed in the notification menu. This will make it possible to, for example, undo some file operations a few minutes after the operation was finished, or interact with a dismissed ongoing operation (e.g. cancel an ongoing download event), etc. | 4fb9b3e
    - **UX**: Notifications for archiving operations will now display a progress bar | fd7a643
    - **UX**: Now, when the current directory is reloaded, a notification will be shown | 3450044
- **UX**: Archiving operations (extraction) can now be canceled | fd7a643
- **UX**: Setting "double-click delay" now has min, max values: `200-1000ms` | 27c7570
- **UX**: Delete existing statistics when the "store statistics" setting is disabled | 1fe62de
- **UX**: Enable "store statistics" setting by default so the features that depend on it work out of the box | 236410e
- **UX**: Show a message (instructions) on the timeline page if the "store statistics" setting is disabled | 56f4d43
- **UX**: Show the error message if URL download fails | 9ecdf7d
- **UX**: The app will now handle all unsupported characters in the file names | ef1f469
- **Dev**: Upgrade dependencies | 084cf48, acfb92c
- **Dev / UX**: refactor shortcuts dialog UI and code | f94d661
- **Dev / UX**: refactor quickView window code | 0a354b9
- **Dev**: Small improvements and fixes in the code

## Fixed:

- **UI**: Fixed: noticeable UI shifting when opening the settings page | 748b33d
- **UI**: Fixed: tooltip animations were not working as intended | 876769d
- **UX**: Fixed: the app was creating multiple instances when it was re-opened from taskbar / desktop / start menu icon | Fixes #7 | 50643ef
- **UX**: Fixed: directories containing read-only items were not loading on the 1st time they were opened | ace9953
- **UX**: Fixed: auto updater was not working in 1.1.0 | 3120880
- **UX**: Fixed: auto updater was not checking for updates | 35dfacc
- **UX**: Fixed: image thumbnail generator stops working when it encounters an unsupported file type | d3a9bc7
- **UX**: Fixed: filter was not working on the "notes" page | 9241bd4
- **UX**: Fixed: file downloading was not working in "selective drop" mode | a711a1e
- **UX**: Fixed: URL downloading was not working at all | c40e9de
- **UX**: Fixed: "UI scaling" setting not being saved to storage | Fixes #103 | 01a90a0
- **UX**: Fixed: "home banner visibility" setting not being saved to storage | Fixes #76 | 73cdc75
- **UX**: Fixed: notifications with updating content couldn't be hidden | 4fb9b3e
- **UX**: `Mac, Linux`: Fixed: navigating directories via address bar breaks navigator | 0947dee
- **UX**: `Mac, Linux`: Fixed: updater couldn't check / download updates from within the app | b2afc2e

## Notes

- Linux and MacOS builds are still quite broken. Some features don't work as expected. The issues will be gradually fixed in future updates.

## Supporters

💗 This release was made possible by my Patreon supporters.
They are the reason free, open-source software can exist.
Show them some love, check out their work:

#### GENEROUS SUPPORTERS
<table>
  <tbody>
    <tr>
      <td align="center" valign="middle">
        <a href="https://www.photoancestry.com/" title="Houston Photo Restoration">
          <img width="80px" height="80px" src="https://www.photoancestry.com/images/photo-restoration-houston.png">
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://www.photoancestry.com/" title="Houston Photo Restoration">Houston Photo Restoration</a>
      </td>
    </tr>
  </tbody>
</table>

See the full list of rewards, and consider join our community on Patreon to help me fund the development of this project:

<a target="_blank" href="https://patreon.com/sigma_file_manager">
  <img
    src="https://github.com/aleksey-hoffman/sigma-file-manager/raw/main/.github/media/patreon_button.png"
    width="164px"
  />
</a>


## v1.1.0 (2021-05-27)

# Release Notes for v1.1.0:

⚠**Warning:** the app is in early development stage, use with caution! Before using the app, it's recommended, to copy important files to your cloud storage or an external drive in case something goes wrong. Try not to use it for working with important files, until it's thoroughly tested.

## Milestones:

🔼 **by v2.0.0 (Oct 2021):** (1/20) Add 20 more new major features

## New major features:
- **Quick view:** this feature allows you to quickly open selected files in a preview window, rather than an external program (which usually takes longer). Quick view can be opened with `Space` shortcut or from the context menu. Supported: images, videos, audio, PDF, most plain text formats. [939d95c](https://github.com/aleksey-hoffman/sigma-file-manager/commit/939d95c40f9fc461df159d45c45edc524ae79257)

## New minor features:
- Option to open directory items with single click [08d4dce](https://github.com/aleksey-hoffman/sigma-file-manager/commit/08d4dcef171cafce26c3a6d5dacad92920890154)

## Fixed

- Fixed "Device not ready" error (thanks to @btglr). [#29](https://github.com/aleksey-hoffman/sigma-file-manager/pull/29)
- Fixed MacOS build problem (thanks to @mattm-malone). [#26](https://github.com/aleksey-hoffman/sigma-file-manager/pull/26)
- Fixed the issue with thumbnail generation caused by unsupported image types. [9afcf3a](https://github.com/aleksey-hoffman/sigma-file-manager/commit/9afcf3a993e5228a88f14dac0f3b85a504714423)
- Fixed the issue with some processes running after `app.quit()` event [ce18e91](https://github.com/aleksey-hoffman/sigma-file-manager/commit/ce18e9134617abc198eaf0570186b1e308e21c7b
- Fixed the issue with dir-item-rename notification displaying information in wrong order. [c808341](https://github.com/aleksey-hoffman/sigma-file-manager/commit/c808341b079d864e42f7c6fa67227f5b05b1a8d5)
- Fixed the issue with navigator operation "move item" which was copying items instead [d1c3019](https://github.com/aleksey-hoffman/sigma-file-manager/commit/d1c30197fe73bf49b2b63c84ccee8cd043e808a1)
- Fixed the issue with navigator operation "move item" not working for directories (progress bar is temporarily removed from the item transfer notifications) [7580fb8](https://github.com/aleksey-hoffman/sigma-file-manager/commit/7580fb874b041fb4b3a955ec1eee7d679aab39f6)
- Fixed shortcuts that weren't working [7b5fb51](https://github.com/aleksey-hoffman/sigma-file-manager/commit/7b5fb5110b0ae2cf6dda08a332772cdc6e2c6091)
- Fixed the issue with navigator item range selection not being triggered when `Shift` is pressed before the first item was selected [e620976](https://github.com/aleksey-hoffman/sigma-file-manager/commit/e620976ced100c756c51ba8e4a0216f10b390993)

## Other improvements
- Added "navigator tips" guide [c4d4df6](https://github.com/aleksey-hoffman/sigma-file-manager/commit/c4d4df633ca91166961fdf9648ff8e1f7cd32f7c)
- Added ability to navigate directory horizontally from keyboard (grid layout) [cdde373](https://github.com/aleksey-hoffman/sigma-file-manager/commit/cdde3734a1ff20d878ceb44a8d29e0507c71fcfb)

## Notes

- The Linux and MacOS builds are still quite broken. Some features don't work as expected. The issues will be fixed in future updates

## Support

Consider supporting this project.
You can see the full list of rewards, and join our community on Patreon:


<a target="_blank" href="https://patreon.com/sigma_file_manager">
  <img
    src="https://github.com/aleksey-hoffman/sigma-file-manager/raw/main/.github/media/patreon_button.png"
    width="164px"
  />
</a>
