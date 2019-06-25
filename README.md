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

The Amazon Skill Developer Kit has to be installed and configured to retrieve the credentials for accessing the Skill. 

### Install and Initialize ASK CLI

Follow [Amazon's instructions](https://developer.amazon.com/de/docs/smapi/quick-start-alexa-skills-kit-command-line-interface.html) to install and initialize the AWS profile and the Amazon Skill Developer Kit. You have to provide your Amazon username/password in this step.

### Retrieve AWS credentials

The credentials are stored in the file ~/.ask/cli_config - you can either copy & paste the credentials out of this file and use Botium capabilities for configuration, or rely on Botium to read this file automatically. 

### Adapt botium.json

Open the file _botium.json_ in your working directory and add the Skill settings:

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

### AWS Credentials

If nothing of the below is configured, the ~/.ask/cli_config file will be read. This file was created during the initialization phase above. 

_In a CI/CD environment, it typically makes more sense to not rely on the presence of this file, but configure the access token with following capabilities_

#### ALEXA_SMAPI_REFRESHTOKEN or ALEXA_SMAPI_ACCESSTOKEN

Copy on of these from the ~/.ask/cli_config file, typically it makes more sense to copy the refresh token (as the access token has a short expiry time).

#### ALEXA_SMAPI_CALL_TIMEOUT
_default: 10000_

Given in milliseconds.

Botium will bring an error if the SMAPI request doesn't return within a short period of time. In this case most likely the refresh token is invalid.

#### ALEXA_SMAPI_AWSPROFILE
_default: "default"_

If using multiple aws/ask profiles, specify the one to use

#### ALEXA_SMAPI_ENDPOINTREGION
_default: "default"_

The AWS Endpoint the Skill is linked to (only required for Skill Invocation API) - see [here](https://developer.amazon.com/de/docs/smapi/skill-invocation-api.html#request-attributes-definition)

### ALEXA_SMAPI_INVOCATION_TEXT_INTENT and ALEXA_SMAPI_INVOCATION_TEXT_SLOT

When using the Invocation API, tell Botium to use a special intent and a special slot to hand over the input text (intent resolution is done by Skill itself)

### ALEXA_SMAPI_AUDIO_CAPABILITY and ALEXA_SMAPI_DISPLAY_CAPABILITY
_default: false

These will add Audio and Display capabilities when set to true to the invocation request sent to the Skill Management API.

### ALEXA_SMAPI_REFRESH_USER_ID
_default: false

This will generate a new userId to send within each different conv.txt file. By default the userId is `botium-core-test-user` and when
generated the user will be `botium-core-test-user-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` with a randomly generated UUID.
