// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

class ColorUtils {
  getColorData (color, lightnessTreshold = 186) {
    // Convert 'rgb(a, b, c)' to hex '#aabbcc'
    if (color.startsWith('rgb')) {
      color = this.rgbToHex(color)
    }

    const lightness = this.getLightness(color)
    if (lightness > lightnessTreshold) {
      return {
        contrast: {
          value: '#757575',
          type: 'dark'
        },
        lightness
      }
    }
    else {
      return {
        contrast: {
          value: '#eeeeee',
          type: 'light'
        },
        lightness
      }
    }
  }

  rgbToHex (color) {
    const rgbArray = color.match(/\d+/g)
    const result = rgbArray.map(digit => {
      const hex = parseInt(digit).toString(16)
      return hex.length === 1
        ? '0' + hex
        : hex
    }).join('')
    return `#${result}`
  }

  getLightness (color) {
    const subpixelValuesHex = color.replace(/#/, '').match(/.{1,2}/g)
    const subpixelValuesDecimal = subpixelValuesHex.map(color => parseInt(color, 16))
    const lightnessR = subpixelValuesDecimal[0] * 0.299
    const lightnessG = subpixelValuesDecimal[1] * 0.587
    const lightnessB = subpixelValuesDecimal[2] * 0.114
    const lightness = lightnessR + lightnessG + lightnessB
    return lightness
  }
}

module.exports = ColorUtils
