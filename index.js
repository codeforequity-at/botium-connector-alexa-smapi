const util = require('util')
const uuidv1 = require('uuid/v1')
const _ = require('lodash')
const askApi = require('ask-cli/lib/api/api-wrapper')
const askConstants = require('ask-cli/lib/utils/constants')
const askTools = require('ask-cli/lib/utils/tools')
const debug = require('debug')('botium-connector-alexa-smapi')

class BotiumConnectorAlexaSmapi {
  constructor ({ queueBotSays, caps }) {
    this.queueBotSays = queueBotSays
    this.caps = caps
  }

  Validate () {
    debug('Validate called')
    if (this.caps['ALEXA_SMAPI_API'] && this.caps['ALEXA_SMAPI_API'] !== 'simulation' && this.caps['ALEXA_SMAPI_API'] !== 'invocation') throw new Error('ALEXA_SMAPI_API capability invalid (allowed values: "simulation", "invoication"')
    if (!this.caps['ALEXA_SMAPI_SKILLID']) throw new Error('ALEXA_SMAPI_SKILLID capability required')

    return Promise.resolve()
  }

  Build () {
    debug('Build called')
    this.api = this.caps['ALEXA_SMAPI_API'] || 'simulation'
    this.skillId = this.caps['ALEXA_SMAPI_SKILLID']
    this.locale = this.caps['ALEXA_SMAPI_LOCALE'] || 'en-US'
    this.endpointRegion = this.caps['ALEXA_SMAPI_ENDPOINTREGION'] || 'default'

    if (this.caps['ALEXA_SMAPI_REFRESHTOKEN'] || this.caps['ALEXA_SMAPI_ACCESSTOKEN']) {
      this.profile = askConstants.PLACEHOLDER.ENVIRONMENT_VAR.PROFILE_NAME

      process.env.ASK_REFRESH_TOKEN = this.caps['ALEXA_SMAPI_REFRESHTOKEN']
      process.env.ASK_ACCESS_TOKEN = this.caps['ALEXA_SMAPI_ACCESSTOKEN']
    } else {
      this.profile = this.caps['ALEXA_SMAPI_AWSPROFILE'] || 'default'
    }

    if (this.api === 'invocation') {
      this.invocationRequestTemplate = require('./invocation-request-template.json')
    }
    return Promise.resolve()
  }

  Start () {
    debug('Start called')

    if (this.api === 'invocation') {
      this._buildNewInvokeRequest()
    }
    return Promise.resolve()
  }

  UserSays (msg) {
    debug('UserSays called')
    if (this.api === 'simulation') {
      return new Promise((resolve, reject) => {
        askApi.callSimulateSkill(null, msg.messageText, this.skillId, this.locale, this.profile, debug.enabled, (data) => {
          const callResponse = askTools.convertDataToJsonObject(data.body)
          if (callResponse) {
            const simulationId = callResponse.id
            debug(`Simulation created for simulation id ${simulationId}, polling for response ...`)

            const pollSimulationResult = (responseBody) => {
              const response = askTools.convertDataToJsonObject(responseBody)
              if (response) {
                if (!response.hasOwnProperty('status')) {
                  reject(new Error(`Unable to get skill simulation result for simulation id ${simulationId}`))
                } else if (response.status === askConstants.SKILL.SIMULATION_STATUS.IN_PROGRESS) {
                  setTimeout(() => {
                    askApi.callGetSimulation(simulationId, this.skillId, this.profile, debug.enabled, (data) => {
                      pollSimulationResult(data.body)
                    })
                  }, 2000)
                } else if (response.status === askConstants.SKILL.SIMULATION_STATUS.SUCCESS) {
                  resolve()

                  const simulationResult = askTools.convertDataToJsonObject(response.result.skillExecutionInfo.invocationResponse.body.response)
                  debug(`got simulation result: ${util.inspect(simulationResult)}`)
                  const messageText = simulationResult.outputSpeech.text || simulationResult.outputSpeech.ssml
                  const botMsg = { sender: 'bot', sourceData: simulationResult, messageText }
                  this.queueBotSays(botMsg)
                } else if (response.status === askConstants.SKILL.SIMULATION_STATUS.FAILURE) {
                  reject(new Error(`Skill simulation for simulation id ${simulationId} returned FAILURE`))
                } else {
                  reject(new Error(`Invalid response for skill simulation ${simulationId}`))
                }
              }
            }
            pollSimulationResult(data.body)
          }
        })
      })
    }
    if (this.api === 'invocation') {
      return new Promise((resolve, reject) => {
        const currentInvocationRequest = _.clone(this.invocationRequest)

        if (msg.sourceData) {
          _.merge(currentInvocationRequest.request, msg.sourceData)
        } else {
          const [ requestType, intentName ] = msg.messageText.split(' ')
          currentInvocationRequest.request.type = requestType
          if (intentName) {
            currentInvocationRequest.request.intent.name = intentName
          }
        }
        currentInvocationRequest.request.requestId = uuidv1()
        currentInvocationRequest.request.timestamp = (new Date()).toISOString()
        debug(`currentInvocationRequest: ${util.inspect(currentInvocationRequest)}`)

        askApi.callInvokeSkill(null, currentInvocationRequest, this.skillId, this.endpointRegion, this.profile, debug.enabled, (data) => {
          const callResponse = askTools.convertDataToJsonObject(data.body)
          debug(`callResponse: ${util.inspect(callResponse)}`)

          if (callResponse.status !== 'SUCCESSFUL') {
            reject(new Error(`Skill invocation returned status ${callResponse.status}`))
          } else if (callResponse.result && callResponse.result.error) {
            reject(new Error(`Skill invocation failed with message: ${callResponse.result.error || callResponse.result}`))
          }

          if (callResponse.result && callResponse.result.skillExecutionInfo && callResponse.result.skillExecutionInfo.invocationResponse && callResponse.result.skillExecutionInfo.invocationResponse.body) {
            const responseBody = callResponse.result.skillExecutionInfo.invocationResponse.body
            if (responseBody.response.shouldEndSession) {
              this._buildNewInvokeRequest()
            } else {
              this.invocationRequest.session['new'] = false
              if (responseBody.sessionAttributes) {
                Object.assign(this.invocationRequest.session.attributes, responseBody.sessionAttributes)
              }
            }
            const messageText = responseBody.response.outputSpeech.text || responseBody.response.outputSpeech.ssml
            const botMsg = { sender: 'bot', sourceData: responseBody, messageText }
            this.queueBotSays(botMsg)
          }
          resolve()
        })
      })
    }
    return Promise.resolve()
  }

  Stop () {
    debug('Stop called')
    return Promise.resolve()
  }

  Clean () {
    debug('Clean called')
    return Promise.resolve()
  }

  _buildNewInvokeRequest () {
    this.invocationRequest = _.clone(this.invocationRequestTemplate)
    this.invocationRequest.session['new'] = true
    this.invocationRequest.session.sessionId = uuidv1()
    this.invocationRequest.session.application.applicationId = this.skillId
    this.invocationRequest.context.System.application.applicationId = this.skillId
    this.invocationRequest.request.locale = this.locale
  }
}

module.exports = {
  PluginVersion: 1,
  PluginClass: BotiumConnectorAlexaSmapi
}