const path = require('path')
const fs = require('fs')
const _ = require('lodash')
const botium = require('botium-core')
const debug = require('debug')('botium-connector-alexa-smapi-intents')

const SmapiClient = require('./SmapiClient')
const { loadSlotTypes, expandSlotType, extractSlotNames, SLOT_TYPES_URL, SLOT_TYPE_LANGUAGES } = require('./slottypes')

const getCaps = (caps) => {
  const result = caps || {}
  result[botium.Capabilities.CONTAINERMODE] = path.resolve(__dirname, '..', 'index.js')
  return result
}

const importAlexaIntents = async ({ caps, buildconvos, expandcustomslots, expandbuiltinslots, expandbuiltinslotsid, slotsamples, interactionmodel, invocation }) => {
  const builtinSlotTypes = expandbuiltinslots ? await loadSlotTypes(expandbuiltinslotsid) : {}
  debug(`Loaded ${Object.keys(builtinSlotTypes).length} built-in slot types`)

  let interactionModelJson = {}

  if (interactionmodel) {
    debug(`Reading interaction model from file ${interactionmodel}`)
    interactionModelJson = JSON.parse(fs.readFileSync(interactionmodel)).interactionModel
  } else {
    debug('Loading interaction model from Alexa API')

    try {
      const driver = new botium.BotDriver(getCaps(caps))
      const container = await driver.Build()
      const smapiClient = new SmapiClient(container.pluginInstance.caps)
      await smapiClient.refresh()
      const model = await smapiClient.getInteractionModel(container.pluginInstance.skillId, 'development', container.pluginInstance.locale)
      interactionModelJson = model.interactionModel
      await container.Clean()

      debug('Downloaded Alexa InteractionModel: ', JSON.stringify(interactionModelJson, null, 2))
    } catch (err) {
      debug(`Error downloading interaction model: ${err.message}`)
    }
  }
  debug(`Got Alexa InteractionModel with ${interactionModelJson.languageModel.intents.length} intents`)

  const convos = []
  const utterances = []

  for (const intentModel of interactionModelJson.languageModel.intents) {
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
        const customSlotTypes = {}
        if (expandcustomslots && interactionModelJson.languageModel.types) {
          for (const typeModel of interactionModelJson.languageModel.types) {
            const slotTypeSamples = typeModel.values.reduce((cum, v) => {
              cum.push(v.name.value)
              cum = cum.concat(v.name.synonyms || [])
              return cum
            }, [])
            customSlotTypes[typeModel.name] = slotTypeSamples
          }
        }

        let expandedSamples = []
        samples.forEach(s => {
          let sExpanded = [s]

          const slotNames = extractSlotNames(s)
          slotNames.forEach(slotName => {
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

      utterances.push({
        name: intentModel.name,
        utterances: samples
      })

      if (buildconvos) {
        convos.push({
          header: {
            name: intentModel.name
          },
          conversation: [
            {
              sender: 'me',
              messageText: intentModel.name
            },
            {
              sender: 'bot',
              asserters: [
                {
                  name: 'INTENT',
                  args: [intentModel.name]
                }
              ]
            }
          ]
        })
      }
    }
  }
  return { convos, utterances }
}

const exportAlexaIntents = async ({ caps, getjson, output, interactionmodel }, { convos, utterances }, { statusCallback }) => {
  const driver = new botium.BotDriver(caps)
  const container = await driver.Build()

  const status = (log, obj) => {
    debug(log, obj)
    if (statusCallback) statusCallback(log, obj)
  }

  let interactionModelJson = {}
  try {
    if (interactionmodel) {
      debug(`Reading interaction model from file ${interactionmodel}`)
      interactionModelJson = JSON.parse(fs.readFileSync(interactionmodel)).interactionModel
    } else {
      debug('Loading interaction model from Alexa API')

      try {
        const smapiClient = new SmapiClient(container.pluginInstance.caps)
        await smapiClient.refresh()
        const model = await smapiClient.getInteractionModel(container.pluginInstance.skillId, 'development', container.pluginInstance.locale)
        interactionModelJson = model.interactionModel

        debug('Downloaded Alexa InteractionModel: ', JSON.stringify(interactionModelJson, null, 2))
      } catch (err) {
        throw new Error(`Error downloading interaction model: ${err.message}`)
      }
    }
    status(`Got Alexa InteractionModel with ${interactionModelJson.languageModel.intents.length} intents`, { interactionModelJson })
    for (const utt of utterances) {
      const intentEntry = interactionModelJson.languageModel.intents.find(i => i.name === utt.name)
      if (intentEntry) {
        const newExamples = utt.utterances.filter(u => !intentEntry.samples.includes(u))
        if (newExamples.length > 0) {
          status(`${newExamples.length} new user examples found for "${utt.name}", adding to interaction model`)
          intentEntry.samples = intentEntry.samples.concat(newExamples)
        } else {
          status(`No new user examples files found for "${utt.name}".`)
        }
      } else {
        status(`Intent "${utt.name}" not found in interaction model, creating new one`)
        interactionModelJson.languageModel.intents.push({
          name: utt.name,
          samples: utt.utterances
        })
      }
    }
    if (getjson) {
      return { interactionModelJson }
    } else if (output) {
      fs.writeFileSync(output, JSON.stringify(interactionModelJson, null, 2))
      return { interactionModelJson }
    } else {
      try {
        const smapiClient = new SmapiClient(container.pluginInstance.caps)
        await smapiClient.refresh()
        const model = await smapiClient.putInteractionModel(container.pluginInstance.skillId, 'development', container.pluginInstance.locale, interactionModelJson)

        status('Uploaded Alexa InteractionModel', { interactionModelJson, result: model })
      } catch (err) {
        throw new Error(`Error uploading interaction model: ${err.message}`)
      }
    }
  } finally {
    if (container) {
      try {
        await container.Clean()
      } catch (err) {
        debug(`Error container cleanup: ${err && err.message}`)
      }
    }
  }
  return { interactionModelJson }
}

module.exports = {
  importHandler: ({ caps, buildconvos, expandcustomslots, expandbuiltinslots, expandbuiltinslotsid, slotsamples, interactionmodel, invocation, ...rest } = {}) => importAlexaIntents({ caps, buildconvos, expandcustomslots, expandbuiltinslots, expandbuiltinslotsid, slotsamples, interactionmodel, invocation, ...rest }),
  importArgs: {
    caps: {
      describe: 'Capabilities',
      type: 'json',
      skipCli: true
    },
    buildconvos: {
      describe: 'Build convo files for intent assertions (otherwise, just write utterances files) - use --no-buildconvos to disable',
      type: 'boolean',
      default: false
    },
    expandcustomslots: {
      describe: 'Expand slots with custom slot types in utterances',
      type: 'boolean',
      default: true
    },
    expandbuiltinslots: {
      describe: `Expand slots with builtin slot types in utterances (built-in slot types loaded from ${SLOT_TYPES_URL}, column "Sample List Values" is used for expansion)`,
      type: 'boolean',
      default: true
    },
    expandbuiltinslotsid: {
      describe: `Slot Type Language from ${SLOT_TYPES_URL} - section "List Slot Types"`,
      default: 'en-us',
      choices: SLOT_TYPE_LANGUAGES,
      requiresArg: true
    },
    slotsamples: {
      describe: 'Slot name and list of sample values - for example: --slotsamples "travelDate=tomorrow|next week" (can be specified multiple times)',
      requiresArg: true
    },
    interactionmodel: {
      describe: 'Path to the interaction model file. If not given, it will be downloaded (with connection settings from botium.json, "development" profile).',
      requiresArg: true
    },
    invocation: {
      describe: 'Prefix each utterance with an invocation sequence (for example: "Alexa, tell myskill")',
      requiresArg: true
    }
  },
  exportHandler: ({ caps, getjson, output, interactionmodel, ...rest } = {}, { convos, utterances } = {}, { statusCallback } = {}) => exportAlexaIntents({ caps, getjson, output, interactionmodel, ...rest }, { convos, utterances }, { statusCallback }),
  exportArgs: {
    caps: {
      describe: 'Capabilities',
      type: 'json',
      skipCli: true
    },
    getjson: {
      describe: 'Return interaction model as JSON',
      type: 'boolean',
      skipCli: true,
      default: false
    },
    output: {
      describe: 'Path to the changed interaction model file.',
      type: 'string'
    },
    interactionmodel: {
      describe: 'Path to the interaction model file. If not given, it will be downloaded (with connection settings from botium.json, "development" profile).',
      requiresArg: true
    }
  }
}
