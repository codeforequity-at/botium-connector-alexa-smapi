const BotDriver = require('botium-core').BotDriver

const driver = new BotDriver()
  .setCapability('ALEXA_SMAPI_API', 'invocation')

driver.BuildFluent()
  .ReadScripts('convos/invocation')
  .Start()
  .RunScripts()
  .Stop()
  .Clean()
  .Exec()
  .then(() => {
    console.log('READY')
  })
  .catch((err) => {
    console.log('ERROR: ', err)
  })  
