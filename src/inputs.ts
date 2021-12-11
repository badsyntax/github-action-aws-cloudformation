import { getInput } from '@actions/core';

export function getInputs() {
  const stackName = getInput('stackName', {
    required: true,
    trimWhitespace: true,
  });

  const region = getInput('awsRegion', {
    required: true,
    trimWhitespace: true,
  });

  const template = getInput('template', {
    required: true,
    trimWhitespace: true,
  });

  const gitHubToken = getInput('gitHubToken', {
    required: true,
    trimWhitespace: true,
  });

  const parameters = getInput('parameters', {
    required: true,
    trimWhitespace: true,
  });

  const applyChangeSet =
    getInput('applyChangeSet', {
      required: true,
      trimWhitespace: true,
    }).toLowerCase() === 'true';

  return {
    stackName,
    region,
    template,
    gitHubToken,
    applyChangeSet,
    parameters,
  };
}
