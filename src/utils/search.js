// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const PATH = require('path')
const scoreTresholdPercent = 0.2

/**
* @param {object} params
* @param {array<string>} params.list
* @param {string} params.query
* @param {object} params.options
* @param {boolean|false} params.options.matchSymbols
* @param {boolean|false} params.options.exactMatch
* @return {Array<object>}
*/
function search (params) {
  let { list, query, options } = params
  const defaultOptions = {
    matchSymbols: false,
    exactMatch: false
  }
  options = { ...defaultOptions, ...options }
  const tokenizedQuery = getTokenized(query, options)
  const nameBaseList = getNameBaseList(list, options)
  const tokenizedNameBaseList = getTokenizedNameBaseList(nameBaseList, options)
  const results = getResults(
    list,
    query,
    options,
    tokenizedQuery,
    nameBaseList,
    tokenizedNameBaseList
  )
  return results
}

function getResults (
  list,
  query,
  options,
  tokenizedQuery,
  nameBaseList,
  tokenizedNameBaseList
) {
  const results = []
  if (options.exactMatch) {
    // Get the score for each nameBase (exact match)
    nameBaseList.forEach((nameBase, nameBaseIndex) => {
      if (query.toLowerCase() === nameBase.toLowerCase()) {
        results.push({
          score: 100,
          path: list[nameBaseIndex]
        })
      }
    })
  }
  else if (!options.exactMatch) {
    // Get the score for each nameBase
    tokenizedNameBaseList.forEach((tokenizedNameBase, tokenizedNameBaseIndex) => {
      let score = getNameBaseScore(
        query,
        options,
        tokenizedQuery,
        tokenizedNameBase
      )
      // Normalize results
      // Normalize all scores to the length of their file names
      // Long file names will always get a low score even if 50% of tokens get a close match
      // because the score is relative to the file name length and gets less with each token
      score = normalizeToTokenAmount(score, tokenizedNameBase, tokenizedQuery)
      // Add nameBase to the results if its score >= scoreTresholdPercent
      if (score >= scoreTresholdPercent || options.keepAllResults) {
        results.push({
          score: Number(score.toFixed(2)),
          path: list[tokenizedNameBaseIndex]
        })
      }
    })
  }
  return results
}

function getNameBaseScore (
  query,
  options,
  tokenizedQuery,
  tokenizedNameBase
) {
  // Get the score for each nameBaseToken
  let totalNameBaseScore = 0
  let closeMatches = 0
  tokenizedNameBase.forEach((nameBaseToken, nameBaseTokenIndex) => {
    let bestNameBaseTokenScore = 0
    tokenizedQuery.forEach((queryToken, queryTokenIndex) => {
      const nameBaseTokenScore = getSimilarityScore(queryToken, nameBaseToken, options)
      bestNameBaseTokenScore = Math.max(nameBaseTokenScore, bestNameBaseTokenScore)
      if (isCloseMatch(nameBaseTokenScore, nameBaseToken.length)) {
        closeMatches += 1
      }
    })
    totalNameBaseScore += bestNameBaseTokenScore
  })
  let closeMatchBonusScore = 0
  if (closeMatches >= 2) {
    // Add max possible bonus score
    closeMatchBonusScore = tokenizedNameBase.length
  }
  else if (closeMatches === 1) {
    // Increase score by 20%
    closeMatchBonusScore = totalNameBaseScore * 1.2
  }
  totalNameBaseScore += closeMatchBonusScore
  return Math.min(totalNameBaseScore, tokenizedNameBase.length)
}

function isCloseMatch (tokenScore, tokenlength) {
  // Check if amount of matching chars can considered a close match.
  // Longer words should tolerate more typos.
  // 1-3 chars: 0 typos | 1/1 (100%), 2/2 (100%), 3/3 (100%)
  // 4-6 chars: 1 typos | 3/4 (75%), 4/5 (80%), 5/6 (83%)
  // 7-9 chars: 2 typos | 5/7 (71%), 6/8 (75%), 7/9 (78%)
  // > 9 chars: 3 typos | 7/10 (70%), 8/11 (73%), 9/12 (75%)
  if (tokenlength <= 3) {
    return tokenScore === 1
  }
  else if (tokenlength >= 4 && tokenlength <= 6) {
    return tokenScore >= 0.75
  }
  else if (tokenlength >= 7 && tokenlength <= 9) {
    return tokenScore >= 0.71
  }
  else if (tokenlength > 9) {
    return tokenScore >= 0.7
  }
}

