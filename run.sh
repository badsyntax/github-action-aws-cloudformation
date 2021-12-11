#!/usr/bin/env bash

INPUT_STACKNAME="richardwillis-github-action-example-cloudformation-stack" \
    INPUT_TEMPLATE="./cloudformation/s3bucket-example.yml" \
    INPUT_PREVIEW="false" \
    INPUT_AWSREGION="us-east-1" \
    INPUT_PARAMETERS="S3BucketName=richardwillis.info-example-bucket-us-east-1&S3AllowedOrigins=https://richardwillis.info" \
    GITHUB_EVENT_NAME="pull_request" \
    GITHUB_ACTION="synchronize" \
    GITHUB_REPOSITORY="badsyntax/github-action-aws-cloudformation" \
    node lib/main.js
