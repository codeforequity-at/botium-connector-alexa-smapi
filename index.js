const uuidv1 = require('uuid/v1')
const _ = require('lodash')
// const askApi = require('ask-cli/lib/api/api-wrapper')
// const askConstants = require('ask-cli/lib/utils/constants')
// const askTools = require('ask-cli/lib/utils/tools')
const debug = require('debug')('botium-connector-alexa-smapi')

const { Defaults, Capabilities } = require('./src/constants')
const { importAlexaIntents } = require('./src/alexaintents')

const ALEXA_SMAPI_CALL_TIMEOUT_DEFAULT = 10000

class BotiumConnectorAlexaSmapi {
  constructor ({ queueBotSays, caps }) {
    this.queueBotSays = queueBotSays
    this.caps = caps
  }

  Stop () {
    debug('Stop called')
    return Promise.resolve()
  }

  Clean () {
    debug('Clean called')
    return Promise.resolve()
  }

  Validate () {
    debug('Validate called')
    this.caps = Object.assign({}, Defaults, this.caps)

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

    this.audioCapability = !!this.caps['ALEXA_SMAPI_AUDIO_CAPABILITY']
    this.displayCapability = !!this.caps['ALEXA_SMAPI_DISPLAY_CAPABILITY']

    this.refreshUserId = !!this.caps['ALEXA_SMAPI_REFRESH_USER_ID']

    this.keepAudioPlayerState = !!this.caps['ALEXA_SMAPI_KEEP_AUDIO_PLAYER_STATE']

    if (this.api !== 'invocation' && this.api !== 'simulation') {
      return Promise.reject(new Error(`ALEXA_SMAPI_API ${this.api} not supported, only simulation and invocation`))
    }

    if (this.api === 'invocation') {
      this.invocationRequestTemplate = require('./invocation-request-template.json')

      this.invocationTextIntent = this.caps['ALEXA_SMAPI_INVOCATION_TEXT_INTENT']
      this.invocationTextSlot = this.caps['ALEXA_SMAPI_INVOCATION_TEXT_SLOT']
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

    const timeoutMs = this.caps['ALEXA_SMAPI_CALL_TIMEOUT'] || ALEXA_SMAPI_CALL_TIMEOUT_DEFAULT

    const smapiCallbackTimeout = (fn, fnTimeout) => {
      let timedout = false
      const unsetTimeout = setTimeout(() => {
        timedout = true
        fnTimeout && fnTimeout()
      }, timeoutMs)

      return (...args) => {
        unsetTimeout && clearTimeout(unsetTimeout)
        !timedout && fn(...args)
      }
    }

    if (this.api === 'simulation') {
      return new Promise((resolve, reject) => {
        askApi.callSimulateSkill(null, msg.messageText, this.skillId, this.locale, this.profile, debug.enabled, smapiCallbackTimeout((data) => {
          const callResponse = askTools.convertDataToJsonObject(data.body)
          if (callResponse) {
            const simulationId = callResponse.id
            debug(`Simulation created for simulation id ${simulationId}, polling for response ...`)

            const pollSimulationResult = (responseBody) => {
              const response = askTools.convertDataToJsonObject(responseBody)
              if (response) {
                debug(`Simulation got response: ${JSON.stringify(response)}`)
                if (!Object.prototype.hasOwnProperty.call(response, 'status')) {
                  reject(new Error(`Unable to get skill simulation result for simulation id ${simulationId}`))
                } else if (response.status === askConstants.SKILL.SIMULATION_STATUS.IN_PROGRESS) {
                  setTimeout(() => {
                    askApi.callGetSimulation(simulationId, this.skillId, this.profile, debug.enabled, (data) => {
                      pollSimulationResult(data.body)
                    })
                  }, 2000)
                } else if (response.status === askConstants.SKILL.SIMULATION_STATUS.SUCCESS) {
                  resolve()

                  const simulationRequest = askTools.convertDataToJsonObject(response.result.skillExecutionInfo.invocationRequest.body.request)
                  debug(`got simulation request: ${JSON.stringify(simulationRequest)}`)
                  const simulationResult = askTools.convertDataToJsonObject(response.result.skillExecutionInfo.invocationResponse.body.response)
                  debug(`got simulation result: ${JSON.stringify(simulationResult)}`)

                  let messageText
                  if (simulationResult && simulationResult.outputSpeech) {
                    messageText = simulationResult.outputSpeech.text || simulationResult.outputSpeech.ssml
                  }

                  let media
                  if (simulationResult && simulationResult.directives) {
                    simulationResult.directives.forEach(directive => {
                      if (directive.type.includes('AudioPlayer')) {
                        const audioPlayerObject = directive
                        media = ((audioPlayerObject && audioPlayerObject.audioItem) ? [{
                          mediaUri: audioPlayerObject.audioItem.stream.url
                        }] : undefined)
                      }
                    })
                  }

                  const botMsg = { sender: 'bot', sourceData: simulationResult, messageText, media }

                  if (simulationRequest.intent && simulationRequest.intent.name) {
                    botMsg.nlp = {
                      intent: {
                        name: simulationRequest.intent.name
                      },
                      entities: simulationRequest.intent.slots ? Object.keys(simulationRequest.intent.slots).map((key) => {
                        return { name: key, value: simulationRequest.intent.slots[key].value }
                      }) : []
                    }
                  }
                  if (simulationResult.card) {
                    botMsg.cards = [
                      this._extractCard(simulationResult.card)
                    ]
                  }

                  setTimeout(() => this.queueBotSays(botMsg), 0)
                } else if (response.status === askConstants.SKILL.SIMULATION_STATUS.FAILURE) {
                  if (response.result && response.result.error) {
                    reject(new Error(`Skill simulation for simulation id ${simulationId} failed with message: ${response.result.error.message || JSON.stringify(response.result.error)}`))
                  } else {
                    reject(new Error(`Skill simulation for simulation id ${simulationId} returned FAILURE`))
                  }
                } else {
                  reject(new Error(`Invalid response for skill simulation ${simulationId}`))
                }
              }
            }
            pollSimulationResult(data.body)
          }
        }, () => reject(new Error(`No response from skill simulation api, most likely access token invalid.`))))
      })
    }
    if (this.api === 'invocation') {
      return new Promise((resolve, reject) => {
        let currentInvocationRequest = _.clone(this.invocationRequest)

        if (msg.sourceData) {
          _.merge(currentInvocationRequest.request, msg.sourceData)
        } else {
          if (this.invocationTextIntent && this.invocationTextSlot) {
            currentInvocationRequest.request.type = 'IntentRequest'
            currentInvocationRequest.request.intent.name = this.invocationTextIntent
            currentInvocationRequest.request.intent.slots[this.invocationTextSlot] = { name: this.invocationTextSlot, value: msg.messageText }
          } else {
            const [requestType, intentName] = msg.messageText.split(' ')

            if (requestType === 'LaunchIntent') {
              this._buildNewInvokeRequest()
              currentInvocationRequest = _.clone(this.invocationRequest)
            }

            currentInvocationRequest.request.type = requestType
            if (intentName) {
              currentInvocationRequest.request.intent.name = intentName
            }
          }
        }
        currentInvocationRequest.request.requestId = uuidv1()
        currentInvocationRequest.request.timestamp = (new Date()).toISOString()

        if (currentInvocationRequest.request.type.includes('AudioPlayer')) {
          this._handleAudioPlayerRequest(currentInvocationRequest)
        } else {
          delete currentInvocationRequest.request.token
          delete currentInvocationRequest.request.error
        }

        debug(`currentInvocationRequest: ${JSON.stringify(currentInvocationRequest)}`)

        askApi.callInvokeSkill(null, currentInvocationRequest, this.skillId, this.endpointRegion, this.profile, debug.enabled, smapiCallbackTimeout((data) => {
          const callResponse = askTools.convertDataToJsonObject(data.body)
          debug(`callResponse: ${JSON.stringify(callResponse)}`)

          if (callResponse.status !== 'SUCCESSFUL') {
            return reject(new Error(`Skill invocation returned status ${callResponse.status}`))
          } else if (callResponse.result && callResponse.result.error) {
            return reject(new Error(`Skill invocation failed with message: ${callResponse.result.error || callResponse.result}`))
          }
          resolve()

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

            let messageText = 'no text response from skill'
            if (responseBody.response.outputSpeech) {
              messageText = responseBody.response.outputSpeech.text || responseBody.response.outputSpeech.ssml
            }

            let media
            if (responseBody.response.directives) {
              responseBody.response.directives.forEach(directive => {
                if (directive.type.includes('AudioPlayer')) {
                  const audioPlayerObject = directive
                  const audioPlayerType = directive.type.split('.')[1].toUpperCase()

                  if (this.keepAudioPlayerState) {
                    this._handleAudioPlayerEvent(audioPlayerType, audioPlayerObject)
                  }

                  media = ((audioPlayerObject && audioPlayerObject.audioItem) ? [{
                    mediaUri: audioPlayerObject.audioItem.stream.url
                  }] : undefined)
                }
              })
            }

            const botMsg = { sender: 'bot', sourceData: responseBody, messageText, media }

            if (responseBody.response.card) {
              const card = responseBody.response.card
              botMsg.cards = [
                this._extractCard(card)
              ]
            }
            setTimeout(() => this.queueBotSays(botMsg), 0)
          }
        }, () => reject(new Error(`No response from skill invocation api, most likely access token invalid.`))))
      })
    }
    return Promise.resolve()
  }

