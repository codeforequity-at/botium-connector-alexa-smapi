const BotDriver = require('botium-core').BotDriver

const driver = new BotDriver()
  .setCapability('ALEXA_SMAPI_API', 'simulation')

driver.BuildFluent()
  .ReadScripts('convos/simulation')
  .RunScripts()
  .Exec()
  .then(() => {
    console.log('READY')
  })
  .catch((err) => {
    console.log('ERROR: ', err)
  })  
