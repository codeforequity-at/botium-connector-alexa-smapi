const { AuthorizationCode } = require('simple-oauth2')
const axios = require('axios').default
const debug = require('debug')('botium-connector-alexa-smapi-client')
const { Capabilities, LWA, SMAPI } = require('./constants')

class SmapiClient {
  constructor (caps) {
    this.caps = caps
  }

  async refresh () {
    try {
      this.oauthClient = new AuthorizationCode({
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
      token = this.oauthClient.createToken({
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

  async _request (method, api, queryParams, body) {
    const url = `${this.caps[Capabilities.ALEXA_SMAPI_BASE_URL]}/${SMAPI.API_VERSION}/${api}`
    try {
      const response = await axios({
        method,
        url,
        params: queryParams || {},
        headers: {
          Authorization: this.accessToken
        },
        data: body
      })
      return response.data
    } catch (err) {
      const status = err.response && err.response.status
      throw new Error(status ? `HTTP error! status: ${status}` : err.message)
    }
  }

  async get (api, queryParams) {
    return this._request('GET', api, queryParams)
  }

  async post (api, queryParams, body) {
    return this._request('POST', api, queryParams, body)
  }

  async put (api, queryParams, body) {
    return this._request('PUT', api, queryParams, body)
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

  async putInteractionModel (skillId, stage, locale, interactionModel) {
    const result = await this.put(
      `skills/${skillId}/stages/${stage}/interactionModel/locales/${locale}`,
      {},
      {
        interactionModel
      }
    )
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
