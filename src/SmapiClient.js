const oauth2 = require('simple-oauth2')
const request = require('request-promise-native')
const debug = require('debug')('botium-connector-alexa-smapi-client')
const { Capabilities, LWA, SMAPI } = require('./constants')

class SmapiClient {
  constructor (caps) {
    this.caps = caps
  }

  async refresh () {
    try {
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
    } catch (err) {
      throw new Error(`Cant create oauth client ${err}`)
    }

    let token
    try {
      token = this.oauthClient.accessToken.create({
        access_token: 'ACCESS_TOKEN_PLACE_HOLDER',
        refresh_token: this.caps[Capabilities.ALEXA_SMAPI_REFRESHTOKEN],
        token_type: 'bearer',
        expires_in: 0,
        expires_at: 0
      })
    } catch (err) {
      throw new Error(`Cant create oauth token ${err}`)
    }
    try {
      const result = await token.refresh()
      this.accessToken = result.token.access_token
    } catch (err) {
      throw new Error(`Cant refresh access token ${err}`)
    }
    debug('Access Token Refreshed ...')
  }

  async get (api, queryParams) {
    var requestOptions = {
      method: 'GET',
      uri: `${this.caps[Capabilities.ALEXA_SMAPI_BASE_URL]}/${SMAPI.API_VERSION}/${api}`,
      qs: queryParams || {},
      headers: {
        Authorization: this.accessToken
      },
      json: true
    }
    return request(requestOptions)
  }

  async post (api, queryParams, body) {
    var requestOptions = {
      method: 'POST',
      uri: `${this.caps[Capabilities.ALEXA_SMAPI_BASE_URL]}/${SMAPI.API_VERSION}/${api}`,
      qs: queryParams || {},
      headers: {
        Authorization: this.accessToken
      },
      json: body
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

  async simulate (skillId, stage, locale, content, newSession) {
    const result = await this.post(
      `skills/${skillId}/simulations`,
      {},
      {
        session: {
          mode: newSession ? 'FORCE_NEW_SESSION' : 'DEFAULT'
        },
        input: {
          content
        },
        device: {
          locale
        }
      })
    return result
  }

  async simulationStatus (skillId, requestId) {
    const result = await this.get(`skills/${skillId}/simulations/${requestId}`)
    return result
  }

  async invoke (skillId, endpointRegion, invocationRequest) {
    const result = await this.post(
      `skills/${skillId}/invocations`,
      {},
      {
        endpointRegion,
        skillRequest: {
          body: invocationRequest
        }
      }
    )
    return result
  }
}

module.exports = SmapiClient
