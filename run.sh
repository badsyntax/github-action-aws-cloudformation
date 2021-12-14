#!/usr/bin/env bash

INPUT_STACKNAME="badsyntax-github-action-example-aws-cloudformation" \
    INPUT_TEMPLATE="./cloudformation/s3bucket-example.yml" \
    INPUT_PREVIEW="false" \
    INPUT_AWSREGION="us-east-1" \
    INPUT_PARAMETERS="S3BucketName=badsyntax-github-action-example-aws-cloudformation-us-east-12&S3AllowedOrigins=https://richardwillis.info" \
    INPUT_APPLYCHANGESET="false" \
    GITHUB_EVENT_NAME="pull_request" \
    GITHUB_ACTION="synchronize" \
    GITHUB_REPOSITORY="badsyntax/github-action-aws-cloudformation" \
    node dist/index.js
