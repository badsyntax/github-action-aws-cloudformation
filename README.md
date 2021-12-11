# AWS CloudFormation GitHub Action

[![Update Stack](https://github.com/badsyntax/github-action-aws-cloudformation/actions/workflows/deploy-stack.yml/badge.svg)](https://github.com/badsyntax/github-action-aws-cloudformation/actions/workflows/deploy-stack.yml)

A GitHub Action to create/update your CloudFormation stack to support Infrastructure as Code. 

## Motivation

The [official CloudFormation action](https://github.com/aws-actions/aws-cloudformation-github-deploy) is archived with no explanation why.

This Action is actively maintained and includes additional features.

## Features

- Apply or Preview ChangeSet with Pull Request comments
- Log intervals to show constant feedback
- CloudFormation outputs set as Action Outputs which can be used in subsequent steps

## Getting Started

Please read <https://github.com/aws-actions/aws-cloudformation-github-deploy#credentials-and-region>

```yaml
name: 'deploy'

concurrency:
  group: prod_deploy
  cancel-in-progress: false

on:
  repository_dispatch:
  pull_request:
  push:
    branches:
      - main
      - 'releases/*'

jobs:
  deploy-stack:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Update CloudFormation Stack
        id: update-stack
        uses: badsyntax/github-action-aws-cloudformation@v0.0.1
        if:
        with:
          # No need to create this token. Use the default token.
          githubToken: ${{ secrets.GITHUB_TOKEN }}
          stackName: 'example-cloudformation-stack'
          template: './cloudformation/s3bucket-example.yml'
          # Only apply the changeset on pushes to main/release
          applyChangeSet: ${{ github.event_name != 'pull_request' && github.event_name != 'repository_dispatch' }}
          awsRegion: 'us-east-1'
          parameters: 'S3BucketName=example-bucket-us-east-1&S3AllowedOrigins=https://example.com'

      - name: Deploy Website
        run: |
          # Now that the stack is created we can deploy our
          # website to the S3 bucket.
          echo "Deploy to S3 Bucket: $S3BucketName"
        env:
          # Use outputs from the CloudFormation Stack
          S3BucketName: ${{ steps.update-stack.outputs.S3BucketName }}
```

## ChangeSet Overview in Pull Requests

Pull request created and `applyChangeSet` is `false`:

<img src="./images/changeset-changes-comment.png" style="max-width: 700px" alt="Pull Request Comment" />

Pull request created and `applyChangeSet` is `true`:

<img src="./images/changeset-apply-comment.png" style="max-width: 700px" alt="Pull Request Comment" />

No stack changes:

<img src="./images/changeset-no-changes.png" style="max-width: 700px" alt="Pull Request Comment" />

## Debugging

Check the Action output for logs.

If you need to see more verbose logs you can set `ACTIONS_STEP_DEBUG` to `true` as an Action Secret.

## License

See [LICENSE.md](./LICENSE.md).
