import { Change } from '@aws-sdk/client-cloudformation';
import github from '@actions/github';
import { markdownTable } from 'markdown-table';
import type { PullRequestEvent } from '@octokit/webhooks-definitions/schema';

export const isPullRequest = github.context.eventName === 'pull_request';
export const isPullRequestClosed =
  isPullRequest &&
  (github.context.payload as PullRequestEvent).action === 'closed';
export const prBranchName = github.context.payload.pull_request?.head.ref;

function getChangeSetTable(changes: Change[], preview: boolean): string {
  if (!changes.length) {
    return '';
  }
  const headings = [['', 'ResourceType', 'LogicalResourceId', 'Action']];
  const rows = changes.map((change) => [
    preview ? '⚠️' : '✅',
    String(change.ResourceChange?.ResourceType),
    String(change.ResourceChange?.LogicalResourceId),
    String(change.ResourceChange?.Action),
  ]);
  return markdownTable(headings.concat(rows), {
    align: headings.map(() => 'l'),
  });
}

function getStackChangesMessage(
  changes: Change[],
  changeSetTable: string
): string {
  return changes.length
    ? changeSetTable
    : `
(No Stack changes)
`;
}

function getCommentMarkdown(changes: Change[], changeSetTable: string): string {
  return getStackChangesMessage(changes, changeSetTable);
}

export function generateCommentId(issue: typeof github.context.issue): string {
  return `AWS CloudFormation ChangeSet (ID:${issue.number})`;
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
  preview: boolean
): Promise<void> {
  await maybeDeletePRComment(gitHubToken);

  const changeSetTable = getChangeSetTable(changes, preview);
  const markdown = getCommentMarkdown(changes, changeSetTable);

  const issue = github.context.issue;
  const commentId = generateCommentId(issue);
  const body = `${commentId}\n${markdown}`;
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
