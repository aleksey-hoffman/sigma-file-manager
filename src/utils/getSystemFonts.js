// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export async function getSystemFonts () {
  try {
    await getPermission()
    const pickedFonts = await window.queryLocalFonts()
    return pickedFonts.map(font => font.fullName)
  }
  catch (error) {
    return []
  }
}

export async function getSystemFontsWithType () {
  try {
    await getPermission()
    const pickedFonts = await window.queryLocalFonts()
    const fonts = []
    for await (const font of pickedFonts) {
      const type = await getFontType(font)
      fonts.push({name: font.fullName, type})
    }
    return fonts
  }
  catch (error) {
    return []
  }
}

async function getPermission () {
  try {
    const status = await navigator.permissions.request({
      name: 'local-fonts',
    })
    if (status.state !== 'granted') {
      throw new Error('Permission to get fonts failed')
    }
  }
  catch (error) {
    if (error.name !== 'TypeError') {
      throw error
    }
  }
}

async function getFontType (fontData) {
  // https://web.dev/local-fonts/
  const sfnt = await fontData.blob()
  const sfntVersion = await sfnt.slice(0, 4).text()

  let outlineFormat = ''
  switch (sfntVersion) {
    case '\x00\x01\x00\x00':
    case 'true':
    case 'typ1':
      outlineFormat = 'truetype'
      break
    case 'OTTO':
      outlineFormat = 'cff'
      break
  }
  return outlineFormat
}