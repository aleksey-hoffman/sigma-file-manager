// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const childProcess = require('child_process')
const readline = require('readline')
const sharedUtils = require('../utils/sharedUtils.js')

class CLI {
  constructor () {
    this.state = {
      isBusy: false,
      isGettingLines: false,
      queue: [],
      readlineProcess: null
    }
  }

  async init (params, initCallback) {
    try {
      const spawnedProcess = await this._spawnPowershellProcess(params)
      initCallback(spawnedProcess)
    }
    catch (error) {
      throw Error(error)
    }
  }

  /**
  * @param {object} params.process childProcess
  * @param {string} params.command
  * @param {function} params.onFinish async function
  * @returns void
  */
  async exec (params) {
    this._addToQueue(params)
    this._scheduleCommand()
  }

  async _spawnPowershellProcess (params) {
    try {
      const spawnedProcess = childProcess.spawn(
        params.shell,
        params.args,
        params.options
      )
      spawnedProcess.on('error', (error) => {
        console.log('error', error)
      })
      return spawnedProcess
    }
    catch (error) {
      throw Error(error)
    }
  }

  _addToQueue (params) {
    params.hashID = sharedUtils.getHash()
    this.state.queue.push(params)
  }

  _removeFromQueue (params, result) {
    return new Promise((resolve, reject) => {
      const job = this.state.queue.shift()
      job.onFinish(result)
      // Resolve and get to the next command
      // without waiting for onFinish() of this command
      resolve()
    })
  }

  async _scheduleCommand () {
    if (this.state.queue.length > 0 && !this.state.isBusy) {
      this.state.isBusy = true
      this._execQueueCommand(this.state.queue[0])
        .then((payload) => {
          this._removeFromQueue(payload.params, payload.result)
          this.state.isBusy = false
          this._scheduleCommand()
        })
    }
  }

  async _execQueueCommand (params) {
    return new Promise((resolve, reject) => {
      this.state.readlineProcess = readline.createInterface({
        input: params.process.stdout
      })
      let result = []
      const startIndentifier = `"start::"`
      const endIndentifier = `"end::"`
      const rawStartIndentifier = `start::`
      const rawEndIndentifier = `end::`

      this.state.readlineProcess.on('line', (line) => {
        if (line.startsWith(rawStartIndentifier)) {
          this.state.isGettingLines = true
        }
        if (line.startsWith(rawEndIndentifier)) {
          this.state.isGettingLines = false
          this.state.readlineProcess.close()
        }
        if (this.state.isGettingLines) {
          result.push(line)
        }
      })

      this.state.readlineProcess.on('close', () => {
        result.splice(0, 1)
        const clonedResult = result

        result = []
        resolve({
          params,
          result: clonedResult
        })
      })

      this._runCommand(params, startIndentifier, endIndentifier)
    })
  }

  _runCommand (params, startIndentifier, endIndentifier) {
    params.process.stdin.write(`$command = ${params.command}\n`)
    params.process.stdin.write(`echo ${startIndentifier}\n`)
    params.process.stdin.write('$command\n')
    params.process.stdin.write(`echo ${endIndentifier}\n`)
    params.process.stdin.write('cls\n')
  }
}

module.exports = CLI
