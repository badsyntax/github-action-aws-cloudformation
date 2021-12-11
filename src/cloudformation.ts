import { debug, info, notice, warning } from '@actions/core';
import {
  Parameter,
  CloudFormationClient,
  StackSummary,
  ListStacksCommand,
  StackStatus,
  Capability,
  DescribeStacksCommand,
  DeleteStackCommand,
  Stack,
  CreateChangeSetCommand,
  ChangeSetType,
  DescribeChangeSetCommand,
  Change,
  ChangeSetStatus,
  CreateChangeSetCommandOutput,
  DeleteChangeSetCommand,
  DeleteChangeSetCommandOutput,
  ExecuteChangeSetCommand,
  ValidateTemplateCommand,
} from '@aws-sdk/client-cloudformation';

import { defaultDelayMs } from './constants.js';
import { addPRCommentWithChangeSet, isPullRequest } from './github.js';
import { delay } from './util.js';

let rollbackDetected = false;

function logStackStatus(status: StackStatus): void {
  if (status === StackStatus.ROLLBACK_IN_PROGRESS && !rollbackDetected) {
    rollbackDetected = true;
    warning(
      `${StackStatus.ROLLBACK_IN_PROGRESS} detected! **Check the CloudFormation events in the AWS Console for more information.** ` +
        `${StackStatus.ROLLBACK_IN_PROGRESS} can take a while to complete. ` +
        `You can manually delete the CloudFormation stack in the AWS Console or just wait until this process completes...`
    );
  }
  info(`StackStatus: ${status}`);
}

function logChangeSetStatus(status: ChangeSetStatus): void {
  info(`ChangeSet: ${status}`);
}

async function getAllStacks(
  client: CloudFormationClient,
  nextToken?: string,
  allStacks: StackSummary[] = []
): Promise<StackSummary[]> {
  const response = await client.send(
    new ListStacksCommand({
      NextToken: nextToken,
    })
  );
  const stacks = allStacks.concat(response.StackSummaries || []);
  if (response.NextToken) {
    return getAllStacks(client, response.NextToken, stacks);
  }
  debug(`Found ${stacks.length} stacks`);
  return stacks;
}

async function getExistingStack(
  client: CloudFormationClient,
  cfStackName: string
): Promise<StackSummary | void> {
  debug(`Searching for existing stack with name: ${cfStackName}`);
  const allStacks = await getAllStacks(client);
  return allStacks.find(
    (stack) =>
      stack.StackName === cfStackName &&
      stack.StackStatus !== StackStatus.DELETE_COMPLETE
  );
}

async function hasCreatedStack(
  client: CloudFormationClient,
  cfStackName: string
): Promise<boolean> {
  const stack = await getExistingStack(client, cfStackName);
  return stack !== undefined;
}

async function waitForStackStatus(
  client: CloudFormationClient,
  cfStackName: string,
  status: StackStatus,
  delayMs = defaultDelayMs
): Promise<void> {
  try {
    const stack = await describeStack(client, cfStackName);
    logStackStatus(stack.StackStatus as StackStatus);
    if (stack.StackStatus !== status) {
      await delay(delayMs);
      await waitForStackStatus(client, cfStackName, status, delayMs);
    }
  } catch (e) {
    debug(
      `Unable to wait for status ${status} because ${(e as Error).message}`
    );
  }
}

async function applyChangeSetAndWait(
  client: CloudFormationClient,
  cfStackName: string,
  changeSetId: string
): Promise<Stack> {
  await client.send(
    new ExecuteChangeSetCommand({
      StackName: cfStackName,
      ChangeSetName: changeSetId,
    })
  );
  const stack = await waitForCompleteOrFailed(client, cfStackName);
  return stack;
}

async function describeStack(
  client: CloudFormationClient,
  cfStackName: string
): Promise<Stack> {
  const response = await client.send(
    new DescribeStacksCommand({
      StackName: cfStackName,
    })
  );
  if (!response.Stacks?.length) {
    throw new Error('Stack not found');
  }
  return response.Stacks[0];
}

