// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import utils from '../utils/utils'
const micromatch = require('micromatch')

const data = {
  params: {},
  micromatchInputMaxLength: 65536
}

/**
* @param {string} params.filterQuery
* @param {array} params.items
* @param {object} params.filterProperties
* @param {object} params.filterQueryOptions
* @returns {array}
*/
export default function itemFilter (params) {
  if (!params.filterProperties) {
    throw Error(`
      params.filterProperties is undefined. 
      Probably forgot to define 'state.filterField.view[this.$route.name].filterProperties' in store
    `)
  }
  data.params = params
  return fetchFilterMatches()
}

function fetchFilterMatches () {
  if (!data.params.items) { return [] }
  const query = data.params.filterQuery.toLowerCase()
  const specifiedFilterProperty = getActivePrefix(query)
  const queryValue = query.replace(specifiedFilterProperty.prefix, '').trimStart()
  const propertiesToSearch = getPropertiesToSearch(specifiedFilterProperty)
  const matchedItems = getMatchedItems(data.params.items, propertiesToSearch, queryValue)
  return [...new Set(matchedItems)]
}

function getPropertiesToSearch (specifiedFilterProperty) {
  // If a file property specified, filter it out
  let propertiesToSearch = data.params.filterProperties
  const somePropertyIsSpecified = Object.keys(specifiedFilterProperty).length > 0
  if (somePropertyIsSpecified) {
    propertiesToSearch = propertiesToSearch
      .filter(property => property.prefix === specifiedFilterProperty.prefix)
  }
  return propertiesToSearch
}

function getMatchedItems (items, propertiesToSearch, queryValue) {
  const matchedItems = []
  items.forEach(item => {
    propertiesToSearch.forEach(propertyToSearch => {
      const propertyValue = getPropertyValue(item, propertyToSearch)
      if (propertyValue) {
        const processedItemProperty = processItemProperty(
          propertyValue,
          propertyToSearch
        )
        const matches = isMatch(processedItemProperty, queryValue)
        if (matches) {
          matchedItems.push(item)
        }
      }
    })
  })
  return matchedItems
}

function getPropertyValue (item, property) {
  let propertyValue
  if (property.isDeepProperty) {
    propertyValue = getDeepPropertyValue(property.property, item)
    if (property.processing) {
      propertyValue = property.processing(propertyValue)
    }
  }
  else {
    propertyValue = item[property.property]
  }
  return propertyValue
}

function getDeepPropertyValue (objectPath, object) {
  return objectPath.split('.').reduce((obj, index) => obj[index], object)
}

function processItemProperty (itemProperty, itemPropertyName) {
  itemProperty = utils
    .cloneDeep(itemProperty)
    .toString() || ''
  if (itemPropertyName === 'content') {
    if (data.params.filterQueryOptions.glob) {
      itemProperty = convertHTMLtoText(itemProperty)
    }
  }
  return itemProperty.toLowerCase()
}

function convertHTMLtoText (html) {
  const DOMparser = new DOMParser()
  const virtualDoc = DOMparser.parseFromString(html, 'text/html')
  html = virtualDoc.body.innerText.replace(/\\|\//g, '')
  return html
}

function isMatch (itemProperty, queryValue) {
  if (data.params.filterQueryOptions.glob) {
    if (queryValue.length === 0) {
      return true
    }
    else {
      if (itemProperty.length >= data.micromatchInputMaxLength) { return false }
      return micromatch.isMatch(itemProperty, queryValue)
    }
  }
  else {
    return itemProperty.includes(queryValue)
  }
}

function getActivePrefix (query) {
  return data.params.filterProperties?.find(filterProperty => {
    return query.startsWith(filterProperty.prefix)
  }) || {}
}
