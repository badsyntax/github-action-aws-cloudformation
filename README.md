# AWS CloudFormation GitHub Action

[![Deploy Stack](https://github.com/badsyntax/github-action-aws-cloudformation/actions/workflows/deploy-stack.yml/badge.svg)](https://github.com/badsyntax/github-action-aws-cloudformation/actions/workflows/deploy-stack.yml)

A GitHub Action to create/update your CloudFormation stack.

## Getting Started

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

      - name: Deploy
        uses: badsyntax/github-action-cloudformation@v0.0.1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          stack-name: 'example-cloudformation-stack'
          template: './cloudformation/s3bucket-example.yml'
          preview: true
          aws-region: 'us-east-1'
          parameters: 'S3BucketName=example-bucket-us-east-1&S3AllowedOrigins=https://example.com'
```

See [LICENSE.md](./LICENSE.md).