async function waitForCompleteOrFailed(
  client: CloudFormationClient,
  cfStackName: string,
  delayMs = defaultDelayMs,
  completeOrFailedStatuses = [
    StackStatus.CREATE_COMPLETE,
    StackStatus.CREATE_FAILED,
    StackStatus.DELETE_COMPLETE,
    StackStatus.DELETE_FAILED,
    StackStatus.IMPORT_COMPLETE,
    StackStatus.IMPORT_ROLLBACK_COMPLETE,
    StackStatus.IMPORT_ROLLBACK_FAILED,
    StackStatus.ROLLBACK_COMPLETE,
    StackStatus.ROLLBACK_FAILED,
    StackStatus.UPDATE_COMPLETE,
    StackStatus.UPDATE_FAILED,
    StackStatus.UPDATE_ROLLBACK_COMPLETE,
    StackStatus.UPDATE_ROLLBACK_FAILED,
  ]
): Promise<Stack> {
  try {
    const stack = await describeStack(client, cfStackName);
    logStackStatus(stack.StackStatus as StackStatus);
    if (!completeOrFailedStatuses.includes(stack.StackStatus as StackStatus)) {
      await delay(delayMs);
      return await waitForCompleteOrFailed(client, cfStackName, delayMs);
    }
    return stack;
  } catch (e) {
    throw e;
  }
}

async function deleteExistingStack(
  client: CloudFormationClient,
  cfStackName: string
) {
  await client.send(
    new DeleteStackCommand({
      StackName: cfStackName,
    })
  );
  await waitForStackStatus(client, cfStackName, StackStatus.DELETE_COMPLETE);
  notice(`Stack ${cfStackName} successfully deleted`);
}

function shouldDeleteExistingStack(stack: Stack): boolean {
  // If the StackStatus is ROLLBACK_COMPLETE then we cannot update it.
  // If the StackStatus is REVIEW_IN_PROGRESS then we can't update it.
  return (
    stack.StackStatus === StackStatus.ROLLBACK_COMPLETE ||
    stack.StackStatus === StackStatus.REVIEW_IN_PROGRESS
  );
}

async function createChangeSet(
  client: CloudFormationClient,
  cfStackName: string,
  changeSetType: ChangeSetType,
  cfTemplateBody: string,
  parameters: Parameter[]
) {
  return client.send(
    new CreateChangeSetCommand({
      TemplateBody: cfTemplateBody,
      StackName: cfStackName,
      ChangeSetName: `test-changeset-${Date.now()}`,
      ChangeSetType: changeSetType,
      Parameters: parameters,
      Capabilities: [Capability.CAPABILITY_IAM],
    })
  );
}

async function deleteChangeSet(
  client: CloudFormationClient,
  cfStackName: string,
  changeSetId: string
): Promise<DeleteChangeSetCommandOutput> {
  return client.send(
    new DeleteChangeSetCommand({
      StackName: cfStackName,
      ChangeSetName: changeSetId,
    })
  );
}

async function describeChangeSet(
  client: CloudFormationClient,
  cfStackName: string,
  changeSetId: string,
  nextToken?: string,
  delayMs = defaultDelayMs
): Promise<Change[]> {
  const response = await client.send(
    new DescribeChangeSetCommand({
      StackName: cfStackName,
      ChangeSetName: changeSetId,
      NextToken: nextToken,
    })
  );
  if (response.Status === ChangeSetStatus.FAILED) {
    debug(`ChangeSet failed: ${response.StatusReason}`);
    return [];
  }
  if (response.NextToken) {
    return await describeChangeSet(
      client,
      cfStackName,
      changeSetId,
      response.NextToken
    );
  }
  logChangeSetStatus(response.Status as ChangeSetStatus);
  if (response.Status !== ChangeSetStatus.CREATE_COMPLETE) {
    await delay(delayMs);
    return await describeChangeSet(
      client,
      cfStackName,
      changeSetId,
      response.NextToken
    );
  }
  return response.Changes || [];
}

