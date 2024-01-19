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


# Supporters

Consider supporting the project on Patreon:

<a target="_blank" href="https://patreon.com/sigma_file_manager">
  <img
    src="https://raw.githubusercontent.com/aleksey-hoffman/sigma-file-manager/main/.github/media/patreon_button.png"
    width="164px"
  />
</a>
<br>
<a target="_blank" href="https://github.com/aleksey-hoffman/sigma-file-manager/wiki/Support-and-rewards">
  See other methods
</a>

### Sponsor

<table>
  <tbody>
    <tr>
      <td>
          <a href="https://hover.com/UywpvNe0" target="_blank">
            <img width="128px" align="center" src="https://github.com/aleksey-hoffman/sigma-file-manager/raw/main/.github/media/hover-logo-svg-vector.svg">
          </a>
      </td>
      <td>
        Hover is a popular service where you buy domain names for your website. 
        <br>I've been using it personally and can recommend it.
        <br>Use my Hover link, and we'll both get $2 off their domains: https://hover.com/UywpvNe0
      </td>
    </tr>
  </tbody>
</table>

### Level-4 supporter

<table>
  <tbody>
    <tr>
       <td align="center" valign="middle">
        <a href="https://www.photoancestry.com/" title="Houston Photo Restoration">
          <img width="128px" src="https://www.photoancestry.com/images/fpbanner_poster_.png">
        </a>
      </td>
      <td>
       <a href="https://www.photoancestry.com/" title="Houston Photo Restoration">photoancestry.com</a>
       <p>Houston's #1 Photo Restoration Service</p>
      </td>
    </tr>
  </tbody>
</table>

### Level-3 supporter

<table>
  <tbody>
    <tr>
      <td align="center" valign="middle">
        <a href="https://github.com/andyundso" title="Andy Pfister">
          <img valign="middle" width="48px" src="https://avatars.githubusercontent.com/u/7010698?v=4">
          Andy Pfister
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://github.com/exploitacious" title="Alex Ivantsov">
          <img valign="middle" width="48px" src="https://avatars.githubusercontent.com/u/75740078?v=4">
          Alex Ivantsov
        </a>
      </td>
    </tr>
  </tbody>
</table>

<br>

<h4 style="margin: 32px 0px;">
  <a target="_blank" href="https://github.com/aleksey-hoffman/sigma-file-manager/blob/main/BAKERS.md">See the full list of supporters →</a>
</h4>

The funding will be used for funding the development of this and my other big projects. I'm also working in collaboration with a few universities on a project that will help scientists speed up development of new medications and treatments for diseases, reducing the time need to find a new medication from 10 years (current average) to just a few months, and hopefully help humanity get rid of diseases (the project will be open-sourced later);

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
