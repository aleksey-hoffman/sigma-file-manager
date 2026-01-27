# Changelog

All notable changes to Sigma File Manager v2 will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0-alpha.5] - January 2025

File operations, global search, and shortcut customization.

### Global Search

Powerful full-disk search that indexes and searches files across all your drives. Features fuzzy matching to find files even with typos, automatic periodic re-indexing, priority indexing for frequently used directories, and optional parallel scanning for faster indexing.

![Global Search](/changelog/alpha-5-search.png)

### File Operations

Full file operation support with copy, move, and delete functionality including progress tracking. Also includes in-place file and folder renaming.

### Shortcut Editor

Customize all keyboard shortcuts in the app. View current bindings, detect conflicts, and reset to defaults.

### Navigator Enhancements

Added option to display native system icons for files and directories instead of minimalistic glyphs. Settings navigation tabs now stick to the page when scrolling.

---

## [2.0.0-alpha.4] - January 2025

Home page, visual effects, and user customization options.

### Home Page

A beautiful home page featuring an animated media banner with artist credits, visual drive cards with space indicators, and quick access to common user directories like Documents, Downloads, Pictures, and more.

### Visual Effects

Customizable visual effects section in settings that adds blur, opacity, and noise effects to the app background. Supports different settings for each page.

### User Directories Editor

Customize your user directory cards with custom titles, icons, and paths. Personalize how your quick access directories appear on the home page.

### Banner Position Editor

Fine-tune the position of your home page banner backgrounds. Adjust zoom, horizontal and vertical positioning for the perfect look.

### Settings Improvements

Settings search now works in any language, not just the current one. The app will restore the last visited settings tab on reload instead of opening the first one every time.

---

## [2.0.0-alpha.3] - December 2024

Navigator view with tabs, workspaces, and a new design system.

### Navigator View

The core file browsing experience with a modern tab system supporting workspaces, a new window toolbar design with integrated controls, and dual-pane navigation for efficient file management.

### Video Thumbnails

Added preview thumbnails for video files in the navigator.

### Design System Migration

Migrated the app from Vuetify to Sigma-UI for a more spacious, modern design with improved code quality.

---

## [2.0.0-alpha.1] - December 2024

Complete rewrite using modern technologies.

### Tauri Migration

Sigma File Manager v2 has been rebuilt from the ground up using Vue 3 Composition API, TypeScript, and Tauri v2. App installation size reduced from 153 MB to just 4 MB on Windows. Installed app size reduced from 419 MB to 12 MB.

### Resizable Panes

Added resizable panes feature which lets you split the navigator view in half and work with 2 directories side by side.

### Initial Features

Basic file navigation with directory listing, window management with minimize, maximize, and close controls, and an initial settings page structure.