function normalizeToTokenAmount (score, tokenizedNameBase, tokenizedQuery) {
  const longestArrayLength = Math.max(tokenizedNameBase.length, tokenizedQuery.length, 1)
  return score / longestArrayLength
}

function getSimilarityScore (queryToken, nameBaseToken, options) {
  const charDifference = levenshteinDistance(queryToken, nameBaseToken, options)
  const longestString = Math.max(queryToken.length, nameBaseToken.length)
  const score = 1 - (charDifference / longestString)
  return score
}

function levenshteinDistance (string1, string2, options) {
  if (string1 === string2) { return 0 }
  const matrix = []
  let cost
  let i
  let j

  // Increment along the first column of each row
  for (i = 0; i <= string1.length; i++) {
    matrix[i] = [i]
  }
  // Increment each column in the first row
  for (j = 0; j <= string2.length; j++) {
    matrix[0][j] = j
  }
  // Fill in the rest of the matrix
  for (i = 1; i <= string1.length; i++) {
    for (j = 1; j <= string2.length; j++) {
      // Set cost
      cost = string1[i - 1] === string2[j - 1] ? 0 : 1
      // Set the distances
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // Handle deletion
        matrix[i][j - 1] + 1, // Handle insertion
        matrix[i - 1][j - 1] + cost // Handle substitution
      )
      if (
        options.increasedTypoTolerance &&
        i > 1 &&
        j > 1 &&
        string1[i - 1] === string2[j - 2] &&
        string1[i - 2] === string2[j - 1]
      ) {
        // Handle transposition (increase typo tolerance)
        // If current char of string1 is on the previous or the next index of string2,
        // consider it to be a typo and consider the edit distance to be 1 instead of 2
        matrix[i][j] = Math.min(
          matrix[i][j],
          matrix[i - 2][j - 2] + 1
        )
      }
    }
  }
  return matrix[string1.length][string2.length]
}

function getTokenized (string, options) {
  // Works for all languages
  // - Separate "camelCase" words
  // - Make words lowercase if option "matchCase: false"
  // - Separate nums from words
  // - Join all by a space
  // - ||Match words, punctuation chars, other symbols
  // - ||Match and remove most common symbols (except symbol ['])
  if (options.matchSymbols) {
    return string
      .replace(/(\p{Ll})(\p{Lu})/ug, '$1 $2')
      .toLowerCase()
      .split(/(?<=\D)(?=\d)|(?<=\d)(?=\D)/)
      .join(' ')
      .match(/([\p{L}-]+)|(\p{N})+|(\p{P})|(\p{S})+/ug) ??
      [] // filter out null results
  }
  else if (!options.matchSymbols) {
    return string
      .replace(/(\p{Ll})(\p{Lu})/ug, '$1 $2')
      .toLowerCase()
      .split(/(?<=\D)(?=\d)|(?<=\d)(?=\D)/)
      .join(' ')
      .match(/[^\s,._\-=+~"#@$^()%&*;:<>?!{|}[\]]+/g) ??
      [] // filter out null results
  }
}

function getNameBaseList (list, options) {
  const nameBaseList = []
  list.forEach(path => {
    const base = PATH.parse(path).base
    nameBaseList.push(base)
  })
  return nameBaseList
}

function getTokenizedNameBaseList (nameBaseList, options) {
  const tokenizedNameBaseList = []
  nameBaseList.forEach(nameBase => {
    tokenizedNameBaseList.push(getTokenized(nameBase, options))
  })
  return tokenizedNameBaseList
}

module.exports = {
  search
}
