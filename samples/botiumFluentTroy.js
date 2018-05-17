const BotDriver = require('botium-core').BotDriver

const driver = new BotDriver()
  .setCapability('ALEXA_SMAPI_API', 'invocation')
  .setCapability('ALEXA_SMAPI_SKILLID', 'amzn1.ask.skill.997174d9-57e9-4e3d-bdf2-a83b2430eb78')
  .setCapability('ALEXA_SMAPI_LOCALE', 'de-DE')
  .setCapability('ALEXA_SMAPI_INVOCATION_TEXT_INTENT', 'GetTroyResponseIntent')
  .setCapability('ALEXA_SMAPI_INVOCATION_TEXT_SLOT', 'EveryThingSlot')

driver.BuildFluent()
  .ReadScripts('convos/troy')
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
