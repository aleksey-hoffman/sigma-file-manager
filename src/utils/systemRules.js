// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

function paths () {
  let invalidPathChars
  let invalidPathEndChars
  let invalidPaths
  let maxPathLength
  let maxNameLength
  // Windows rules
  if (process.platform === 'win32') {
    maxPathLength = 260
    maxNameLength = 255
    invalidPathChars = ['\\', '/', ':', '*', '?', '"', '<', '>', '|']
    invalidPaths = [
      'con', 'prn', 'aux', 'nul', 'com1', 'com2', 'com3', 'com4',
      'com5', 'com6', 'com7', 'com8', 'com9', 'lpt1', 'lpt2',
      'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'
    ]
    invalidPathEndChars = [' ', '.']
  }
  // Linux rules
  if (process.platform === 'linux') {
    maxPathLength = 4096
    maxNameLength = 255
    invalidPathChars = ['/', '\0']
    invalidPaths = []
    invalidPathEndChars = []
  }
  // Mac rules
  if (process.platform === 'darwin') {
    maxPathLength = 1016
    maxNameLength = 255
    invalidPathChars = ['/', '\0']
    invalidPaths = []
    invalidPathEndChars = []
  }
  return {
    invalidPathChars,
    invalidPathEndChars,
    invalidPaths,
    maxPathLength,
    maxNameLength
  }
}

module.exports = {
  paths
}
