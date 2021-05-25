// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const request = require('request')

class SigmaAppUpdater {
  constructor () {
    this.checkForUpdatesInterval = null
  }

  /** Init auto updater.
  * @param {object} params
  * @param {string} params.repo
  * @param {string} params.ext
  * @param {string} params.currentVersion
  * @param {number} params.checkInterval
  * @param {function} params.onUpdateAvailable
  * @param {function} params.onUpdateUnavailable
  */
  init (params) {
    return new Promise((resolve, reject) => {
      // Set default parameters
      const defaultParams = {
        checkInterval: 21600000, // 6 hours
        onUpdateAvailable: () => {},
        onUpdateUnavailable: () => {}
      }
      params = { ...defaultParams, ...params }
      this.ensureRequiredParamsProvided(params)
      this.checkForUpdates(params)
        .then(() => {
          this.initPeriodicUpdateCheck(params)
          resolve()
        })
        .catch((error) => {
          reject(error)
        })
    })
  }

  ensureRequiredParamsProvided (params) {
    // Throw error if required parameters are not provided
    if (!params.repo || !params.currentVersion) {
      throw Error(
        `ERROR: sigmaAppUpdater::
        some required parameters are missing: 
        repo, currentVersion`
      )
    }
  }

  initPeriodicUpdateCheck (params) {
    clearInterval(this.checkForUpdatesInterval)
    this.checkForUpdatesInterval = setInterval(() => {
      this.checkForUpdates(params)
    }, params.checkInterval)
  }

  getExt () {
    if (process.platform === 'win32') { return 'exe' }
    else if (process.platform === 'darwin') { return 'dmg' }
    else if (process.platform === 'linux') { return 'deb' }
  }

  getLatestReleaseData (data, params) {
    return new Promise((resolve, reject) => {
      const latestReleaseData = {
        version: data.tag_name,
        url: data.html_url
      }
      // Get ext if not specified
      if (!params.ext) {
        params.ext = this.getExt()
      }
      // Get specified asset by name or extension
      let asset
      if (params.name) {
        asset = data.assets.filter(asset => asset.name === params.name)
      }
      else {
        asset = data.assets.filter(asset => asset.name.endsWith(params.ext))
      }
      // Handle case asset doesn't exist
      if (asset.length === 0) {
        reject('asset-does-not-exist')
      }
      // Get asset info
      if (asset && asset.length > 0) {
        latestReleaseData.asset = {
          url: asset[0].url,
          download_url: asset[0].browser_download_url,
          name: asset[0].name,
          content_type: asset[0].content_type,
          size: asset[0].size
        }
      }
      resolve(latestReleaseData)
    })
  }

  handleUrlResolve (data, params) {
    return new Promise((resolve, reject) => {
      this.getLatestReleaseData(data, params)
        .then((latestReleaseData) => {
          const size = latestReleaseData.asset.size
          const latestVersionFormatted = parseInt(latestReleaseData.version.replace(/v/, '').replace(/\./g, ''))
          const currentVersionFormatted = parseInt(params.currentVersion.replace(/\./g, ''))
          const updateAvailable = latestVersionFormatted > currentVersionFormatted
          const responseData = {
            latestVersion: latestReleaseData.version.replace(/v/, ''),
            downloadLink: latestReleaseData.asset.download_url,
            size
          }
          // Handle: update available
          if (updateAvailable) {
            params.onUpdateAvailable(responseData)
          }
          // Handle: update unavailable
          else {
            params.onUpdateUnavailable({
              latestVersion: latestReleaseData.version.replace(/v/, '')
            })
          }
        })
        .catch((error) => {
          reject(error)
        })
    })
  }

  checkForUpdates (params) {
    return new Promise((resolve, reject) => {
      request.get(
        {
          url: `https://api.github.com/repos/${params.repo}/releases/latest`,
          port: 443,
          json: true,
          headers: { 'User-Agent': 'request' }
        },
        (error, response, data) => {
          if (error) {
            reject(error)
          }
          else if (response.statusCode !== 200) {
            reject()
          }
          else {
            this.handleUrlResolve(data, params)
              .then(() => {
                resolve()
              })
              .catch((error) => {
                reject(error)
              })
          }
        }
      )
    })
  }

  stopInterval () {
    clearInterval(this.checkForUpdatesInterval)
  }
}

module.exports = SigmaAppUpdater