async function getChanges(
  client: CloudFormationClient,
  cfStackName: string,
  changeSet: CreateChangeSetCommandOutput
) {
  if (!changeSet.Id) {
    throw new Error('ChangSet did not generate an ARN');
  }
  info(`Generating list of Stack changes...`);
  return describeChangeSet(client, cfStackName, changeSet.Id);
}

async function getChangeSetType(
  client: CloudFormationClient,
  cfStackName: string,
  parameters: Parameter[]
): Promise<ChangeSetType> {
  const hasExistingStack = await hasCreatedStack(client, cfStackName);

  debug(`Found existing stack: ${String(hasExistingStack)}`);
  debug(
    `Using parameters: ${parameters
      .map((p) => `${p.ParameterKey}: ${p.ParameterValue}`)
      .join(', ')}`
  );

  let update = false;

  // When a ChangeSet is created for a stack that does not exist, a new stack will be
  // created with status REVIEW_IN_PROGRESS, and we can't generate a new
  // ChangeSet against this stack, which is why we have to delete it first.

  if (hasExistingStack) {
    const stack = await describeStack(client, cfStackName);
    const shouldDelete = shouldDeleteExistingStack(stack);
    if (shouldDelete) {
      warning(
        `Deleting existing stack ${cfStackName}, due to ${stack.StackStatus} status`
      );
      await deleteExistingStack(client, cfStackName);
    } else {
      update = true;
    }
  }

  return update ? ChangeSetType.UPDATE : ChangeSetType.CREATE;
}

async function validateTemplate(
  client: CloudFormationClient,
  templateBody: string
): Promise<void> {
  await client.send(
    new ValidateTemplateCommand({
      TemplateBody: templateBody,
    })
  );
}

export function getCloudFormationParameters(
  parametersQuery: string
): Parameter[] {
  const params = new URLSearchParams(parametersQuery);
  const cfParams: Parameter[] = [];
  for (const key of params.keys()) {
    cfParams.push({
      ParameterKey: key.trim(),
      ParameterValue: params.get(key)?.trim() || undefined,
    });
  }
  return cfParams;
}

type UpdateCloudFormationStackResponse = {
  changes: Change[];
  stack?: Stack;
};

export async function updateCloudFormationStack(
  client: CloudFormationClient,
  cfStackName: string,
  gitHubToken: string,
  applyChangeSet: boolean,
  cfTemplateBody: string,
  cfParameters: Parameter[]
): Promise<UpdateCloudFormationStackResponse> {
  await validateTemplate(client, cfTemplateBody);
  const changeSetType = await getChangeSetType(
    client,
    cfStackName,
    cfParameters
  );

  const changeSet = await createChangeSet(
    client,
    cfStackName,
    changeSetType,
    cfTemplateBody,
    cfParameters
  );

  const changes = await getChanges(client, cfStackName, changeSet);

  const stack: Stack | undefined = undefined;

  if (changeSet.Id) {
    if (changes.length) {
      if (applyChangeSet) {
        info(`Applying ChangeSet, this can take a while...`);
        await applyChangeSetAndWait(client, cfStackName, changeSet.Id);
        notice(`Successfully applied Stack ChangeSet`);
      }
    } else {
      info('(No Stack changes)');
      await deleteChangeSet(client, cfStackName, changeSet.Id);
      info('Successfully deleted ChangeSet');
    }
    if (rollbackDetected) {
      throw new Error('Rollback detected, stack creation failed');
    } else if (isPullRequest) {
      const stack = await describeStack(client, cfStackName);
      await addPRCommentWithChangeSet(
        changes,
        gitHubToken,
        applyChangeSet,
        stack
      );
    }
  }

  return {
    changes,
    stack,
  };
}
