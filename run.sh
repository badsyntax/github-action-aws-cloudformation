#!/usr/bin/env bash

env 'INPUT_STACK-NAME=badsyntax-github-action-example-aws-cloudformation' \
    INPUT_TEMPLATE="./cloudformation/s3bucket-example.yml" \
    INPUT_PREVIEW="false" \
    env 'INPUT_AWS-REGION=us-east-1' \
    INPUT_PARAMETERS="S3BucketName=badsyntax-github-action-example-aws-cloudformation-us-east-12&S3AllowedOrigins=https://richardwillis.info" \
    env 'INPUT_APPLY-CHANGE-SET=false' \
    INPUT_CAPABILITIES="false" \
    GITHUB_EVENT_NAME="pull_request" \
    GITHUB_ACTION="synchronize" \
    GITHUB_REPOSITORY="badsyntax/github-action-aws-cloudformation" \
    node dist/index.js