  _handleAudioPlayerRequest (currentInvocationRequest) {
    if (currentInvocationRequest.request.type.includes('AudioPlayer')) {
      const audioPlayerIntent = currentInvocationRequest.request.type.split('.')[1]
      currentInvocationRequest.request.token = this.invocationRequest.context.AudioPlayer.token

      switch (audioPlayerIntent) {
        case 'PlaybackFailed':
          currentInvocationRequest.request.error = { message: 'Botium AudioPlayer.PlaybackFailed error message' }
          break
      }
    } else {
      delete currentInvocationRequest.request.error
      delete currentInvocationRequest.request.token
    }
  }

  _handleAudioPlayerEvent (event, audioPlayer) {
    debug(`handling audio player state for event ${event}. ${JSON.stringify(audioPlayer)}`)
    switch (event) {
      case 'PLAY':
        this.invocationRequest.context.AudioPlayer.playerActivity = 'PLAYING'
        if (audioPlayer.audioItem.stream.token) {
          this.invocationRequest.context.AudioPlayer.token = audioPlayer.audioItem.stream.token
        }
        if (audioPlayer.audioItem.stream.offsetInMilliseconds) {
          this.invocationRequest.context.AudioPlayer.offsetInMilliseconds = audioPlayer.audioItem.stream.offsetInMilliseconds
        }
        break
      case 'STOP':
        this.invocationRequest.context.AudioPlayer.playerActivity = 'STOPPED'
        this.invocationRequest.context.AudioPlayer.offsetInMilliseconds = 0
        break
    }
  }

