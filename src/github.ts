import { Change, Output } from '@aws-sdk/client-cloudformation';
import github from '@actions/github';
import type { PullRequestEvent } from '@octokit/webhooks-definitions/schema';
import { setOutput } from '@actions/core';

export const isPullRequest = github.context.eventName === 'pull_request';
export const isPullRequestClosed =
  isPullRequest &&
  (github.context.payload as PullRequestEvent).action === 'closed';
export const prBranchName = github.context.payload.pull_request?.head.ref;

export function generateCommentId(issue: typeof github.context.issue): string {
  return `AWS CloudFormation (ID:${issue.number})`;
}

export async function maybeDeletePRComment(gitHubToken: string): Promise<void> {
  const issue = github.context.issue;
  const commentId = generateCommentId(issue);
  const octokit = github.getOctokit(gitHubToken);

  const comments = await octokit.rest.issues.listComments({
    issue_number: issue.number,
    owner: issue.owner,
    repo: issue.repo,
  });

  const existingComment = comments.data.find((comment) =>
    comment.body?.startsWith(commentId)
  );

  if (existingComment) {
    await octokit.rest.issues.deleteComment({
      issue_number: issue.number,
      owner: issue.owner,
      repo: issue.repo,
      comment_id: existingComment.id,
    });
  }
}

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
