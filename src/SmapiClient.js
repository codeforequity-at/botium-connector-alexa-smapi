const oauth2 = require('simple-oauth2')
const request = require('request-promise-native')
const { Capabilities, LWA, SMAPI } = require('./constants')

class SmapiClient {
  constructor (caps) {
    this.caps = caps
  }

  async refresh () {
    this.oauthClient = oauth2.create({
      client: {
        id: this.caps[Capabilities.ALEXA_SMAPI_CLIENTID],
        secret: this.caps[Capabilities.ALEXA_SMAPI_CLIENTSECRET]
      },
      auth: {
        authorizeHost: LWA.AUTHORIZE_HOST,
        authorizePath: LWA.AUTHORIZE_PATH,
        tokenHost: LWA.TOKEN_HOST,
        tokenPath: LWA.TOKEN_PATH
      }
    })

    const token = this.oauthClient.accessToken.create({
      access_token: 'ACCESS_TOKEN_PLACE_HOLDER',
      refresh_token: this.caps[Capabilities.ALEXA_SMAPI_REFRESHTOKEN],
      token_type: 'bearer',
      expires_in: 0,
      expires_at: 0
    })
    const result = await token.refresh()
    this.accessToken = result.token.access_token
  }

  async get (api, queryParams) {
    var requestOptions = {
      uri: `${this.caps[Capabilities.ALEXA_SMAPI_BASE_URL]}/${SMAPI.API_VERSION}/${api}`,
      qs: queryParams || {},
      headers: {
        Authorization: this.accessToken
      },
      json: true
    }
    return request(requestOptions)
  }

  async vendors () {
    const result = await this.get('vendors')
    return result.vendors
  }

  async listSkills () {
    const result = await this.get('skills', {
      vendorId: this.caps[Capabilities.ALEXA_SMAPI_VENDORID]
    })
    return result.skills
  }

  async getInteractionModel (skillId, stage, locale) {
    const result = await this.get(`skills/${skillId}/stages/${stage}/interactionModel/locales/${locale}`)
    return result
  }
}

module.exports = SmapiClient
