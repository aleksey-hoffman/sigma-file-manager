# Changelog

## [2.0.0-beta.3] - April 2026

**Summary:** Extensions system with marketplace, LAN file sharing, quick access menu, zip archives, WSL drives, tag editing, enhanced quick view and search, visual effects improvements, and many UX and stability improvements.

- [New Features](#new-features)
  - [Extensions System](#extensions-system)
  - [Default file manager](#default-file-manager)
  - [LAN Sharing](#lan-sharing)
  - [Quick Access Menu](#quick-access-menu)
  - [Zip Archives](#zip-archives)
  - [WSL Drives Detection](#wsl-drives-detection)
  - [Tag Editing](#tag-editing)
  - [In-App Updates](#in-app-updates)
  - [Copy Path](#copy-path)
  - [Close Duplicate Tabs](#close-duplicate-tabs)
  - [Home & Dashboard Context Menus](#home--dashboard-context-menus)
  - [Visual Effects Mix Blend Mode](#visual-effects-mix-blend-mode)
- [New Settings](#new-settings)
- [New Shortcuts](#new-shortcuts)
- [New Languages](#new-languages)
- [UX Improvements](#ux-improvements)
  - [Quick View Enhancements](#quick-view-enhancements)
  - [Quick Search Enhancements](#quick-search-enhancements)
  - [File Operations](#file-operations)
  - [Visual Effects](#visual-effects)
- [UI Improvements](#ui-improvements)
- [Bug Fixes](#bug-fixes)

### New Features

#### Extensions System

Full extension system with open marketplace.

- **Marketplace**: browse, install, and manage extensions from the marketplace;
- **Local installation**: you can install extensions from local folder;
- **Command palette**: new way to activate app and extension commands;
- **Capabilities**: extensions can register local and global shortcuts, context menu items, settings, whole pages, and commands;
- **Versioning**: you can install different versions of extensions and enable auto update;
- **Localization**: extensions can provide translations for different langauges;
- **Binary management**: extensions can use binaries (ffmpeg, deno, node, yt-dlp, 7z, and any other existing binary);
- **Sandboxed execution**: extensions run in isolated ESM sandboxes with granular permissions;

![extensions-1](./public/changelog/assets/beta-3/extensions.jpg)

#### Default file manager

You can now make SFM the default file manager on Windows (`Settings > Experimental`). When this setting is enabled, most system file actions will be routed to SFM:

- File Explorer app icon;
- `Ctrl+E` shortcut;
- Reveal file in folder;
- Show downloads (when you download a file in browser);
- Terminal commands: "start {path}", "code {path}", etc.
- And more;

Native system views like "Recycle Bin", "Control panel", and such deeply integrated programs are delegated back to native File Explorer. 

#### LAN Sharing

Share and stream files and directories over your local network directly from the app.

Access LAN sharing from the toolbar button in the navigator or from the context menu on any file or directory. When a share is active, a QR code and shareable URLs are displayed. Two modes are available:

- **Stream**: stream files and directories to any device on your network via a web browser;
- **FTP**: share files over FTP for direct access from other apps. You can both download and upload files from and to the computer from other device;

![lan-sharing](./public/changelog/assets/beta-3/lan-sharing.jpg)

#### Quick Access Menu

The "Dashboard" button in the sidebar now acts as a quick access menu. Hovering over it opens a panel showing your Favorites and Tagged items.

All items in the panel are real directory entries - you can drag and drop items in and out, open context menus with right click, and perform any standard file operations.

Can be disabled in `Settings > UI appearance > Open quick access panel on hover`.

![quick-access.jpg](./public/changelog/assets/beta-3/quick-access.jpg)

#### Zip Archives

Compress and extract zip archives directly from the file browser actions menu:

- **Extract**: extract a `.zip` file to the current directory or to a named folder;
- **Compress**: compress selected files and directories into a `.zip` archive;

![archiver.jpg](./public/changelog/assets/beta-3/archiver.jpg)

#### WSL Drives Detection

On Windows, the app now automatically detects installed WSL distributions and displays their drives in the navigator, allowing you to browse WSL file systems natively.

![wsl.jpg](./public/changelog/assets/beta-3/wsl.jpg)

#### Tag Editing

You can now edit tag names and colors. Open the tag selector on any file or directory to rename tags, change their color, or delete them.

![tag-editor.jpg](./public/changelog/assets/beta-3/tag-editor.jpg)

#### In-App Updates

You can now download and install updates directly from the update notification without leaving the app.

#### Copy Path

Added "Copy path" option to the file and directory context menu.

#### Close Duplicate Tabs

Added the ability to close duplicate tabs from the tab bar, removing all tabs that point to the same directory.

#### Home & Dashboard Context Menus

Items on the home page and dashboard now have full context menus, matching the functionality available in the navigator.

### New Settings

- **Show home media banner**: show or hide the home page media banner (`Settings > UI appearance > Home page media banner`);
- **Tooltip delay**: configure the delay before tooltips appear (`Settings > UI appearance > Tooltips`);
- **Relative time**: display recent timestamps in relative format, e.g. "5 min ago" (`Settings > General > Date / time`);
- **Date and time format**: configure month format, regional format, 12-hour clock, seconds, and milliseconds (`Settings > General > Date / time`);
- **Dialog backdrop blur**: set the blur intensity for dialog backdrops (`Settings > UI appearance > Style settings`);
- **Brightness and contrast filters**: adjust brightness and contrast style filters for the app UI (`Settings > UI appearance > Style settings`);
- **Overlay media brightness**: adjust brightness of the visual effects overlay media (`Settings > UI appearance > Visual effects`);
- **Visual Effects Mix Blend Mode**: adjust mix blend mode for visual effects, letting you choose how background media blends with the app UI (`Settings > UI appearance > Visual effects`);
- **Pause background video**: pause the home banner and background video when the app is idle or minimized (`Settings > UI appearance > Visual effects`);
- **Default file manager**: set Sigma File Manager as the default file explorer on Windows (`Settings > Experimental`);
- **Launch on system login**: automatically launch the app when you log into your system (`Settings > General > Startup behavior`);

### New Shortcuts

- **Copy current directory path** (`Ctrl+Shift+C`): copy the current directory path to clipboard;
- **Reload current directory** (`F5`): refresh the navigator file list;
- **Zoom in / out** (`Ctrl+=` / `Ctrl+-`): increase or decrease UI zoom;
- **Fullscreen** (`F11`): toggle full screen mode;

### New Languages

- **Hindi**;
- **Urdu**;

### UX Improvements

#### Quick View Enhancements

- **Media navigation**: navigate between files in the current directory without closing quick view;
- **Text file preview**: improved text file preview with proper encoding detection, inline editing, and parsed markdown rendering;

![quick-view.jpg](./public/changelog/assets/beta-3/quick-view.jpg)

#### Quick Search Enhancements

- **All properties**: search by any file property - name, size, item count, modified, created, accessed, path, or MIME type (e.g. `modified: today`, `mime: image`);
- **Size ranges**: filter by size using comparisons and ranges (e.g. `size: >=2mb`, `size: 1mb..10mb`);

![quick-search.jpg](./public/changelog/assets/beta-3/quick-search.jpg)

#### File Operations

- **Conflict resolution safety**: improved file safety within the conflict resolution modal to prevent accidental data loss;
- **Single-use paste**: copied items can only be pasted once, preventing accidental duplicate pastes;
- **Copy text**: allow copying UI text with `Ctrl+C` when no files are selected;

#### Visual Effects

- **Background manager**: added background manager to the settings page for centralized background customization;
- **Background effects reset**: added a reset button to background effects settings;

#### Other

- **App size reduction**: reduced app bundle size from 32 MB to 12 MB;
- **Global search**: display a "show settings" button in empty state and increased default search depth;
- **Windows shortcuts**: `.lnk` files now open their target in the navigator instead of launching externally;
- **Dashboard**: improved tagged section layout;
- **Address bar context menu**: added context menu to address bar items;
- **Navigator context menu**: show context menu when clicking empty area in the navigator;
- **Open in new tab**: open directories in a new tab with middle mouse click;
- **Tab scroll**: scroll newly added tabs into view automatically;
- **Menu focus**: menus no longer return focus to their trigger button when closed with a click outside;
- **Close search**: close global search with `Escape`;
- **Faster launch**: slightly improved app launch speed by preloading settings in Rust;
- **User directories**: added ability to add and remove user directories on the home page;
- **List limits**: decreased limits for frequent and history list entries to improve performance;

### UI Improvements

- **Toolbar icons**: unified toolbar icon colors across the app;
- **Card animations**: added stagger and fade-in effects to cards;
- **Light theme**: improved light theme colors and contrast;
- **Launch stability**: improved visual stability during app launch to reduce flickering;
- **Notifications**: improved notification design for better consistency;
- **Tab auto-scroll**: auto scroll the selected tab into view when opening the navigator page;
- **Root path labels**: normalized root path labels across tabs and info panel;
- **Translations**: improved translations across the app;

### Bug Fixes

- Fixed copying or moving many items freezing the UI; added file operation progress to the status center;
- Fixed deleting many items freezing the UI; added deletion progress to the status center;
- Fixed context menu in grid layout not opening for the current directory when another item already has a menu open;
- Fixed info panel not displaying all information for the current directory;
- Fixed app shortcuts being registered on the quick view window instead of only the main window;
- Fixed files dragged from web browsers not being handled;
- Fixed filenames from external URL drops not keeping valid segments;
- Fixed home banner being draggable;
- Fixed system icon cache not being keyed by file path, causing incorrect icons;
- Fixed inaccessible Windows root entries showing in the navigator;
- Fixed custom shortcuts being unidentified on some keyboard layouts;
- Fixed SSHFS connections on Linux;
- Fixed address bar creating duplicate history entries on breadcrumb click;
- Fixed global search results not responding to keyboard navigation;
- Fixed global search results not opening on click;
- Fixed global search status not syncing after incremental indexing;
- Fixed outbound file drag-and-drop not working in some applications;
- Fixed inconsistent shortcut badge design across the app;
- Fixed navigator column visibility in narrow panes;

---

## [2.0.0-beta.2] - February 2026

**Summary:** Global shortcuts, new settings, new features, improved file filtering, improved address bar, home banner improvements, and bug fixes.

### Global Shortcuts

You can now use keyboard shortcuts to interact with the app even when it's not in focus.

Added shortcuts:

- `Win+Shift+E` to show and focus the app window;

### New settings

Added setting to choose what happens when the last tab is closed.

![Setting close last tab](./public/changelog/assets/beta-2/setting-close-last-tab.png)

### New features

Added new early preview features:

- Network locations: allows you to connect a network location (SSHFS (SSH) / NFS / SMB / CIFS);
- [Linux] Drive mounting: allows you to unmount locations;

### File Filter

The file filter was improved:
- Now when you change directory, it clears and closes automatically;
- The "filter on type" feature activates in the selected pane, not the first one; 

### Address Bar

- Improved design and autocomplete logic;
- The path dividers are now dropdown menus that provide quick navigation to any parent directory;

![Divider menus](./public/changelog/assets/beta-2/divider-menus.png)

### Home Banner / Background effects

- Improved media banner editor design: 
  - Media banner options menu now opens to the bottom to avoid obscuring the view; 
  - You can now click outside to close the background position editor;
  - URL input moved above custom backgrounds; 
- Custom images/videos can be used in background visual effects;
- Removed some default media banner images;
- Added new banner image "Exile by Aleksey Hoffman";

### UX Improvements

- App restores previous window position on launch;
- The current tab can now be closed with shortcut `Ctrl+W` or middle mouse click;
- Increased file icon size in grid layout view;

### Bug Fixes

- Fixed moving files between tabs sometimes moving them to the wrong location;
- Fixed navigator sometimes showing wrong system icons for directories;
- Fixed multiple app and tray instances being created;
- Fixed shell extensions menu refetching data periodically which was forcing the list to scroll top all the time;

## [2.0.0-beta.1] - February 2026

**Summary:** Major usability and design improvements including keyboard navigation, new shortcuts, open in terminal, directory auto-refresh, drag and drop, and enhanced search and list views.

### Keyboard Navigation

Navigate files using the keyboard with full support for grid and list layouts and split view.

- Arrow keys for spatial navigation in grid view and sequential navigation in list view;
- Enter to open selected directory or file, Backspace to navigate back;
- Ctrl+Left / Ctrl+Right to switch focus between split view panes;
- Ctrl+T to open the current directory in a new tab;
- All navigation shortcuts are customizable in Settings > Shortcuts;

### Directory Auto-Refresh

The navigator view automatically refreshes when files are created, deleted, renamed, or modified in the current directory.

- File sizes update automatically when changed by external applications;
- Efficient file system watching with debouncing to avoid excessive refreshes;
- Smart diff-based updates only change affected items, preserving scroll position and selection;

### Drag and Drop

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/beta-1/drag-and-drop.mp4"></video>

You can now drag files and folders around to copy/move them with ease. Drag between panes, from or to search results lists, from or to external apps.

### Copy conflicts

Added modal window for easy copy/move conflict resolution.

### Auto Update

Added automatic checking for updates (can be controlled from settings).

### Home Banner Media Editor

Added editor for home page banner customization. You can now upload custom images and videos (both local and remote URL files are supported) 

### List View Enhancements

- Improved design and fixed little annoyances;
- Added column visibility customization: choose which columns to display;
- Added column sorting: click column headers to sort entries;
- Default navigator layout changed to list view;

### Global Search Improvements

- Updated layout and design with drag and drop support;
- Search is now available while drives are still being indexed;

### Open in Terminal

Open directories in your preferred terminal directly from the context menu.

- Automatic detection of installed terminals on Windows, macOS, and Linux;
- Windows Terminal shows all configured shell profiles with executable icons;
- Linux default terminal auto-detected and shown first;
- Includes normal and admin/elevated modes;
- Default shortcut: Alt+T;

### Localization

- Added Slovenian language (thanks to: @anderlli0053);

### UI / UX Improvements

- Added font selector: choose UI font from installed system fonts;
- Added "Create new" menu for quickly creating files or directories;
- Showing empty state view when navigating to empty directories;
- Status bar shows total items with hidden count when list is filtered;
- Newly created, copied, and moved items auto-scroll into view;
- Clipboard toolbar displayed once below panes instead of in each pane;
- Simplified rename modal design;
- Responsive toolbar icons that collapse into dropdown on small window sizes;
- Removed empty "Navigation" tab from settings;
- Renaming a directory now updates its path across all tabs, workspaces, favorites, tags, history, and frequent items;
- Deleting a file or directory now removes it from all stored lists and navigates affected tabs to home;
- Non-existent paths in favorites, tags, history, and frequent items are now auto-cleaned on startup;

### Bug Fixes

- Fixed global search indexing status not updating in real-time;
- Fixed split view pane not updating when its directory is deleted or renamed from the other pane;
- Fixed tabs loading with an error when their stored path no longer exists;
- Fixed system icons showing the same icon for all files of the same type instead of unique per-file icons;
- Fixed keyboard shortcuts not working in the second pane of split view;
- Fixed keyboard shortcuts stopping to work after page navigation;
- Fixed memory leak with filter keydown listeners not cleaned up on unmount;
- Linux: added support for default app retrieval in "open with" menu;

---

## [2.0.0-alpha.6] - January 2026

**Summary:** What's New window, Quick View, context menu enhancements, and new settings.

### What's New window

A changelog window that shows new features and improvements for each release.

- Automatically appears after updates (can be disabled);
- Browse through all releases;
- See detailed descriptions and screenshots for each feature;

### Quick View

Preview files without fully opening them using a lightweight preview window.

- Press `Space` or "Quick view" option in the context menu to quickly view files;
- Close instantly with `Space` or `Escape`.
- Supports images, videos, audio, text files, PDFs, and more;

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/alpha-6/quick-view.mp4"></video>

### Directory Size Calculation

- The size of directories is now auto calculated;
- You can see the total size of all directories, including all subdirectories and files, as soon as you open any directory;

![Open With](./public/changelog/assets/alpha-6/size.png)

### New Context Menu Options

#### Open With

- Choose which application to open a file with;
- Setup custom presets to open files in applications with flags;
- View all compatible applications for any file type;
- Set default applications for specific file types;

![Open With](./public/changelog/assets/alpha-6/open-with.png)

#### Shell Extensions

- Access Windows shell context menu items;
- Access third-party shell extensions (7-Zip, Git, etc.);

![Shell Extensions](./public/changelog/assets/alpha-6/shell-extensions.png)

### New Settings

#### Drive Detection

- Focuses the app when removable drives are connected (can be disabled);
- Control Windows Explorer auto-open behavior for removable drives;

#### Filter on Typing

Start typing anywhere in the navigator to instantly filter items in the current directory;

#### Settings Search Shortcut

New keyboard shortcut for quick access to settings search;

#### User Statistics Data

- Added statistics settings section;
- On dahsboard page you can see, navigate, clear history, favorites, and frequently used items;

### Search Improvements

Improved global search with a hybrid indexed + direct search system for more reliable and up-to-date results.

- Searches now consistently take less than 1 second (~1 TB fully filled drive), no matter where the files are on your drives; 
- When you search your "priority paths" (the ones that you open often), you get results instantly and it finds the files even if they were just created and weren't indexed yet.

#### Priority paths include: 
- User directories: Downloads, Documents, Desktop, Pictures, Videos, Music;
- Favorites;
- Recently opened;
- Frequently used;
- Tagged;

---

## [2.0.0-alpha.5] - January 2026

**Summary:** File operations, global search, and shortcut customization.

### Global Search

Powerful full-disk search that indexes and searches files across all your drives. Features fuzzy matching to find files even with typos, automatic periodic re-indexing, priority indexing for frequently used directories, and optional parallel scanning for faster indexing.

![Global Search](./public/changelog/assets/alpha-5/search.png)

### File Operations

Full file operation support with copy, move, and delete functionality including progress tracking. Also includes in-place file and folder renaming.

### Shortcut Editor

Customize all keyboard shortcuts in the app. View current bindings, detect conflicts, and reset to defaults.

### Navigator Enhancements

Added option to display native system icons for files and directories instead of minimalistic glyphs. Settings navigation tabs now stick to the page when scrolling.

---

## [2.0.0-alpha.4] - January 2026

**Summary:** Home page, visual effects, and user customization options.

### Home Page

A beautiful home page featuring an animated media banner, drive list, and quick access to common user directories like Documents, Downloads, Pictures, and more.

### Visual Effects

Customizable visual effects section in settings that adds blur, opacity, and noise effects to the app background. Supports different settings for each page.

### User Directories Editor

Customize your user directory cards with custom titles, icons, and paths. Personalize how your quick access directories appear on the home page.

### Banner Position Editor

Fine-tune the position of your home page banner backgrounds. Adjust zoom, horizontal and vertical positioning for the perfect look.

### Settings Improvements

- Settings search now works in any language, not just the current one;
- The app will restore the last visited settings tab on reload instead of opening the first one every time;

---

## [2.0.0-alpha.3] - December 2025

**Summary:** Navigator view with tabs, workspaces, and a new design system.

### Navigator View

The core file browsing experience with a modern tab system supporting workspaces, a new window toolbar design with integrated controls, and dual-pane navigation for efficient file management.

### Video Thumbnails

Added preview thumbnails for video files in the navigator.

### Design System Migration

Migrated the app from Vuetify to Sigma-UI for a more spacious, modern design with improved code quality.

---

## [2.0.0-alpha.1] - January 2024

**Summary:** Complete rewrite using modern technologies.

### Tauri Migration

Sigma File Manager v2 has been rebuilt from the ground up using Vue 3 Composition API, TypeScript, and Tauri v2. App installation size reduced from 153 MB to just 4 MB on Windows. Installed app size reduced from 419 MB to 12 MB.

### Resizable Panes

Added resizable panes feature which lets you split the navigator view in half and work with 2 directories side by side.

### Initial Features

Basic file navigation with directory listing, window management with minimize, maximize, and close controls, and an initial settings page structure.