  _createNewUserId () {
    const userId = `botium-core-test-user-${uuidv1()}`
    this.invocationRequest.session.user.userId = userId
    this.invocationRequest.context.System.user.userId = userId
  }

  _addSupportedInterfaces () {
    debug(`adding capabilities, Display: ${this.displayCapability}, Audio: ${this.audioCapability}`)
    if (this.displayCapability || this.audioCapability) {
      const supportedInterfaces = {
        AudioPlayer: (this.audioCapability ? {} : undefined),
        Display: (!this.displayCapability ? undefined : {
          templateVersion: '1.0',
          markupVersion: '1.0'
        })
      }

      this.invocationRequest.context.System.device = {
        deviceId: uuidv1(),
        supportedInterfaces
      }
    }
  }

  _buildNewInvokeRequest () {
    this.invocationRequest = _.clone(this.invocationRequestTemplate)
    this.invocationRequest.session['new'] = true
    this.invocationRequest.session.sessionId = uuidv1()
    this.invocationRequest.session.application.applicationId = this.skillId
    this.invocationRequest.context.System.application.applicationId = this.skillId
    this.invocationRequest.request.locale = this.locale
    this._addSupportedInterfaces()

    if (this.refreshUserId) {
      this._createNewUserId()
    }
  }

  _extractCard (card) {
    return {
      text: card.title,
      subtext: card.text,
      content: card.content,
      image: card.image && (card.image.smallImageUrl || card.image.largeImageUrl) ? { mediaUri: card.image.smallImageUrl || card.image.largeImageUrl } : null,
      media: card.image && [
        {
          mediaUri: card.image.smallImageUrl
        },
        {
          mediaUri: card.image.largeImageUrl
        }
      ]
    }
  }
}

module.exports = {
  PluginVersion: 1,
  PluginClass: BotiumConnectorAlexaSmapi,
  Utils: {
    importAlexaIntents
  }
}
