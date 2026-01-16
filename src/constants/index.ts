// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export const UI_CONSTANTS = {
  SMALL_SCREEN_BREAKPOINT: 800,
  DOUBLE_CLICK_DELAY: 300,
  WORKSPACE_MAX_PANE_COUNT: 2,
  WORKSPACE_SAVE_DEBOUNCE_MS: 500,
} as const;

export const DIR_SIZE_CONSTANTS = {
  BATCH_LIMIT: 50,
} as const;

export const SEARCH_CONSTANTS = {
  DEFAULT_RESULT_LIMIT: 50,
  MIN_RESULT_LIMIT: 10,
  MAX_RESULT_LIMIT: 500,
} as const;

export const FILE_EXTENSIONS: Record<string, readonly string[]> = {
  IMAGE: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'tif'],
  VIDEO: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpeg', 'mpg'],
  AUDIO: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus'],
  CODE: ['js', 'ts', 'jsx', 'tsx', 'vue', 'py', 'java', 'cpp', 'c', 'h', 'rs', 'go', 'rb', 'php', 'swift', 'kt', 'cs', 'html', 'css', 'scss', 'sass', 'less', 'json', 'xml', 'yaml', 'yml', 'toml', 'md', 'sh', 'bash', 'ps1', 'sql'],
  ARCHIVE: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso'],
  TEXT: ['txt', 'log', 'ini', 'cfg', 'conf', 'env'],
};
