// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {minimatch} from 'minimatch';
import type {ViewFilterProperty, FilterNavigatorViewParams, FilterNavigatorViewResult} from '@/types/viewFilter';

export function filterNavigatorView(params: {query: string} & FilterNavigatorViewParams): FilterNavigatorViewResult {
  if (!params.items || params.items.length === 0) {
    return [];
  }

  if (!params.query) {
    return params.items;
  }

  let queryPrefix: string | undefined;
  let queryValue: string;
  const queryParts = params.query.split(':').map(str => str.trim());
  if (queryParts.length === 1) {
    queryValue = queryParts[0];
  } else if (queryParts.length === 2) {
    queryPrefix = queryParts[0];
    queryValue = queryParts[1];
  } else {
    return params.items;
  }

  const prefixProperty = getPrefixProperty(params, queryPrefix);
  const propertiesToSearch = getPropertiesToSearch(params, prefixProperty);
  const matchedItems = getFiltered(params, propertiesToSearch, queryValue);
  return matchedItems;
}

function getFiltered(
  params: FilterNavigatorViewParams,
  propertiesToSearch: ViewFilterProperty[],
  queryValue: string
): FilterNavigatorViewResult {
  const matchedItems: FilterNavigatorViewResult = [];

  params.items.forEach(item => {
    if (!params.showHiddenItems && item.is_hidden) {
      return;
    }

    if (
      propertiesToSearch.some(propertyToSearch => {
        const propertyValue = getPropertyValue(item, propertyToSearch);

        if (propertyValue) {
          const processedItemProperty = processItemProperty(params, propertyValue, propertyToSearch.itemPropertyPath);
          return propertyMatchesQuery(params, processedItemProperty, queryValue);
        }

        return false;
      })
    ) {
      matchedItems.push(item);
    }
  });

  return matchedItems;
}

function getPropertiesToSearch(params: FilterNavigatorViewParams, prefixProperty: ViewFilterProperty | undefined): ViewFilterProperty[] {
  let propertiesToSearch = params.properties;

  if (prefixProperty) {
    propertiesToSearch = propertiesToSearch.filter(property => property.prefix === prefixProperty.prefix);
  }

  return propertiesToSearch;
}

function getPropertyValue(item: unknown, property: ViewFilterProperty): unknown {
  let propertyValue;

  if (property.isDeepProperty) {
    propertyValue = getDeepPropertyValue(property.itemPropertyPath, item as Record<string, unknown>);

    if (property.processing) {
      propertyValue = property.processing(propertyValue);
    }
  } else {
    propertyValue = (item as Record<string, unknown>)[property.itemPropertyPath];
  }

  return propertyValue;
}

function getDeepPropertyValue(objectPath: string, object: any): any {
  return objectPath.split('.').reduce((obj, index) => obj[index], object);
}

function processItemProperty(params: FilterNavigatorViewParams, itemProperty: any, itemPropertyName: string): string {
  let processedItemProperty = JSON.stringify(itemProperty) || '';

  if (itemPropertyName === 'content' && params.options.glob) {
    processedItemProperty = convertHTMLtoText(processedItemProperty);
  }

  return processedItemProperty.toLowerCase();
}

function convertHTMLtoText (html: string): string {
  const DOMparser = new DOMParser();
  const virtualDoc = DOMparser.parseFromString(html, 'text/html');
  html = virtualDoc.body.innerText.replace(/\\|\//g, '');
  return html;
}

function propertyMatchesQuery(params: FilterNavigatorViewParams, itemProperty: string, queryValue: string): boolean {
  const processedQueryValue = processQueryValue(params, queryValue);

  if (params.options.glob) {
    if (processedQueryValue.length === 0) {
      return true;
    } else {
      return minimatch(itemProperty, processedQueryValue);
    }
  } else {
    return itemProperty.includes(processedQueryValue);
  }
}

function processQueryValue(params: FilterNavigatorViewParams, queryValue: string): string {
  let processedQueryValue = queryValue.toLowerCase();

  if (params.options.glob) {
    if (processedQueryValue.startsWith('*')) {
      processedQueryValue = processedQueryValue.slice(1);
    }

    if (processedQueryValue.endsWith('*')) {
      processedQueryValue = processedQueryValue.slice(0, -1);
    }
  }

  return processedQueryValue;
}

function getPrefixProperty(params: FilterNavigatorViewParams, queryPrefix?: string): ViewFilterProperty | undefined {
  return params.properties?.find(filterProperty => queryPrefix === filterProperty.prefix);
}
