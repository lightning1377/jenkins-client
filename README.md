# Jenkins Build Status VS Code Extension

This extension integrates Jenkins build results into VS Code, showing the build status for your current git branch.

## Features

- Shows Jenkins build status in the VS Code status bar
- Updates build status automatically
- Supports different build states (success, failure, unstable, etc.)
- Configurable Jenkins server settings

## Requirements

- VS Code 1.80.0 or higher
- Access to a Jenkins server
- Git repository

## Extension Settings

This extension contributes the following settings:

* `jenkinsBuildStatus.jenkinsUrl`: Jenkins server URL
* `jenkinsBuildStatus.username`: Jenkins username
* `jenkinsBuildStatus.apiToken`: Jenkins API token
* `jenkinsBuildStatus.jobName`: Jenkins job name

## Usage

1. Configure the extension settings with your Jenkins credentials
2. The status bar will show your current branch's build status
3. Click the status bar item to refresh the status
4. Hover over the status bar item to see detailed information

## Known Issues

- None currently reported

## Release Notes

### 0.1.0

Initial release of Jenkins Build Status extension