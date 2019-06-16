const util = require('util')
const path = require('path')
const fs = require('fs')
const slug = require('slug')
const mkdirp = require('mkdirp')
const request = require('request-promise-native')
const cheerio = require('cheerio')
const _ = require('lodash')
const askApi = require('ask-cli/lib/api/api-wrapper')
const askTools = require('ask-cli/lib/utils/tools')
const botium = require('botium-core')
const debug = require('debug')('botium-connector-alexa-smapi-intents')

const getCaps = () => {
  const caps = {}
  caps[botium.Capabilities.CONTAINERMODE] = path.resolve(__dirname, '..', 'index.js')
  return caps
}

const writeUtterances = (utterance, samples, outputDir) => {
  const filename = path.resolve(outputDir, slug(utterance) + '.utterances.txt')

  mkdirp.sync(outputDir)

  const scriptData = [ utterance, ...samples ].map(s => s.trim()).join('\n')

  fs.writeFileSync(filename, scriptData)
  return filename
}

const SLOT_TYPES_URL = 'https://developer.amazon.com/de/docs/custom-skills/slot-type-reference.html'

const downloadSlotTypes = async (tableId) => {
  debug(`Downloading slot types from ${SLOT_TYPES_URL}`)
  const htmlString = await request(SLOT_TYPES_URL)
  const $ = cheerio.load(htmlString)

  const slotTypes = {}
  $('tr', tableId).each(function () {
    const tds = $(this).find('td')
    const slotTypeName = $(tds[0]).text().trim()
    const slotTypeSamples = $('li', tds[2]).map(function () {
      return $(this).text().trim()
    }).get()
    slotTypes[slotTypeName] = slotTypeSamples
  })
  return slotTypes
}

const importAlexaIntents = async ({ expandcustomslots, expandbuiltinslots, expandbuiltinslotsid, slotsamples, interactionmodel, invocation }) => {
  const builtinSlotTypes = expandbuiltinslots ? await downloadSlotTypes(expandbuiltinslotsid) : {}
  debug(`Downloaded ${Object.keys(builtinSlotTypes).length} built-in slot types`)

  let interactionModelJson = {}

  if (interactionmodel) {
    debug(`Reading interaction model from file ${interactionmodel}`)
    interactionModelJson = JSON.parse(fs.readFileSync(interactionmodel))
  } else {
    const driver = new botium.BotDriver(getCaps())
    const container = await driver.Build()

    debug(`Loading interaction model from Alexa API`)
    interactionModelJson = await (new Promise((resolve, reject) => {
      askApi.callGetModel(
        container.pluginInstance.skillId,
        'development',
        container.pluginInstance.locale,
        container.pluginInstance.profile,
        debug.enabled,
        (data) => {
          if (data && data.body) {
            resolve(askTools.convertDataToJsonObject(data.body))
          } else {
            reject(new Error(`Got no response from callGetModel`))
          }
        }
      )
    }))
    debug('Downloaded Alexa InteractionModel: ', JSON.stringify(interactionModelJson, null, 2))
  }
  debug(`Got Alexa InteractionModel with ${interactionModelJson.interactionModel.languageModel.intents.length} intents`)

  const result = []
  for (const intentModel of interactionModelJson.interactionModel.languageModel.intents) {
    if (intentModel.name.startsWith('AMAZON.')) {
      debug(`Ignoring built-in intent ${intentModel.name}`)
    } else {
      let samples = intentModel.samples

      intentModel.slots && intentModel.slots.forEach(slot => {
        if (slot.samples) {
          samples = samples.concat(slot.samples)
        }
      })

      if (expandcustomslots || expandbuiltinslots) {
        const expandSlotType = (sample, slotName, slotSamples) => {
          const result = []
          slotSamples.forEach(ss => {
            result.push(sample.replace(`{${slotName}}`, ss))
          })
          return result
        }

        const customSlotTypes = {}
        if (expandcustomslots) {
          for (const typeModel of interactionModelJson.interactionModel.languageModel.types) {
            const slotTypeSamples = typeModel.values.reduce((cum, v) => {
              cum.push(v.name.value)
              cum = cum.concat(v.name.synonyms || [])
              return cum
            }, [])
            customSlotTypes[typeModel.name] = slotTypeSamples
          }
        }

        let expandedSamples = []
        const reSlots = /{(.*?)}/g
        samples.forEach(s => {
          let sExpanded = [ s ]

          const reMatches = (s.match(reSlots) || []).map(e => RegExp(reSlots.source, reSlots.flags).exec(e))
          if (reMatches.length > 0) {
            reMatches.forEach(r => {
              const slotName = r[1]
              const slot = intentModel.slots && intentModel.slots.find(slot => slot.name === slotName)
              if (slot) {
                const slotType = slot.type
                if (slotsamples && slotsamples[slotName]) {
                  sExpanded = sExpanded.reduce((cum, sToExpand) => {
                    return cum.concat(expandSlotType(sToExpand, slotName, slotsamples[slotName]))
                  }, [])
                } else if (builtinSlotTypes && expandbuiltinslots && builtinSlotTypes[slotType]) {
                  sExpanded = sExpanded.reduce((cum, sToExpand) => {
                    return cum.concat(expandSlotType(sToExpand, slotName, builtinSlotTypes[slotType]))
                  }, [])
                } else if (customSlotTypes && expandcustomslots && customSlotTypes[slotType]) {
                  sExpanded = sExpanded.reduce((cum, sToExpand) => {
                    return cum.concat(expandSlotType(sToExpand, slotName, customSlotTypes[slotType]))
                  }, [])
                } else {
                  debug(`Utterance "${s}" - Slot ${slotName} / ${slotType} ignored - use command line to specify samples: --slotsamples "${slotName}=sample1|sample2"`)
                }
              }
            })
          }
          expandedSamples = expandedSamples.concat(sExpanded)
        })
        samples = _.uniq(expandedSamples)
      } else {
        samples = _.uniq(samples)
      }

      if (invocation) {
        samples.forEach((s, i) => {
          samples[i] = `${invocation} ${s}`
        })
      }

      result.push({
        name: intentModel.name,
        samples
      })
    }
  }
  return result
}

