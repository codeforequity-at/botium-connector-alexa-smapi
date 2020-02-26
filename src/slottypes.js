const request = require('request-promise-native')
const cheerio = require('cheerio')
const debug = require('debug')('botium-connector-alexa-smapi-slottypes')

const SLOT_TYPE_SAMPLES = require('../data/slottypesamples.json')
const BUILTIN_SLOT_TYPE_SAMPLES = require('../data/builtinslottypesamples.json')

const SLOT_TYPES_URL = 'https://developer.amazon.com/de/docs/custom-skills/slot-type-reference.html'
const SLOT_TYPE_LANGUAGES = ['en-au', 'en-ca', 'en-gb', 'en-us', 'fr-ca', 'fr-fr', 'de-de', 'hi-in', 'it-it', 'ja-jp', 'pt-br', 'es-es', 'es-mx', 'es-us']

const downloadSlotTypes = async (language) => {
  const tableId = `#${language}1`
  debug(`Downloading slot type samples for language ${language} from ${SLOT_TYPES_URL}`)
  const htmlString = await request(SLOT_TYPES_URL)
  const $ = cheerio.load(htmlString)

  const slotTypes = {}
  $('tr', tableId).each(function () {
    const tds = $(this).find('td')
    const slotTypeName = $(tds[0]).text().trim()
    if (slotTypeName) {
      const slotTypeSamples = $('li', tds[2]).map(function () {
        return $(this).text().trim()
      }).get()
      slotTypes[slotTypeName] = slotTypeSamples
    }
  })
  return slotTypes
}

const loadSlotTypes = (language) => {
  const slotTypes = {}

  const builtinLangKey = Object.keys(BUILTIN_SLOT_TYPE_SAMPLES).find(l => language.startsWith(l))
  if (builtinLangKey) {
    Object.assign(slotTypes, BUILTIN_SLOT_TYPE_SAMPLES[builtinLangKey])
  }

  const langKey = Object.keys(SLOT_TYPE_SAMPLES).find(l => language.startsWith(l))
  if (langKey) {
    Object.assign(slotTypes, SLOT_TYPE_SAMPLES[langKey])
  }
  debug(`Loaded slot type samples for: ${Object.keys(slotTypes)}`)
  return slotTypes
}

const expandSlotType = (sample, slotName, slotSamples) => {
  const result = []
  slotSamples.forEach(ss => {
    result.push(sample.replace(`{${slotName}}`, ss))
  })
  return result
}

const reSlots = /{(.*?)}/g
const extractSlotNames = (sample) => {
  const reMatches = (sample.match(reSlots) || []).map(e => RegExp(reSlots.source, reSlots.flags).exec(e))
  if (reMatches.length > 0) {
    return reMatches.map(r => r[1])
  }
  return []
}

module.exports = {
  SLOT_TYPES_URL,
  SLOT_TYPE_LANGUAGES,
  downloadSlotTypes,
  loadSlotTypes,
  expandSlotType,
  extractSlotNames
}
