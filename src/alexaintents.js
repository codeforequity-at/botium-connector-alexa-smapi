const util = require('util')
const path = require('path')
const fs = require('fs')
const slug = require('slug')
const mkdirp = require('mkdirp')
const request = require('request-promise-native')
const cheerio = require('cheerio')
const _ = require('lodash')
const botium = require('botium-core')
const debug = require('debug')('botium-connector-alexa-smapi-intents')

const SmapiClient = require('./SmapiClient')

const getCaps = (caps) => {
  const result = caps || {}
  result[botium.Capabilities.CONTAINERMODE] = path.resolve(__dirname, '..', 'index.js')
  return result
}

const writeConvo = (compiler, convo, outputDir) => {
  const filename = path.resolve(outputDir, slug(convo.header.name) + '.convo.txt')

  mkdirp.sync(outputDir)

  const scriptData = compiler.Decompile([convo], 'SCRIPTING_FORMAT_TXT')

  fs.writeFileSync(filename, scriptData)
  return filename
}

const writeUtterances = (utterance, samples, outputDir) => {
  const filename = path.resolve(outputDir, slug(utterance) + '.utterances.txt')

  mkdirp.sync(outputDir)

  const scriptData = [utterance, ...samples].map(s => s.trim()).join('\n')

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

const importAlexaIntents = async ({ caps, buildconvos, expandcustomslots, expandbuiltinslots, expandbuiltinslotsid, slotsamples, interactionmodel, invocation }) => {
  const builtinSlotTypes = expandbuiltinslots ? await downloadSlotTypes(expandbuiltinslotsid) : {}
  debug(`Downloaded ${Object.keys(builtinSlotTypes).length} built-in slot types`)

  let interactionModelJson = {}

  const driver = new botium.BotDriver(getCaps(caps))
  const container = await driver.Build()
  const compiler = await driver.BuildCompiler()

  if (interactionmodel) {
    debug(`Reading interaction model from file ${interactionmodel}`)
    interactionModelJson = JSON.parse(fs.readFileSync(interactionmodel))
  } else {
    debug(`Loading interaction model from Alexa API`)
    const smapiClient = new SmapiClient(container.pluginInstance.caps)
    await smapiClient.refresh()
    const model = await smapiClient.getInteractionModel(container.pluginInstance.skillId, 'development', container.pluginInstance.locale)
    interactionModelJson = model

    debug('Downloaded Alexa InteractionModel: ', JSON.stringify(interactionModelJson, null, 2))
  }
  debug(`Got Alexa InteractionModel with ${interactionModelJson.interactionModel.languageModel.intents.length} intents`)

  const convos = []
  const utterances = []

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
        if (expandcustomslots && interactionModelJson.interactionModel.languageModel.types) {
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
          let sExpanded = [s]

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

  try {
    await container.Clean()
  } catch (err) {
    debug(`Error container cleanup: ${util.inspect(err)}`)
  }
  return { convos, utterances, driver, container, compiler }
}

const handler = (argv) => {
  if (argv.slotsamples) {
    argv.slotsamples = _.isArray(argv.slotsamples) ? argv.slotsamples : [argv.slotsamples]

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
    .then(({ convos, utterances, compiler }) => {
      for (const convo of convos) {
        try {
          const filename = writeConvo(compiler, convo, outputDir)
          console.log(`SUCCESS: wrote convo to file ${filename}`)
        } catch (err) {
          console.log(`WARNING: writing convo "${convo.header.name}" failed: ${util.inspect(err)}`)
        }
      }
      for (const utterance of utterances) {
        try {
          const filename = writeUtterances(utterance.name, utterance.utterances, outputDir)
          console.log(`SUCCESS: wrote utterances to file ${filename}`)
        } catch (err) {
          console.log(`WARNING: writing utterances "${utterance.name}" failed: ${util.inspect(err)}`)
        }
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
      yargs.option('buildconvos', {
        describe: 'Build convo files for intent assertions (otherwise, just write utterances files) - use --no-buildconvos to disable',
        default: true
      })
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
