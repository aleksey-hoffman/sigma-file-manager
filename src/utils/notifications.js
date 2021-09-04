// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import utils from './sharedUtils.js'
import localizeUtils from './localizeUtils.js'
const eventHub = require('./eventHub').eventHub

class Notification {
	constructor (params) {
		this.notifications = {
			copyDirItemsInProgress: {
				action: 'update-by-hash',
				hashID: utils.getHash(),
				type: 'dir-item-transfer',
				icon: 'mdi-progress-clock',
				colorStatus: 'blue',
				closeButton: true,
				timeout: 0,
				title: 'In progress: copying items'
			},
			copyDirItemsSuccess: {
				action: 'update-by-hash',
				hashID: utils.getHash(),
				type: 'dir-item-transfer',
				colorStatus: 'green',
				icon: '',
				closeButton: true,
				timeout: 3000,
				title: 'Copied {{items}}'
			},
			moveDirItemsInProgress: {
				action: 'update-by-hash',
				hashID: utils.getHash(),
				type: 'dir-item-transfer',
				icon: 'mdi-progress-clock',
				colorStatus: 'blue',
				closeButton: true,
				timeout: 0,
				title: 'In progress: moving items'
			},
			moveDirItemsSuccess: {
				action: 'update-by-hash',
				hashID: utils.getHash(),
				type: 'dir-item-transfer',
				colorStatus: 'green',
				icon: '',
				closeButton: true,
				timeout: 3000,
				title: 'Moved {{items}}'
			},
			transferDirItemsError: {
				action: 'update-by-hash',
				hashID: utils.getHash(),
				type: 'dir-item-transfer',
				icon: 'mdi-progress-close',
        colorStatus: 'red',
				closeButton: true,
				timeout: 5000,
				title: 'Error during transfer'
			},
			renameFailedNoLongerExists: {
				action: 'add',
				colorStatus: 'red',
				timeout: 6000,
				closeButton: true,
				title: 'Failed to rename item',
				message: `
				File / directory that you are renaming no longer exists:
				<br><b>Path:</b> {{oldPath}}
				`
			},
			renameFailedError: {
				action: 'add',
				colorStatus: 'red',
				timeout: 6000,
				closeButton: true,
				title: 'Failed to rename item',
				message: `<b>Error:</b> {{error}}`
			},
			renameFailedAlreadyExists: {
				action: 'add',
				colorStatus: 'red',
				timeout: 5000,
				closeButton: true,
				title: 'Failed to rename item',
				message: `
					Item with that name already exists:
					<br>{{newName}}
				`
			},
			renameSuccess: {
				action: 'add',
				colorStatus: 'green',
				timeout: 3000,
				closeButton: true,
				title: 'Rename undone',
				message: ''
			},
		}
	
		this.data = this.notifications[params.name]
		if (params.format) {
			this.update(params)
		}
		else {
			eventHub.$emit('notification', this.data)
		}
	}

	update (params) {
		let newNotification = this.notifications[params.name]
		for (const [key, value] of Object.entries(newNotification)) {
			if (!['hashID', 'id'].includes(key)) {
				this.data[key] = value
				this._formatProp({key, value, params})
			}
		}
		if (params.error) {
			this.data.message = `
				<b>Error:</b><br>${params.error}
			`
		}
		if (params.props) {
			for (const [key, value] of Object.entries(params.props)) {
				this.data[key] = value
			}
		}
		eventHub.$emit('notification', this.data)
	}
	
	hide () {
		this.data.action = 'hide'
		eventHub.$emit('notification', this.data)
	}

	_formatProp (scope1Params) {
		if (scope1Params.params.format) {
			if (typeof scope1Params.value === 'string') {
				for (const [formatKey, formatValue] of Object.entries(scope1Params.params.format)) {
					let formattedText = formatValue
					if (formatKey === 'items') {
						formattedText = `${formatValue} ${localizeUtils.pluralize(formatValue, 'item')}`
					}
					this.data[scope1Params.key] = scope1Params.value.replace(`{{${formatKey}}}`, formattedText)
				}
			}
		}
	}
}

export default Notification