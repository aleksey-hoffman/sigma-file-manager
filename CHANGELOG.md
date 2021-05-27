# CHANGELOG

## v1.1.0 (2021-27-05)

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
