const ciphers = new Map()
let currentWordList = []

function completeSums (sums) { return sums.map(sum => [...sum, sum.reduce((a, b) => a + b, 0)]) }
function toRuby (word, num) {
  let result = ''
  const numStr = num.toString()

  for (let i = 0; i < word.length; i++) {
    result += `${word[i]}<rp>(</rp><rt>${numStr[i]}</rt><rp>)</rp>`
  }

  return `<ruby>${result}</ruby>`
}

/**
 *
 * @param {Cipher} cipher
 * @param {number[][]} sums
 */
function sumsToTable (cipher, sums) {
  if (sums[0] && sums[0].length !== 1) sums = completeSums(sums)
  const table = document.createElement('table')
  table.classList.add('sum-table')
  const tbody = document.createElement('tbody')
  tbody.classList.add('sum-tbody')
  for (const sum of sums) {
    const row = document.createElement('tr')
    row.classList.add('sum-row')
    for (let i = 0; i < sum.length; ++i) {
      const cell = document.createElement('td')
      cell.innerHTML = toRuby(cipher.toWord(sum[i]), sum[i])
      cell.classList.add('sum-cell')
      if (i === sum.length - 1) {
        cell.classList.add('sum-cell--answer')
        const eq = document.createElement('td')
        eq.classList.add('sum-eq')
        eq.textContent = '='
        row.append(eq)
      } else if (i !== 0) {
        const plus = document.createElement('td')
        plus.classList.add('sum-plus')
        plus.textContent = '+'
        row.append(plus)
      }
      row.append(cell)
    }
    tbody.append(row)
  }
  table.append(tbody)
  return table
}

function wordToCipher (word) {
  const wordLc = word.toLowerCase()
  if (!ciphers.has(wordLc)) ciphers.set(wordLc, new Cipher(wordLc))
  return ciphers.get(wordLc)
}

function prepWordList (text) {
  const result = text
    .split(/[\r\n\t ]+/)
    .map(str => str.replaceAll(/[^a-zA-Z'-]/g, ''))
    .filter(v => v && !v.includes('\'') && !v.includes('-'))
    .map(str => str.replaceAll(/[^a-zA-Z]/g, ''))
    .sort()
  return Array.from(new Set(result))
}

async function fetchWordList (resource) {
  const response = await fetch(resource)
  const text = await response.text()
  currentWordList = prepWordList(text)
}

async function loadWordList () {
  if (fileInput.files.length === 1) {
    const text = await fileInput.files[0].text()
    currentWordList = prepWordList(text)
  }
}

/**
 *
 * Cipher class
 *
 */

class Cipher {
  constructor (key) {
    this.key = key.toLowerCase()
    this.numList = []
    this.sumsMemo = new Map()
    this.letterMap = {}
    this.wordList = null
    for (let i = 0; i < this.key.length; i++) {
      const letter = this.key[i]
      if (!this.letterMap[letter]) this.letterMap[letter] = []
      this.letterMap[letter].push((i + 1) % 10)
    }
  }

  _expandConfigurations (list) {
    if (!list.length) return []
    return list
      .reduce((acc, curr) => {
        const result = []
        for (const combo of acc) {
          for (const item of curr) {
            result.push([...combo, item])
          }
        }
        return result
      }, [[]])
      .map(list => list.join(''))
  }

  encodeWord (word) {
    const result = []
    for (let i = 0; i < word.length; i++) {
      const letter = word[i]
      if (!this.letterMap[letter]) break
      result.push(this.letterMap[letter])
    }
    if (result.length === word.length) return this._expandConfigurations(result)
    else return []
  }

  encodeWords (wordList) {
    if (this.wordList === wordList) return
    this.wordList = wordList
    this.sumsMemo.clear()
    const encodings = []
    for (const word of wordList) encodings.push(...this.encodeWord(word))

    this.numList = Array
      .from(new Set(encodings.filter(result => result[0] !== '0')))
      .map(Number)
      .sort((a, b) => a - b)
  }

  /** Only valid for integers */
  _getDigitLength (num) { return Math.floor(Math.log10(num)) + 1 }

  findSumsN (n, minLength = 1) {
    if (!this.sumsMemo.has(n)) this.sumsMemo.set(n, [])
    const minNumIndex = this.numList.findIndex(num => num >= 10 ** (minLength - 1))
    if (minNumIndex === -1) return []

    const resultBuckets = this.sumsMemo.get(n)
    let firstComputedBucket = resultBuckets.findIndex(bucket => bucket && bucket.length > 0)
    if (firstComputedBucket === -1) firstComputedBucket = this._getDigitLength(this.numList[this.numList.length - 1])

    let maxNumIndex = this.numList.findIndex(num => num >= 10 ** firstComputedBucket)
    if (maxNumIndex === -1) maxNumIndex = this.numList.length
    const numSet = new Set(this.numList)

    const search = (startIndex, depth, combo, currentSum, endIndex = this.numList.length) => {
      if (depth === n) {
        if (numSet.has(currentSum)) {
          const bucketIndex = this._getDigitLength(combo[0]) - 1
          if (!resultBuckets[bucketIndex]) resultBuckets[bucketIndex] = []
          resultBuckets[bucketIndex].push([...combo])
        }
        return
      }

      for (let i = startIndex; i < endIndex; ++i) {
        const next = this.numList[i]
        combo.push(next)
        search(i, depth + 1, combo, currentSum + next)
        combo.pop()
      }
    }

    search(minNumIndex, 0, [], 0, maxNumIndex)

    return resultBuckets.slice(minLength - 1).flat()
  }

  toWord (num) {
    const str = Array.from(num.toString())
    const cipherArray = Array.from(this.key)
    cipherArray.unshift(cipherArray.pop())
    const result = []
    for (const char of str) {
      result.push(cipherArray[char])
    }
    return result.join('')
  }
}

/**
 *
 * Main program
 *
 */

const fileInput = document.getElementById('wordlist-file-input')
const urlInput = document.getElementById('wordlist-url-input')
const urlBtn = document.getElementById('wordlist-url-button')
const summandCountInput = document.getElementById('summand-count-input')
const minLengthInput = document.getElementById('min-length-input')
const cipherInput = document.getElementById('cipher-input')
const calculateButton = document.getElementById('calculate-button')
const tableRegion = document.getElementById('output')

const main = () => {
  const minLength = Number(minLengthInput.value)
  const word = cipherInput.value
  const summandCount = Number(summandCountInput.value)

  const cipher = wordToCipher(word)
  cipher.encodeWords(currentWordList)
  const sums = cipher.findSumsN(summandCount, minLength)

  const result = sumsToTable(cipher, sums)
  tableRegion.innerHTML = ''
  tableRegion.append(result)
}

fileInput.addEventListener('change', () => loadWordList())
urlBtn.addEventListener('click', async () => {
  /** @todo handle errors */
  const target = urlInput.value.trim() || urlInput.placeholder.trim()
  urlInput.value = target
  await fetchWordList(target)
})

const defaultWordList = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/refs/heads/master/content/2018/en/en_50k.txt'
urlInput.value = defaultWordList
urlInput.placeholder = defaultWordList

calculateButton.addEventListener('click', main)
