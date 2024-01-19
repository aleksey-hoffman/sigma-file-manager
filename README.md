> [!NOTE]
>
> [Sigma File Manager:](https://github.com/aleksey-hoffman/sigma-file-manager) development is paused<br>
> [Sigma File Manager v2.0 (current page):](https://github.com/aleksey-hoffman/sigma-file-manager/tree/v2) development is active

<h1>
  <img valign="middle" src="https://github.com/aleksey-hoffman/sigma-file-manager/raw/main/.github/media/logo-1024x1024.png" width="64px">
  &nbsp;&nbsp;Sigma File Manager v2
</h1>

"Sigma File Manager" is a free, open-source, quickly evolving, modern file manager (explorer / finder) app for Windows and Linux.

Designed, developed, and maintained by [Aleksey Hoffman](https://github.com/aleksey-hoffman)

Community links: [Reddit](https://www.reddit.com/r/SigmaFileManager) | [YouTube](https://www.youtube.com/@sigma-dev) | [X (Twitter)](https://twitter.com/sigma__dev) | [Telegram](https://t.me/sigma_devs)
<br>Thanks to everyone who has been sharing this project with others!

<img src="./.github/media/main.png">

## Download

[See releases](https://github.com/aleksey-hoffman/sigma-file-manager/releases)

## For developers

### Setup the project locally

1. Switch to `Node v20` or newer
2. Clone the project
3. Change branch to v2
```
cd sigma-file-manager && checkout v2
```
4. Install dependencies:
```
npm i
```
5. Install Rust and other required libs. Then relaunch the terminal if needed. Instructions:

- [For Windows](https://tauri.app/v1/guides/getting-started/prerequisites/#setting-up-windows)
- [For Linux](https://tauri.app/v1/guides/getting-started/prerequisites/#setting-up-linux)
- [For MacOS](https://tauri.app/v1/guides/getting-started/prerequisites/#setting-up-macos)

### Run the app

#### Dev

```
npm run tauri:dev
```

Or the following, if you see any visual issues on Linux

```
npm run tauri:dev:webkit-igpu
```

#### Create build

```
npm run tauri:build
```

## Known issues

### Linux

When running on proprietary Nvidia (or unsupported) drivers, you may encounter different visual issues.

To run the AppImage build on a Linux system with unsupported drivers, run the app with the compositing flag, for example:

```
env WEBKIT_DISABLE_COMPOSITING_MODE=1 ./sigma-file-manager-v2_2.0.0-alpha.1_amd64.AppImage
```
