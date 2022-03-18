import { getInput } from '@actions/core';

export function getInputs() {
  const stackName = getInput('stack-name', {
    required: true,
    trimWhitespace: true,
  });

  const region = getInput('aws-region', {
    required: true,
    trimWhitespace: true,
  });

  const template = getInput('template', {
    required: true,
    trimWhitespace: true,
  });

  const parameters = getInput('parameters', {
    required: false,
    trimWhitespace: true,
  });

  const capabilities = getInput('capabilities', {
    required: false,
    trimWhitespace: true,
  });

  const applyChangeSet =
    getInput('apply-change-set', {
      required: true,
      trimWhitespace: true,
    }).toLowerCase() === 'true';

  return {
    stackName,
    region,
    template,
    applyChangeSet,
    parameters,
    capabilities,
  };
}
