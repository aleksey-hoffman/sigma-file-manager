// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// TODO: 
// resolve names of system directories automatically 
// so they would work in all system locales:
// On windwos they have short names:
// WALLPA~1 - Wallpapers
// SCREEN~1 - Screenshots

const PATH = require('path')
const electron = require('electron')

const electronRemote = process.type === 'browser'
  ? electron
  : require('@electron/remote')

const userData = electronRemote.app.getPath('userData')
const home = electronRemote.app.getPath('home')
const desktop = electronRemote.app.getPath('desktop')
const downloads = electronRemote.app.getPath('downloads')
const documents = electronRemote.app.getPath('documents')
const pictures = electronRemote.app.getPath('pictures')
const screenshots = PATH.join(pictures, 'Screenshots')
const videos = electronRemote.app.getPath('videos')
const music = electronRemote.app.getPath('music')

const userDataRoot = PATH.parse(userData).root.replace(/\\/g, '/')
const resources = process.env.NODE_ENV === 'production'
  ? `${process.resourcesPath}/app.asar/resources`
  : PATH.join(__static, 'resources')
const bin = PATH.join(resources, process.platform, 'bin')
const appStorage = PATH.join(userData, 'app storage')
const appStorageMedia = PATH.join(appStorage, 'media')
const homeBannerMedia = PATH.join(resources, 'media', 'home banner')
const appStorageBin = PATH.join(appStorage, 'bin')
const appStorageHomeBannerMedia = PATH.join(appStorage, 'media', 'home banner')
const appStorageNotesMedia = PATH.join(appStorage, 'media', 'notes')
const appStorageGlobalSearchData = PATH.join(appStorage, 'search data')
const appStorageNavigatorThumbs = PATH.join(appStorage, 'media', 'thumbnails')

const FFMPEG = PATH.join(appStorageBin, 'ffmpeg', 'bin')
const youtubeDl = PATH.join(appStorageBin, 'youtube-dl')
const sevenZip = PATH.join(appStorageBin, '7-zip')

let systemDirs
let bin7Zip
let binYoutubeDl

if (process.platform === 'win32') {
  bin7Zip = PATH.join(sevenZip, '7za.exe')
  binYoutubeDl = PATH.join(youtubeDl, 'youtube-dl.exe')
  systemDirs = [
    { name: 'Home directory', icon: 'mdi-folder-account-outline', path: home },
    { name: 'Desktop', icon: 'mdi-aspect-ratio', path: desktop },
    { name: 'Downloads', icon: 'mdi-download', path: downloads },
    { name: 'Documents', icon: 'mdi-text-box-multiple-outline', path: documents },
    { name: 'Screenshots', icon: 'mdi-image-size-select-large', path: screenshots },
    { name: 'Pictures', icon: 'mdi-image-multiple-outline', path: pictures },
    { name: 'Videos', icon: 'mdi-play-circle-outline', path: videos },
    { name: 'Music', icon: 'mdi-music', path: music }
  ]
}
else if (process.platform === 'linux') {
  bin7Zip = PATH.join(sevenZip, '7zz')
  binYoutubeDl = PATH.join(youtubeDl, 'youtube-dl')
  systemDirs = [
    { name: 'Home directory', icon: 'mdi-folder-account-outline', path: home },
    { name: 'Desktop', icon: 'mdi-aspect-ratio', path: desktop },
    { name: 'Downloads', icon: 'mdi-download', path: downloads },
    { name: 'Documents', icon: 'mdi-text-box-multiple-outline', path: documents },
    { name: 'Pictures', icon: 'mdi-image-multiple-outline', path: pictures },
    { name: 'Videos', icon: 'mdi-play-circle-outline', path: videos },
    { name: 'Music', icon: 'mdi-music', path: music }
  ]
}
else if (process.platform === 'darwin') {
  bin7Zip = PATH.join(sevenZip, '7zz')
  binYoutubeDl = PATH.join(youtubeDl, 'youtube-dl')
  systemDirs = [
    { name: 'Home directory', icon: 'mdi-folder-account-outline', path: home },
    { name: 'Desktop', icon: 'mdi-aspect-ratio', path: desktop },
    { name: 'Downloads', icon: 'mdi-download', path: downloads },
    { name: 'Documents', icon: 'mdi-text-box-multiple-outline', path: documents },
    { name: 'Pictures', icon: 'mdi-image-multiple-outline', path: pictures },
    { name: 'Videos', icon: 'mdi-play-circle-outline', path: videos },
    { name: 'Music', icon: 'mdi-music', path: music }
  ]
}

const binCompressed = PATH.join(bin, 'compressed.zip')
const binFFMPEG = PATH.join(FFMPEG, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
const binFFPROBE = PATH.join(FFMPEG, process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe')

const storageFiles = {
  settings: {
    fileName: 'settings.json',
    defaultData: {}
  },
  pinned: {
    fileName: 'pinned.json',
    defaultData: {}
  },
  protected: {
    fileName: 'protected.json',
    defaultData: {}
  },
  notes: {
    fileName: 'notes.json',
    defaultData: {}
  },
  stats: {
    fileName: 'stats.json',
    defaultData: {}
  },
  workspaces: {
    fileName: 'workspaces.json',
    defaultData: {}
  }
}

const storageDirectories = {
  appStorage,
  appStorageMedia,
  appStorageBin,
  appStorageHomeBannerMedia,
  appStorageNotesMedia,
  appStorageGlobalSearchData,
  appStorageNavigatorThumbs
}

const appPaths = {
  storageFiles,
  storageDirectories,
  resources,
  systemDirs,
  homeBannerMedia,
  userData,
  userDataRoot,
  home,
  desktop,
  downloads,
  documents,
  pictures,
  screenshots,
  videos,
  music,
  binCompressed,
  bin,
  bin7Zip,
  binFFMPEG,
  binFFPROBE,
  binYoutubeDl
}

module.exports = appPaths
