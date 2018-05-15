# botium-connector-alexa-smapi
Botium Connector for Amazon Alexa Skills API


# Setup environment

## Install ask-cli

## Initialize and retrieve AWS credentials


# Capabilities

## ALEXA_SMAPI_API
_default: "simulation"_

Either "simulation" or "invocation" to use the respective [Skill Management API](https://developer.amazon.com/de/docs/smapi/skill-testing-operations.html)
* __Skill Simulation API__ handles plain text input (including intent resolution)
* __Skill Invocation API__ handles intent input

## ALEXA_SMAPI_SKILLID

The Alexa Skill ID

## ALEXA_SMAPI_LOCALE
_default: "en-US"_

The locale used for the simulation (only required for Skill Simulation API) - list of valid locales see [here](https://developer.amazon.com/de/docs/smapi/skill-simulation-api.html#request-attributes-definition)

## AWS Credentials

If nothing of the below is configured, the ~/.ask/cli_config file will be read. This file was created during the initialization phase above. 

_In a CI/CD environment, it typically makes more sense to not rely on the presence of this file, but configure the access token with following capabilities_

### ALEXA_SMAPI_REFRESHTOKEN or ALEXA_SMAPI_ACCESSTOKEN

Copy on of these from the ~/.ask/cli_config file, typically it makes more sense to copy the refresh token (as the access token has a short expiry time).

### ALEXA_SMAPI_AWSPROFILE
_default: "default"_

If using multiple aws/ask profiles, specify the one to use



 





