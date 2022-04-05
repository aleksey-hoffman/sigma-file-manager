# CHANGELOG

# Release Notes: v1.4.0 (2021-09-04)

This release improves resource usage, brings a few new features, and a lot of fixes:

- 1 new major feature
- 1 new minor feature
- 18 improvements
- 7 fixes

##  Milestones
🔼 **by v2.0.0 (December 2021) | (Goal: 3 of 20):** Add 20 more new major features

## Download
You can find the download link for your system in the **Asset** section below.

This release contains only Windows build. MacOS and Linux builds will be added in v1.5 update (in a few days).

## New major features
- 574787c: **Feature**: added support for cloud drives (OneDrive, Google Drive, etc.).

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


## v1.2.0 (2021-06-23)

# Release Notes for v1.2.0:

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
    src="https://github.com/aleksey-hoffman/sigma-file-manager/blob/main/.github/media/patreon_button.png"
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
    src="https://github.com/aleksey-hoffman/sigma-file-manager/blob/main/.github/media/patreon_button.png"
    width="164px"
  />
</a>
