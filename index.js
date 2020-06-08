const BotiumConnectorAlexaSmapi = require('./src/connector')
const { importHandler, importArgs } = require('./src/alexaintents')
const { exportHandler, exportArgs } = require('./src/alexaintents')

module.exports = {
  PluginVersion: 1,
  PluginClass: BotiumConnectorAlexaSmapi,
  Import: {
    Handler: importHandler,
    Args: importArgs
  },
  Export: {
    Handler: exportHandler,
    Args: exportArgs
  }
}
