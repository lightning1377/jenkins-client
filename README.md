# Jenkins Client

[![Visual Studio Marketplace Installs](https://badgen.net/vs-marketplace/i/Siavash.jenkins-client?color=blue&icon=vscode)](https://marketplace.visualstudio.com/items?itemName=Siavash.jenkins-client)

Jenkins Client is a small VS Code extension that shows the Jenkins build result for the current Git branch directly in the status bar.

It is built for teams using Jenkins freestyle jobs with the Jenkins Git plugin, with support for branch-specific job mapping when different branches are built by different jobs.

<img src="./icon.png" alt="Jenkins Client icon" width="240">

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

## Using the Client API (Production Snippet)

If you need to query Jenkins programmatically using the underlying client implementation ([JenkinsService](src/services/jenkins-service.ts)), here is a clean, minimal TypeScript example of how to initialize and use it:

```typescript
import { JenkinsService } from "./services/jenkins-service";
import * as vscode from "vscode";

// Initialize the Jenkins service client
const outputChannel = vscode.window.createOutputChannel("Jenkins API Client");
const jenkinsClient = new JenkinsService(outputChannel, "your-api-token");

// Query build status for a specific branch
async function checkBranchBuild(branchName: string) {
    const isReady = await jenkinsClient.getIsReady();
    if (!isReady) {
        console.error("Jenkins service is not ready. Check URL, Username, and API Token.");
        return;
    }

    const jobName = jenkinsClient.getBranchJobName(branchName);
    console.log(`Querying job: ${jobName} for branch: ${branchName}`);

    // Fetch the build details of a specific build number
    const buildDetails = await jenkinsClient.getBuildDetails(branchName, 105);
    console.log(`Build #${buildDetails.number} result: ${buildDetails.result}`); // 'SUCCESS', 'FAILURE', etc.
}
```

## Why This Client?

Compared to making raw HTTP calls or using bulky external Jenkins libraries, this client is designed with the following advantages:

- **Zero Runtime Dependencies**: The client interacts directly with the Jenkins REST API using native `fetch` calls, eliminating external HTTP overhead and dependencies.
- **Built-in CSRF/Crumb Handling**: The client automatically issuer-checks and appends Jenkins CSRF crumb headers (`crumbIssuer/api/json`) to mutating requests, avoiding authentication blocks in secured environments.
- **Robust TypeScript Definitions**: Features type-safe structures (e.g., [BuildDetails](src/types/jenkins.ts) or [JobInfo](src/types/jenkins.ts)) mapping the Jenkins JSON response API.
- **Smart in-memory Caching**: Implements a localized query cache to prevent redundant HTTP requests and ensure sub-second UI updates in the VS Code status bar.

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

## Support the Project ⭐

This extension is freshly launched on the VS Code Marketplace! If this tool helps you stay on top of your Jenkins builds directly from your status bar, please consider supporting its development:

- **Star this repository** to improve its visibility on GitHub so other developers can discover it.
- **Leave a review** on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Siavash.jenkins-client&ssr=false#review-details) sharing your feedback.

### Feedback & Contributing

Found a bug or have a feature request? Please feel free to open an issue or submit a pull request on the [GitHub repository](https://github.com/lightning1377/jenkins-client).
