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
const fs = require('fs')
const electron = require('electron')

const electronRemote = process.type === 'browser'
  ? electron
  : require('@electron/remote')

const env = process.type === 'browser'
  ? process.env
  : electronRemote.getGlobal('mainProcessProps').env

const userData = electronRemote.app.getPath('userData')
const home = getUserDirPath('home')
const desktop = getUserDirPath('desktop')
const downloads = getUserDirPath('downloads')
const documents = getUserDirPath('documents')
const pictures = getUserDirPath('pictures')
const screenshots = getUserDirPath('screenshots')
const videos = getUserDirPath('videos')
const music = getUserDirPath('music')
const oneDrive = getUserDirPath('oneDrive')

const userDataRoot = PATH.parse(userData).root.replace(/\\/g, '/')
const resources = process.env.NODE_ENV === 'production'
  ? `${process.resourcesPath}/app.asar/resources`
  : PATH.join(__static, 'resources')
const appStorage = PATH.join(userData, 'app storage')
const appStorageMedia = PATH.join(appStorage, 'media')
const homeBannerMedia = PATH.join(resources, 'media', 'home banner')
const resourcesBin = PATH.join(resources, process.platform, 'bin')
const appStorageBin = PATH.join(appStorage, 'bin')
const appStorageHomeBannerMedia = PATH.join(appStorage, 'media', 'home banner')
const appStorageNotesMedia = PATH.join(appStorage, 'media', 'notes')
const appStorageGlobalSearchData = PATH.join(appStorage, 'search data')
const appStorageNavigatorThumbs = PATH.join(appStorage, 'media', 'thumbnails')
const bin = process.env.NODE_ENV === 'production'
  ? appStorageBin
  : resourcesBin

const FFMPEG = PATH.join(bin, 'ffmpeg', 'bin')
const ytdlp = PATH.join(bin, 'yt-dlp')
const sevenZip = PATH.join(bin, '7-zip')

let userDirs
let bin7Zip
let binYtdlp

if (process.platform === 'win32') {
  bin7Zip = PATH.join(sevenZip, '7z.exe')
  binYtdlp = PATH.join(ytdlp, 'yt-dlp.exe')
  userDirs = [
    {name: 'home', title: 'Home', icon: 'mdi-folder-account-outline', path: home},
    {name: 'desktop', title: 'Desktop', icon: 'mdi-aspect-ratio', path: desktop},
    {name: 'downloads', title: 'Downloads', icon: 'mdi-download', path: downloads},
    {name: 'documents', title: 'Documents', icon: 'mdi-text-box-multiple-outline', path: documents},
    {name: 'screenshots', title: 'Screenshots', icon: 'mdi-image-size-select-large', path: screenshots},
    {name: 'pictures', title: 'Pictures', icon: 'mdi-image-multiple-outline', path: pictures},
    {name: 'videos', title: 'Videos', icon: 'mdi-play-circle-outline', path: videos},
    {name: 'music', title: 'Music', icon: 'mdi-music', path: music},
  ]
}
else if (process.platform === 'linux') {
  bin7Zip = PATH.join(sevenZip, '7zz')
  binYtdlp = PATH.join(ytdlp, 'yt-dlp_linux')
  userDirs = [
    {name: 'home', title: 'Home', icon: 'mdi-folder-account-outline', path: home},
    {name: 'desktop', title: 'Desktop', icon: 'mdi-aspect-ratio', path: desktop},
    {name: 'downloads', title: 'Downloads', icon: 'mdi-download', path: downloads},
    {name: 'documents', title: 'Documents', icon: 'mdi-text-box-multiple-outline', path: documents},
    {name: 'pictures', title: 'Pictures', icon: 'mdi-image-multiple-outline', path: pictures},
    {name: 'videos', title: 'Videos', icon: 'mdi-play-circle-outline', path: videos},
    {name: 'music', title: 'Music', icon: 'mdi-music', path: music},
  ]
}
else if (process.platform === 'darwin') {
  bin7Zip = PATH.join(sevenZip, '7zz')
  binYtdlp = PATH.join(ytdlp, 'yt-dlp')
  userDirs = [
    {name: 'home', title: 'Home', icon: 'mdi-folder-account-outline', path: home},
    {name: 'desktop', title: 'Desktop', icon: 'mdi-aspect-ratio', path: desktop},
    {name: 'downloads', title: 'Downloads', icon: 'mdi-download', path: downloads},
    {name: 'documents', title: 'Documents', icon: 'mdi-text-box-multiple-outline', path: documents},
    {name: 'pictures', title: 'Pictures', icon: 'mdi-image-multiple-outline', path: pictures},
    {name: 'videos', title: 'Videos', icon: 'mdi-play-circle-outline', path: videos},
    {name: 'music', title: 'Music', icon: 'mdi-music', path: music},
  ]
}

const binCompressed = PATH.join(bin, 'compressed.zip')
const binFFMPEG = PATH.join(FFMPEG, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
const binFFPROBE = PATH.join(FFMPEG, process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe')

const storageFiles = {
  settings: {
    fileName: 'settings.json',
    defaultData: {},
  },
  pinned: {
    fileName: 'pinned.json',
    defaultData: {},
  },
  protected: {
    fileName: 'protected.json',
    defaultData: {},
  },
  notes: {
    fileName: 'notes.json',
    defaultData: {},
  },
  stats: {
    fileName: 'stats.json',
    defaultData: {},
  },
  workspaces: {
    fileName: 'workspaces.json',
    defaultData: {},
  },
}

const storageDirectories = {
  appStorage,
  appStorageMedia,
  appStorageBin,
  appStorageHomeBannerMedia,
  appStorageNotesMedia,
  appStorageGlobalSearchData,
  appStorageNavigatorThumbs,
}

const appPaths = {
  storageFiles,
  storageDirectories,
  resources,
  userDirs,
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
  oneDrive,
  binCompressed,
  resourcesBin,
  bin,
  bin7Zip,
  binFFMPEG,
  binFFPROBE,
  binYtdlp,
}

function getUserDirPath (dirName) {
  if (dirName === 'screenshots') {
    let screenshotsDir = PATH.join(pictures, 'Screenshots')
    try {
      fs.statSync(screenshotsDir)
      return screenshotsDir
    }
    catch (error) {
      return pictures
    }
  }
  else if (dirName === 'oneDrive') {
    return env.OneDrive
  }

  try {
    return electronRemote.app.getPath(dirName)
  }
  catch (error) {
    let dirNameFormatted = dirName[0].toUpperCase() + dirName.slice(1)
    let userDir = env.USERPROFILE || env.HOME
    return PATH.join(userDir, dirNameFormatted)
  }
}

module.exports = appPaths
