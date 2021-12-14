import { Change, Output } from '@aws-sdk/client-cloudformation';
import github from '@actions/github';
import { setOutput } from '@actions/core';

export function checkIsValidGitHubEvent() {
  const action = github.context.action;
  switch (github.context.eventName) {
    case 'repository_dispatch':
    case 'workflow_dispatch':
    case 'push':
      return true;
    case 'pull_request':
      return ['opened', 'synchronize', 'reopened', 'closed'].includes(action);
  }
  throw new Error(`Invalid GitHub event: ${github.context.eventName}`);
}

export function logOutputParameters(outputs: Output[]): void {
  outputs.forEach((output) => {
    if (output.OutputKey) {
      setOutput(output.OutputKey, output.OutputValue);
    }
  });
  setOutput('outputs', JSON.stringify(outputs));
}

export function logChanges(changes: Change[]): void {
  setOutput('changes', JSON.stringify(changes));
}
