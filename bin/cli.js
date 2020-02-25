#!/usr/bin/env node
const yargsCmd = require('yargs')
const slug = require('slug')
const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
const _ = require('lodash')
const { BotDriver } = require('botium-core')

const { importHandler, importArgs } = require('../src/alexaintents')
const { downloadSlotTypes, SLOT_TYPE_LANGUAGES, SLOT_TYPES_URL } = require('../src/slottypes')

const writeConvo = (compiler, convo, outputDir) => {
  const filename = path.resolve(outputDir, slug(convo.header.name) + '.convo.txt')

  mkdirp.sync(outputDir)

  const scriptData = compiler.Decompile([convo], 'SCRIPTING_FORMAT_TXT')

  fs.writeFileSync(filename, scriptData)
  return filename
}

const writeUtterances = (compiler, utterance, samples, outputDir) => {
  const filename = path.resolve(outputDir, slug(utterance) + '.utterances.txt')

  mkdirp.sync(outputDir)

  const scriptData = [utterance, ...samples].map(s => s.trim()).join('\n')

  fs.writeFileSync(filename, scriptData)
  return filename
}

yargsCmd.usage('Botium Connector Alexa SMAPI CLI\n\nUsage: $0 [options]') // eslint-disable-line
  .help('help').alias('help', 'h')
  .version('version', require('../package.json').version).alias('version', 'V')
  .showHelpOnFail(true)
  .strict(true)
  .demandCommand(1, 'You need at least one command before moving on')
  .command(require('../src/init').args)
  .command({
    command: 'import',
    describe: 'Importing Convos and Utterances for Botium',
    builder: (yargs) => {
      for (const arg of Object.keys(importArgs)) {
        if (arg.skipCli) continue
        yargs.option(arg, importArgs[arg])
      }
      yargs.option('output', {
        describe: 'Output directory',
        type: 'string',
        default: '.'
      })
    },
    handler: async (argv) => {
      const outputDir = argv.output

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

      let convos = []
      let utterances = []
      try {
        ({ convos, utterances } = await importHandler(argv))
      } catch (err) {
        console.log(`FAILED: ${err.message}`)
        return
      }

      const driver = new BotDriver()
      const compiler = await driver.BuildCompiler()

      for (const convo of convos) {
        try {
          const filename = writeConvo(compiler, convo, outputDir)
          console.log(`SUCCESS: wrote convo to file ${filename}`)
        } catch (err) {
          console.log(`WARNING: writing convo "${convo.header.name}" failed: ${err.message}`)
        }
      }
      for (const utterance of utterances) {
        try {
          const filename = writeUtterances(compiler, utterance.name, utterance.utterances, outputDir)
          console.log(`SUCCESS: wrote utterances to file ${filename}`)
        } catch (err) {
          console.log(`WARNING: writing utterances "${utterance.name}" failed: ${err.message}`)
        }
      }
    }
  })
  .command({
    command: 'getslottypesamples',
    describe: `Downloading slot type samples from ${SLOT_TYPES_URL}`,
    builder: (yargs) => {
      yargs.option('output', {
        describe: 'Output file',
        type: 'string',
        default: './slottypesamples.json'
      })
    },
    handler: async (argv) => {
      const outputFile = argv.output

      const slotTypeSamples = {}
      for (const language of SLOT_TYPE_LANGUAGES) {
        console.log(`Downloading slot type samples for language ${language}`)
        slotTypeSamples[language] = await downloadSlotTypes(language)
      }
      fs.writeFileSync(outputFile, JSON.stringify(slotTypeSamples, null, 2))
      console.log(`Wrote slot type samples to file ${outputFile}`)
    }
  })
  .argv
