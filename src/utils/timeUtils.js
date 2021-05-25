// SPDX-License-Identifier: MIT
// MIT License
// Copyright © 2021 - present Aleksey Hoffman.
// All rights reserved.

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

class TimeUtils {
  constructor () {
    this.state = {
      isCanceled: false
    }
    this.initTime = null
    this.startTime = null
    this.isRunning = false
    this.remainingTime = null
    this.timeoutObject = null
    this.waitPromise = null
    this.timeOfLastThrottleRun = 0
    this.specifiedTime = null
    this.throttleData = {
      lastTarget: null,
      executionCount: 0
    }
    this.defaultTimerOptions = {
      time: 1000,
      debounceOnLastCall: true,
      lastTarget: null
    }
    this.init()
  }

  init () {
    this.initTime = new Date().getTime()
  }

  start (time) {
    this.startTime = new Date().getTime()
    this.isRunning = true
    this.specifiedTime = time
  }

  pause () {
    this.isRunning = false
    clearTimeout(this.timeoutObject)
    this.remainingTime = this.timeLeft()
  }

  resume () {
    this.isRunning = true
    this.wait(this.remainingTime)
  }

  clear () {
    this.isRunning = false
    this.state.isCanceled = true
    clearTimeout(this.timeoutObject)
    this.remainingTime = null
  }

  timeLeft () {
    return this.remainingTime - (new Date().getTime() - this.startTime)
  }

  timePassed (options = {}) {
    const defaultOptions = {
      format: 'ms'
    }
    options = { ...defaultOptions, ...options }
    const result = new Date().getTime() - this.startTime
    const formattedResult = formatTime(result, options.format)
    return formattedResult
  }

  percentsСompleted () {
    return 100 - (this.timeLeft() / this.specifiedTime * 100).toFixed(0)
  }

  percentsLeft () {
    return (this.timeLeft() / this.specifiedTime * 100).toFixed(0)
  }

  startTimer () {
    this.start()
  }

  timeout (callback, specifiedTime) {
    this.start(specifiedTime)
    this.remainingTime = specifiedTime
    this.timeoutObject = setTimeout(callback, this.remainingTime)
  }

  wait (specifiedTime) {
    this.start(specifiedTime)
    this.remainingTime = specifiedTime
    return new Promise(resolve => {
      this.timeoutObject = setTimeout(resolve, specifiedTime)
      this.waitCancelInterval = setInterval(() => {
        if (this.state.isCanceled) { resolve() }
      }, 5)
    })
  }

  /**
  * Throttles a function for specific target
  * Which allows to throttle a specific function when many functions
  * are throttled simultaneously through one class instance.
  * Runs callback continuosly every N ms if specified target === previous specified target
  * @param {function} callback
  * @param {object} options
  */
  throttleSpecific (callback, options) {
    options = { ...this.defaultTimerOptions, ...options }
    this.start(options.time)
    this.throttleData.executionCount += 1
    const timeElapsed = new Date().getTime() - this.timeOfLastThrottleRun
    const targetIsSame = this.throttleData.lastTarget === options.target
    if (timeElapsed > options.time || !targetIsSame) {
      callback()
      this.timeOfLastThrottleRun = new Date().getTime()
    }
    // If specified, run once more after the last function call, like 'this._debounce()' does
    if (this.isRunning && options.debounceOnLastCall) {
      this._debounce(callback, options)
    }
    this.throttleData.lastTarget = options.target
  }

  // Throttles a function
  // Runs callback for schedules items continuosly every N ms until schedule is empty
  throttleScheduled (options) {
    options = { ...this.defaultTimerOptions, ...options }
    this.start(options.time)
    this.throttleData.executionCount += 1
    const timeElapsed = new Date().getTime() - this.timeOfLastThrottleRun
    if (timeElapsed > options.time) {
      this.timeOfLastThrottleRun = new Date().getTime()
      options.onThrottleRunning()
    }
    else {
      options.onThrottleWaiting()
    }
    // If specified, run once more after the last function call, like 'this._debounce()' does
    if (this.isRunning && options.debounceOnLastCall) {
      this._debounce(options.onThrottleRunning, options)
    }
  }

  // Throttles a function
  // Runs callback continuosly every N ms
  throttle (callback, options) {
    options = { ...this.defaultTimerOptions, ...options }
    this.start(options.time)
    this.throttleData.executionCount += 1
    const timeElapsed = new Date().getTime() - this.timeOfLastThrottleRun
    if (timeElapsed > options.time) {
      callback()
      this.timeOfLastThrottleRun = new Date().getTime()
    }
    // If specified, run once more after the last function call, like 'this._debounce()' does
    if (this.isRunning && options.debounceOnLastCall) {
      this._debounce(callback, options)
    }
  }

  // Runs callback after the last function call as soon as the N ms is passed
  debounce (callback, options) {
    this.start(options.time)
    clearTimeout(this.timeoutObject)
    this.timeoutObject = setTimeout(() => {
      callback()
    }, options.time)
  }

  // Internal function.
  // Runs callback after the last function call as soon as the N ms is passed
  _debounce (callback, options) {
    this.start(options.time)
    clearTimeout(this.timeoutObject)
    this.timeoutObject = setTimeout(() => {
      // Prevent debounce if the function was only executed once
      // (wasn't called frequently and didn't need to be throttled)
      if (this.throttleData.executionCount > 1) {
        callback()
      }
      this.throttleData.executionCount = 0
    }, options.time)
  }
}

function formatTime (value, format) {
  if (format === 'sec') {
    return Math.floor(value / 1000)
  }
  else if (format === 'minutes') {
    return Math.floor(value / 60000)
  }
  else if (format === 'hours') {
    return Math.floor(value / 3600000)
  }
  else if (format === 'days') {
    return Math.floor(value / 86400000)
  }
  else {
    return value
  }
}

export default TimeUtils
