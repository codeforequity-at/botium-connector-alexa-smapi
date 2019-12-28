# Botium Connector for Amazon Alexa Skills API

[![NPM](https://nodei.co/npm/botium-connector-alexa-smapi.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/botium-connector-alexa-smapi/)

[![Codeship Status for codeforequity-at/botium-connector-alexa-smapi](https://app.codeship.com/projects/e0750720-3c10-0136-1ab8-1230355a00f9/status?branch=master)](https://app.codeship.com/projects/290458)
[![npm version](https://badge.fury.io/js/botium-connector-alexa-smapi.svg)](https://badge.fury.io/js/botium-connector-alexa-smapi)
[![license](https://img.shields.io/github/license/mashape/apistatus.svg)]()

This is a [Botium](https://github.com/codeforequity-at/botium-core) connector for testing your Amazon Alexa Skills with the Skills Management API.

__Did you read the [Botium in a Nutshell](https://medium.com/@floriantreml/botium-in-a-nutshell-part-1-overview-f8d0ceaf8fb4) articles ? Be warned, without prior knowledge of Botium you won't be able to properly use this library!__

## How it works ?
The [Alexa Skills Management API](https://developer.amazon.com/de/alexa-skills-kit/smapi) enables Botium to talk to your Alexa skill.

It can be used as any other Botium connector with all Botium Stack components:
* [Botium CLI](https://github.com/codeforequity-at/botium-cli/)
* [Botium Bindings](https://github.com/codeforequity-at/botium-bindings/)
* [Botium Box](https://www.botium.at)

## Requirements

* __Node.js and NPM__
* an __Alexa Skill__, and user account with development rights
* a __project directory__ on your workstation to hold test cases and Botium configuration

## Install Botium and Amazon Alexa Skills API Connector

When using __Botium CLI__:

```
> npm install -g botium-cli
> npm install -g botium-connector-alexa-smapi
> botium-cli init
> botium-cli run
```

When using __Botium Bindings__:

```
> npm install -g botium-bindings
> npm install -g botium-connector-alexa-smapi
> botium-bindings init mocha
> npm install && npm run mocha
```

When using __Botium Box__:

_Already integrated into Botium Box, no setup required_

## Connecting Amazon Alexa Skills API to Botium

This connector includes a CLI wizard to initialize the _botium.json_ file holding your connection credentials.

_This wizard is part of Botium CLI as well._

    > npx botium-connector-alexa-smapi-cli init

This wizard will guide you through the Botium Connector setup. Please follow the instructions. It involves Copy&Paste from a web browser to this terminal window.

### Adapt botium.json

Open the file _botium.json_ in your working directory and add other settings if required.

```
{
  "botium": {
    "Capabilities": {
      "PROJECTNAME": "<whatever>",
      "CONTAINERMODE": "alexa-smapi",
      "ALEXA_SMAPI_API": "invocation",
      "ALEXA_SMAPI_SKILLID": "..."
    }
  }
}
```

Botium setup is ready, you can begin to write your [BotiumScript](https://github.com/codeforequity-at/botium-core/wiki/Botium-Scripting) files.

## Extracting Test Cases from the Alexa Interaction Model 

This connector provides a CLI interface for importing the Interaction Model from your skill and convert it to BotiumScript.

* Intents and Utterances are converted to BotiumScript utterances files
* Slots are filled with meaningful samples if possible
** You can hand over the samples to use with the _--slotsamples_ switch
** For default slot types, samples are loaded automatically from the [official documentation](https://developer.amazon.com/de/docs/custom-skills/slot-type-reference.html)
** For custom slot types, the samples from the interaction model are used

You can either run the CLI with botium-cli (it is integrated there), or directly from this connector (see samples/cli directory for some examples):

    > npx botium-connector-alexa-smapi-cli alexaimport --interactionmodel entityresolutionquizdemo.json

_Please note that a botium-core installation is required_

For getting help on the available CLI options and switches, run:

    > npx botium-connector-alexa-smapi-cli alexaimport --help

## Supported Capabilities

### CONTAINERMODE: "alexa-smapi"

Set the CONTAINERMODE capability to alexa-smapi

### ALEXA_SMAPI_API
_default: "simulation"_

Either "simulation" or "invocation" to use the respective [Skill Management API](https://developer.amazon.com/de/docs/smapi/skill-testing-operations.html)
* __Skill Simulation API__ handles plain text input (including intent resolution), but doesn't provide session tracking - only one-shot-conversations supported
* __Skill Invocation API__ handles structured input (intents and slots, no intent resolution done) and is therefore harder to use than the Simulation API

See the [samples](samples) directory for configuration and conversation samples.

### ALEXA_SMAPI_SKILLID

The Alexa Skill ID

### ALEXA_SMAPI_LOCALE
_default: "en-US"_

The locale used for the simulation / invocation - list of valid locales see [here](https://developer.amazon.com/de/docs/smapi/skill-simulation-api.html#request-attributes-definition)

### ALEXA_SMAPI_REFRESHTOKEN or ALEXA_SMAPI_ACCESSTOKEN

The long-living refresh token and (optionally) a short-living access token. Typically, the refresh token is created with the initialization wizard (see above), and the access token is created automatically on request.

### ALEXA_SMAPI_BASE_URL
_default: "https://api.amazonalexa.com"_

Skill Management API Url

### ALEXA_SMAPI_CLIENTID and ALEXA_SMAPI_CLIENTSECRET
From your Amazon Security Profile

### ALEXA_SMAPI_VENDORID
Amazon vendor id

### ALEXA_SMAPI_ENDPOINTREGION
_default: "default"_

The AWS Endpoint the Skill is linked to (only required for Skill Invocation API) - see [here](https://developer.amazon.com/de/docs/smapi/skill-invocation-api.html#request-attributes-definition)

### ALEXA_SMAPI_INVOCATION_TEXT_INTENT and ALEXA_SMAPI_INVOCATION_TEXT_SLOT

When using the Invocation API, tell Botium to use a special intent and a special slot to hand over the input text (intent resolution is done by Skill itself)

### ALEXA_SMAPI_INVOCATION_REQUEST_TEMPLATE
_default: the file invocation-request-template.json in this repository_

When using the Invocation API, tell Botium to use a special template for the invocation request (JSON formatted).

### ALEXA_SMAPI_AUDIO_CAPABILITY and ALEXA_SMAPI_DISPLAY_CAPABILITY
_default: false_

These will add Audio and Display capabilities when set to true to the invocation request sent to the Skill Management API.

### ALEXA_SMAPI_REFRESH_USER_ID
_default: false_

**This only works with the invocation API**

This will generate a new userId to send within each different convo.txt file. By default the userId is `botium-core-test-user` and when
generated the user will be `botium-core-test-user-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` with a randomly generated UUID.

### ALEXA_SMAPI_KEEP_AUDIO_PLAYER_STATE
_default: false_

**This only works with the invocation API**

If your skill contains audio player responses this will track the changes to the audio player such as the `token` and the `playerActivity`
and allow you to use intents such as `AudioPlayer.PlaybackNearlyFinished` and other `AudioPlayer` intents and get the state back on the response.