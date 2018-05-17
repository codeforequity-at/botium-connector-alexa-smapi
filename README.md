# Botium Connector for Amazon Alexa Skills API

Botium Connector for Amazon Alexa Skills API


# Setup environment

The Amazon Skill Developer Kit has to be installed and configured to retrieve the credentials for accessing the Skill. 


## Install and Initialize ASK CLI

Follow [Amazon's instructions](https://developer.amazon.com/de/docs/smapi/quick-start-alexa-skills-kit-command-line-interface.html) to install and initialize the AWS profile and the Amazon Skill Developer Kit. You have to provide your Amazon username/password in this step.

## Retrieve AWS credentials

The credentials are stored in the file ~/.ask/cli_config - you can either copy & paste the credentials out of this file and use Botium capabilities for configuration, or rely on Botium to read this file automatically. 

# Capabilities

This Botium connector can be used as any other Botium connector. It has to be installed in your Botium project first:

	> npm install --save botium-connector-alexa-smapi

## CONTAINERMODE: "alexa-smapi"

Set the CONTAINERMODE capability to alexa-smapi

## ALEXA_SMAPI_API
_default: "simulation"_

Either "simulation" or "invocation" to use the respective [Skill Management API](https://developer.amazon.com/de/docs/smapi/skill-testing-operations.html)
* __Skill Simulation API__ handles plain text input (including intent resolution), but doesn't provide session tracking - only one-shot-conversations supported
* __Skill Invocation API__ handles structured input (intents and slots, no intent resolution done) and is therefore harder to use than the Simulation API

See the [samples](samples) directory for code and conversation samples.

## ALEXA_SMAPI_SKILLID

The Alexa Skill ID

## ALEXA_SMAPI_LOCALE
_default: "en-US"_

The locale used for the simulation / invocation - list of valid locales see [here](https://developer.amazon.com/de/docs/smapi/skill-simulation-api.html#request-attributes-definition)

## AWS Credentials

If nothing of the below is configured, the ~/.ask/cli_config file will be read. This file was created during the initialization phase above. 

_In a CI/CD environment, it typically makes more sense to not rely on the presence of this file, but configure the access token with following capabilities_

### ALEXA_SMAPI_REFRESHTOKEN or ALEXA_SMAPI_ACCESSTOKEN

Copy on of these from the ~/.ask/cli_config file, typically it makes more sense to copy the refresh token (as the access token has a short expiry time).

### ALEXA_SMAPI_AWSPROFILE
_default: "default"_

If using multiple aws/ask profiles, specify the one to use

### ALEXA_SMAPI_ENDPOINTREGION
_default: "default"_

The AWS Endpoint the Skill is linked to (only required for Skill Invocation API)

## ALEXA_SMAPI_INVOCATION_TEXT_INTENT and ALEXA_SMAPI_INVOCATION_TEXT_SLOT

When using the Invocation API, tell Botium to use a special intent and a special slot to hand over the input text (intent resolution is done by Skill itself)
