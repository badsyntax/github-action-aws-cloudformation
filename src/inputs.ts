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

  const token = getInput('token', {
    required: true,
    trimWhitespace: true,
  });

  const parameters = getInput('parameters', {
    required: true,
    trimWhitespace: true,
  });

  const preview =
    getInput('preview', {
      required: true,
      trimWhitespace: true,
    }).toLowerCase() === 'true';

  return {
    stackName,
    region,
    template,
    token,
    preview,
    parameters,
  };
}
