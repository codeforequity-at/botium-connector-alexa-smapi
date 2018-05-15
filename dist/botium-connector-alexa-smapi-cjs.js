'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var util = _interopDefault(require('util'));
var apiWrapper = _interopDefault(require('ask-cli/lib/api/api-wrapper'));
var constants = _interopDefault(require('ask-cli/lib/utils/constants'));
var tools = _interopDefault(require('ask-cli/lib/utils/tools'));
var debug = _interopDefault(require('debug'));

var debug$1 = debug('botium-connector-alexa-smapi');

var BotiumConnectorAlexaSmapi = function BotiumConnectorAlexaSmapi (ref) {
  var queueBotSays = ref.queueBotSays;
  var caps = ref.caps;

  this.queueBotSays = queueBotSays;
  this.caps = caps;
};

BotiumConnectorAlexaSmapi.prototype.Validate = function Validate () {
  debug$1('Validate called');
  if (this.caps['ALEXA_SMAPI_API'] && this.caps['ALEXA_SMAPI_API'] !== 'simulation' && this.caps['ALEXA_SMAPI_API'] !== 'invocation') { throw new Error('ALEXA_SMAPI_API capability invalid (allowed values: "simulation", "invoication"') }
  if (!this.caps['ALEXA_SMAPI_SKILLID']) { throw new Error('ALEXA_SMAPI_SKILLID capability required') }

  return Promise.resolve()
};

BotiumConnectorAlexaSmapi.prototype.Build = function Build () {
  debug$1('Build called');
  this.api = this.caps['ALEXA_SMAPI_API'] || 'simulation';
  this.skillId = this.caps['ALEXA_SMAPI_SKILLID'];
  this.locale = this.caps['ALEXA_SMAPI_LOCALE'] || 'en-US';

  if (this.caps['ALEXA_SMAPI_REFRESHTOKEN'] || this.caps['ALEXA_SMAPI_ACCESSTOKEN']) {
    this.profile = constants.PLACEHOLDER.ENVIRONMENT_VAR.PROFILE_NAME;

    process.env.ASK_REFRESH_TOKEN = this.caps['ALEXA_SMAPI_REFRESHTOKEN'];
    process.env.ASK_ACCESS_TOKEN = this.caps['ALEXA_SMAPI_ACCESSTOKEN'];
  } else {
    this.profile = this.caps['ALEXA_SMAPI_AWSPROFILE'] || 'default';
  }
  return Promise.resolve()
};

BotiumConnectorAlexaSmapi.prototype.Start = function Start () {
  debug$1('Start called');
  return Promise.resolve()
};

BotiumConnectorAlexaSmapi.prototype.UserSays = function UserSays (msg) {
    var this$1 = this;

  debug$1('UserSays called');
  if (this.api === 'simulation') {
    return new Promise(function (resolve, reject) {
      apiWrapper.callSimulateSkill(null, msg.messageText, this$1.skillId, this$1.locale, this$1.profile, debug$1.enabled, function (data) {
        var callResponse = tools.convertDataToJsonObject(data.body);
        if (callResponse) {
          var simulationId = callResponse.id;
          debug$1(("Simulation created for simulation id " + simulationId + ", polling for response ..."));

          var pollSimulationResult = function (responseBody) {
            var response = tools.convertDataToJsonObject(responseBody);
            if (response) {
              if (!response.hasOwnProperty('status')) {
                reject(new Error(("Unable to get skill simulation result for simulation id " + simulationId)));
              } else if (response.status === constants.SKILL.SIMULATION_STATUS.IN_PROGRESS) {
                setTimeout(function () {
                  apiWrapper.callGetSimulation(simulationId, this$1.skillId, this$1.profile, debug$1.enabled, function (data) {
                    pollSimulationResult(data.body);
                  });
                }, 2000);
              } else if (response.status === constants.SKILL.SIMULATION_STATUS.SUCCESS) {
                resolve();

                var simulationResult = tools.convertDataToJsonObject(response.result.skillExecutionInfo.invocationResponse.body.response);
                debug$1(("got simulation result: " + (util.inspect(simulationResult))));
                var messageText = simulationResult.outputSpeech.text || simulationResult.outputSpeech.ssml;
                var botMsg = { sender: 'bot', sourceData: simulationResult, messageText: messageText };
                this$1.queueBotSays(botMsg);
              } else if (response.status === constants.SKILL.SIMULATION_STATUS.FAILURE) {
                reject(new Error(("Skill simulation for simulation id " + simulationId + " returned FAILURE")));
              } else {
                reject(new Error(("Invalid response for skill simulation " + simulationId)));
              }
            }
          };
          pollSimulationResult(data.body);
        }
      });
    })
  }
  return Promise.resolve()
};

BotiumConnectorAlexaSmapi.prototype.Stop = function Stop () {
  debug$1('Stop called');
  return Promise.resolve()
};

BotiumConnectorAlexaSmapi.prototype.Clean = function Clean () {
  debug$1('Clean called');
  return Promise.resolve()
};

var botiumConnectorAlexaSmapi = {
  PluginVersion: 1,
  PluginClass: BotiumConnectorAlexaSmapi
};
var botiumConnectorAlexaSmapi_1 = botiumConnectorAlexaSmapi.PluginVersion;
var botiumConnectorAlexaSmapi_2 = botiumConnectorAlexaSmapi.PluginClass;

exports.default = botiumConnectorAlexaSmapi;
exports.PluginVersion = botiumConnectorAlexaSmapi_1;
exports.PluginClass = botiumConnectorAlexaSmapi_2;
//# sourceMappingURL=botium-connector-alexa-smapi-cjs.js.map
