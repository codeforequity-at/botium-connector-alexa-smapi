const request = require('request-promise-native')
const cheerio = require('cheerio')
const debug = require('debug')('botium-connector-alexa-smapi-slottypes')

const SLOT_TYPES_SAMPLES = require('./slottypesamples.json')
const SLOT_TYPES_URL = 'https://developer.amazon.com/de/docs/custom-skills/slot-type-reference.html'

const downloadSlotTypes = async (tableId) => {
  debug(`Downloading slot types from ${SLOT_TYPES_URL}`)
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

const loadSlotTypes = async (tableId) => {
  const slotTypes = await downloadSlotTypes(tableId)

  const langKey = Object.keys(SLOT_TYPES_SAMPLES).find(l => tableId.startsWith(l))
  if (langKey) {
    Object.assign(slotTypes, SLOT_TYPES_SAMPLES[langKey])
  }
  debug(`Loaded slot type samples for: ${Object.keys(slotTypes)}`)
  return slotTypes
}

module.exports = {
  SLOT_TYPES_URL,
  loadSlotTypes
}
