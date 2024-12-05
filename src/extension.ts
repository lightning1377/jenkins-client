// import * as fs from "fs";
import * as vscode from "vscode";
import { JenkinsService } from "./services/jenkins-service";
import { GitService } from "./services/git-service";
import { StatusBarManager } from "./ui/status-bar-manager";

let statusBarManager: StatusBarManager;
let pollingInterval: NodeJS.Timeout | null = null;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const showBuildStatusCommand = "jenkins-build-status.showBuildStatus";

    // Create an Output Channel for Jenkins Build Status
    const outputChannel = vscode.window.createOutputChannel("Jenkins Build Status");

    // Initialize jenkins service
    const jenkinsService = new JenkinsService(outputChannel);
    const isJenkinsConnected = await jenkinsService.getIsReady();
    if (!isJenkinsConnected) {
        outputChannel.appendLine("Not connected to Jenkins api, Extension was not activated, Check your configuration and reload");
        return;
    }

    outputChannel.appendLine("Jenkins Connection Established.");

    // Initialize git service
    const gitService = new GitService(outputChannel);

    // Initialize status bar manager
    statusBarManager = new StatusBarManager(showBuildStatusCommand);
    context.subscriptions.push(statusBarManager.statusBarItem);

    const config = vscode.workspace.getConfiguration("jenkinsBuildStatus");
    const minPollWaitTime = config.get<number>("minPollWaitTime") ?? 5;
    const maxPollCount = config.get<number>("maxPollCount") ?? 60;

    const disposable = vscode.commands.registerCommand(showBuildStatusCommand, async () => {
        try {
            const minWaitTimePromise = new Promise((resolve) => setTimeout(resolve, minPollWaitTime * 1000));
            const branchName = await gitService.getCurrentBranch();
            if (!branchName) {
                statusBarManager.setStatusToUnknown(false);
                return;
            }
            const commitHash = await gitService.getRemoteCommitHash(branchName);
            const buildDetails = await jenkinsService.getCommitBuild(commitHash, branchName);
            if (!buildDetails) {
                statusBarManager.setStatusToUnknown(false);
                return;
            }

            const isInProgress = statusBarManager.updateStatus(buildDetails);

            if (isInProgress) {
                let pollCounter = maxPollCount;
                let _isInProgress = true;
                let _buildDetails = buildDetails;
                while (_isInProgress && pollCounter > 0) {
                    pollCounter--;
                    await minWaitTimePromise;
                    _buildDetails = await jenkinsService.getBuildDetails(branchName, _buildDetails.number);
                    _isInProgress = statusBarManager.updateStatus(_buildDetails);
                }
            }
        } catch (error) {
            statusBarManager.setStatusToUnknown(false);
            outputChannel.appendLine(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    context.subscriptions.push(disposable);

    // Initial status check
    vscode.commands.executeCommand(showBuildStatusCommand);

    pollingInterval = await gitService.startPollingForPushEvent({
        onPush: async (commitHash, branchName) => {
            statusBarManager.setStatusToUnknown(true);
            await jenkinsService.pollForCommitHash({ commitHash, branchName, minPollWaitTime, showBuildStatusCommand });
        }
    });
}

export function deactivate(): void {
    if (statusBarManager) {
        statusBarManager.dispose();
    }
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }
}