const handler = (argv) => {
  if (argv.slotsamples) {
    argv.slotsamples = _.isArray(argv.slotsamples) ? argv.slotsamples : [ argv.slotsamples ]

    argv.slotsamples = argv.slotsamples.reduce((cum, ss) => {
      if (ss.split('=').length !== 2) {
        console.log(`WARNING: slot sample arg invalid format "${ss}"`)
      } else {
        cum[ss.split('=')[0]] = ss.split('=')[1].split('|')
      }
      return cum
    }, {})
  }
  debug(`command options: ${util.inspect(argv)}`)
  const outputDir = (argv.convos && argv.convos[0]) || '.'

  importAlexaIntents(argv)
    .then((utterances) => {
      for (const utterance of utterances) {
        console.log(`Writing ${utterance.samples.length} utterances for intent ${utterance.name}`)
        writeUtterances(utterance.name, utterance.samples, outputDir)
      }
    })
    .catch((err) => {
      console.log(`FAILED: ${err.message}`)
    })
}

module.exports = {
  importAlexaIntents,
  args: {
    command: 'alexaimport',
    describe: 'Importing conversations for Botium',
    builder: (yargs) => {
      yargs.option('expandcustomslots', {
        describe: 'Expand slots with custom slot types in utterances',
        default: true
      })
      yargs.option('expandbuiltinslots', {
        describe: `Expand slots with builtin slot types in utterances (built-in slot types loaded from ${SLOT_TYPES_URL}, column "Sample List Values" is used for expansion)`,
        default: true
      })
      yargs.option('expandbuiltinslotsid', {
        describe: `Language table id from ${SLOT_TYPES_URL} - section "List Slot Types" (hover over language, see last part of the url, for example "#de-de1")`,
        default: '#en-us1',
        requiresArg: true
      })
      yargs.option('slotsamples', {
        describe: 'Slot name and list of sample values - for example: --slotsamples "travelDate=tomorrow|next week" (can be specified multiple times)',
        requiresArg: true
      })
      yargs.option('interactionmodel', {
        describe: 'Path to the interaction model file. If not given, it will be downloaded (with connection settings from botium.json, "development" profile).',
        requiresArg: true
      })
      yargs.option('invocation', {
        describe: 'Prefix each utterance with an invocation sequence (for example: "Alexa, tell myskill")',
        requiresArg: true
      })
    },
    handler
  }
}
