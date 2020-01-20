const util = require('util')
const oauth2 = require('simple-oauth2')
const readline = require('readline-sync')
const fs = require('fs')
const debug = require('debug')('botium-connector-alexa-smapi-intents')

const { Capabilities, Defaults, LWA } = require('./constants')
const SmapiClient = require('./SmapiClient')

const prompt = (text) => {
  while (true) {
    const result = readline.question(text)
    if (result && result.trim().length > 0) {
      return result.trim()
    }
  }
}

const handler = async (argv) => {
  debug(`command options: ${util.inspect(argv)}`)

  console.log('This wizard will guide you through the Botium Connector setup. Please follow the instructions.')
  console.log('It involves Copy&Paste from a web browser to this terminal window.')
  console.log('\n\n')
  console.log('######## Step 1/3 - Create Amazon Security Profile ########')
  console.log(' 1. Go to this url: https://developer.amazon.com/home.html')
  console.log(' 2. Open "Settings" / "Security Profiles" and create a new profile or select an existing one')
  console.log(' 3. Add this url to the "Allowed Return URLs": https://s3.amazonaws.com/ask-cli/response_parser.html')
  console.log('\n')
  const clientId = prompt('Copy & Paste the "Client-ID" here: ')
  const clientSecret = prompt('Copy & Paste the "Client-Secret" here: ')
  console.log('\n\n')

  const oauthClient = oauth2.create({
    client: { id: clientId, secret: clientSecret },
    auth: {
      authorizeHost: LWA.AUTHORIZE_HOST,
      authorizePath: LWA.AUTHORIZE_PATH,
      tokenHost: LWA.TOKEN_HOST,
      tokenPath: LWA.TOKEN_PATH
    }
  })

  const authorizeUrl = oauthClient.authorizationCode.authorizeURL({
    redirect_uri: LWA.S3_RESPONSE_PARSER_URL,
    scope: LWA.DEFAULT_SCOPES,
    state: LWA.DEFAULT_STATE
  })
  console.log('######## Step 2/3 - Get Amazon Authorization Code ########')
  console.log(` 1. Paste the following url to your browser and follow the instructions:\n    ${authorizeUrl}`)
  console.log('\n')
  const authCode = prompt('Copy&Paste the Authorization Code you received: ')

  const tokenConfig = {
    code: authCode,
    redirect_uri: LWA.S3_RESPONSE_PARSER_URL
  }

  let refreshToken = null
  try {
    const result = await oauthClient.authorizationCode.getToken(tokenConfig, {})
    refreshToken = oauthClient.accessToken.create(result).token.refresh_token
    console.log('Received Refresh Token from Amazon Servers ...')
  } catch (error) {
    console.log('Access Token Error', error.message)
    process.exit(1)
  }

  const caps = {
    ALEXA_SMAPI_REFRESHTOKEN: refreshToken,
    ALEXA_SMAPI_CLIENTID: clientId,
    ALEXA_SMAPI_CLIENTSECRET: clientSecret
  }

  console.log('\n\n')
  console.log('######## Step 3/3 - Selecting vendor id and skill ########')
  console.log('\n')

  const smapiClient = new SmapiClient(Object.assign({}, Defaults, caps))
  await smapiClient.refresh()

  const vendors = await smapiClient.vendors()
  let vendorId = null
  if (vendors.length === 0) {
    console.log('There is no vendor id for your account. Skill selection not possible, please do this manually.')
  } else if (vendors.length === 1) {
    console.log(`Using vendor id "${vendors[0].id}" (${vendors[0].name}) for your account`)
    vendorId = vendors[0].id
  } else {
    console.log(`Found ${vendors.length} vendor ids for your account`)
    for (let i = 0; i < vendors.length; i++) {
      console.log(` ${i + 1}: "${vendors[i].id}" (${vendors[i].name})`)
    }
    while (true) {
      const vendorIndex = prompt('Enter Number of vendor id to use: ')
      if (vendorIndex > 0 && vendorIndex <= vendors.length) {
        vendorId = vendors[vendorIndex - 1].id
        break
      }
    }
  }
  if (vendorId) {
    caps[Capabilities.ALEXA_SMAPI_VENDORID] = vendorId
    smapiClient.caps[Capabilities.ALEXA_SMAPI_VENDORID] = vendorId

    const skills = await smapiClient.listSkills()
    console.log('\n')
    console.log(`Found ${skills.length} skills for your account`)
    for (let i = 0; i < skills.length; i++) {
      const name = skills[i].nameByLocale[Object.keys(skills[i].nameByLocale)[0]]
      console.log(` ${i + 1}: "${name}" (${skills[i].skillId})`)
    }
    while (true) {
      const skillIndex = prompt('Enter Number of skill to use: ')
      if (skillIndex > 0 && skillIndex <= skills.length) {
        caps[Capabilities.ALEXA_SMAPI_SKILLID] = skills[skillIndex - 1].skillId
        break
      }
    }
  }
  console.log('\n\n')

  console.log('######## Ready - Creating botium.json ########')

  let botiumJson = {}
  if (fs.existsSync('botium.json')) {
    console.log('Reading existing file botium.json ...')
    botiumJson = JSON.parse(fs.readFileSync('botium.json'))
  }
  botiumJson.botium = botiumJson.botium || {}
  botiumJson.botium.Capabilities = botiumJson.botium.Capabilities || {}
  botiumJson.botium.Capabilities = Object.assign({}, {
    CONTAINERMODE: 'alexa-smapi'
  }, botiumJson.botium.Capabilities, caps)

  fs.writeFileSync('botium.json', JSON.stringify(botiumJson, null, 2))
  console.log('Done.')
}

module.exports = {
  args: {
    command: 'init',
    describe: 'Initializing Alexa SMAPI connection in botium.json',
    builder: (yargs) => {
    },
    handler
  }
}
