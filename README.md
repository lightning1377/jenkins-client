# Jenkins Client

Jenkins Client is a small VS Code extension that shows the Jenkins build result for the current Git branch directly in the status bar.

It is built for teams using Jenkins freestyle jobs with the Jenkins Git plugin, with support for branch-specific job mapping when different branches are built by different jobs.

## Features

- Shows Jenkins build status in the VS Code status bar
- Refreshes the status manually from the status bar menu
- Detects pushed commits and checks Jenkins after the remote branch updates
- Supports success, failure, unstable, aborted, in-progress, and unknown states
- Supports default and branch-specific Jenkins jobs
- Keeps the Jenkins API token in VS Code Secret Storage

## Requirements

- VS Code 1.80.0 or newer
- A Git workspace with an `origin` remote
- Access to a Jenkins server
- A Jenkins username and API token
- Jenkins freestyle jobs using the Jenkins Git plugin

## Setup

1. Install the extension.
2. Open a Git workspace that is built by Jenkins.
3. Configure the extension settings:

```json
{
  "jenkinsBuildStatus.jenkinsUrl": "https://jenkins.example.com",
  "jenkinsBuildStatus.username": "your-jenkins-user",
  "jenkinsBuildStatus.jobName": "My Jenkins Job"
}
```

4. Run **Jenkins: Set Jenkins API Token** from the command palette.
5. Reload the window or run **Jenkins: Show Jenkins Client Status**.

## Branch-Specific Jobs

Use `branchSpecificJobs` when some branches are built by a Jenkins job other than the default `jobName`.

```json
{
  "jenkinsBuildStatus.jobName": "Main Build",
  "jenkinsBuildStatus.branchSpecificJobs": {
    "release/1.0": "Release Build",
    "develop": "Develop Build"
  }
}
```

If a branch is not listed in `branchSpecificJobs`, the extension uses `jobName`.

## Ignored Branches

Use `excludeBranches` for branches that are not built by Jenkins.

```json
{
  "jenkinsBuildStatus.excludeBranches": ["docs", "prototype"]
}
```

## Commands

- **Jenkins: Show Jenkins Client Status** - refresh the current branch status
- **Jenkins: Clear Jenkins Service Cache** - clear cached Jenkins build data
- **Jenkins: Set Jenkins API Token** - save your Jenkins API token in VS Code Secret Storage
- **Jenkins: Clear Jenkins API Token** - remove the saved Jenkins API token

## Limitations

This extension currently targets Jenkins freestyle jobs that expose build metadata from the Jenkins Git plugin. Other Jenkins setups, such as pipelines or multibranch pipelines, may need additional mapping or API support.

## Development

```bash
npm install
npm run compile
```

To debug the extension, open this folder in VS Code and run the **Launch Extension** configuration.

## Packaging

```bash
npm run vsce
```

The packaged VSIX is written to `releases/`.

## Releasing

1. Update `version` in `package.json` and `package-lock.json`.
2. Commit the version change.
3. Create and push a matching tag:

```bash
git tag v0.1.0
git push origin main
git push origin v0.1.0
```

GitHub Actions builds the VSIX and attaches it to a GitHub Release when a `v*.*.*` tag is pushed.

## Release Notes

See [CHANGELOG.md](CHANGELOG.md).
