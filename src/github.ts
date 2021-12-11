import { Change, Output, Stack } from '@aws-sdk/client-cloudformation';
import github from '@actions/github';
import { markdownTable } from 'markdown-table';
import type { PullRequestEvent } from '@octokit/webhooks-definitions/schema';
import { info } from '@actions/core';

export const isPullRequest = github.context.eventName === 'pull_request';
export const isPullRequestClosed =
  isPullRequest &&
  (github.context.payload as PullRequestEvent).action === 'closed';
export const prBranchName = github.context.payload.pull_request?.head.ref;

function getChangeSetTable(changes: Change[], applyChangeSet: boolean): string {
  if (!changes.length) {
    return '';
  }
  const headings = [['', 'ResourceType', 'LogicalResourceId', 'Action']];
  const rows = changes.map((change) => [
    applyChangeSet ? '✅' : '⚠️',
    String(change.ResourceChange?.ResourceType),
    String(change.ResourceChange?.LogicalResourceId),
    String(change.ResourceChange?.Action),
  ]);
  return markdownTable(headings.concat(rows), {
    align: headings[0].map(() => 'l'),
  });
}

function getOutputsTable(stack: Stack): string {
  const outputs = stack.Outputs || [];
  if (!outputs.length) {
    return '';
  }
  const headings = [['Key', 'Value', 'Description']];
  const rows = outputs.map((output) => [
    output.OutputKey || '',
    output.OutputValue || '',
    output.Description || '',
  ]);
  return markdownTable(headings.concat(rows), {
    align: headings[0].map(() => 'l'),
  });
}

function getStackChangesMessage(changeSetTable: string): string {
  return changeSetTable
    ? `**ChangeSet:**\n\n${changeSetTable}`
    : `✔️ No Stack changes
`;
}

function getStackOutputsMessage(outputsTable: string): string {
  return outputsTable ? `**Outputs:**\n\n${outputsTable}` : '';
}

function getCommentMarkdown(
  changeSetTable: string,
  outputsTable: string
): string {
  const changesMessage = getStackChangesMessage(changeSetTable);
  const outputsMessage = getStackOutputsMessage(outputsTable);
  return `${changesMessage}${outputsMessage ? '\n\n' : ''}${outputsMessage}`;
}

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

export async function addPRCommentWithChangeSet(
  changes: Change[],
  gitHubToken: string,
  applyChangeSet: boolean,
  stack?: Stack
): Promise<void> {
  await maybeDeletePRComment(gitHubToken);

  const changeSetTable = getChangeSetTable(changes, applyChangeSet);
  const outputsTable = stack ? getOutputsTable(stack) : '';
  const markdown = getCommentMarkdown(changeSetTable, outputsTable);

  const issue = github.context.issue;
  const commentId = generateCommentId(issue);
  const body = `${commentId}\n\n${markdown}`;

  const octokit = github.getOctokit(gitHubToken);

  await octokit.rest.issues.createComment({
    issue_number: issue.number,
    body: body,
    owner: issue.owner,
    repo: issue.repo,
  });
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
    info(`::set-output name=${output.OutputKey}::${output.OutputValue}`);
  });
}
