import * as vscode from "vscode";
import { JenkinsService } from "./services/jenkins-service";
import { GitService } from "./services/git-service";
import { StatusBarManager } from "./ui/status-bar-manager";

let pollCounter: number;

let statusBarManager: StatusBarManager;

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
    const gitService = new GitService();

    // Initialize status bar manager
    statusBarManager = new StatusBarManager(showBuildStatusCommand);

    const config = vscode.workspace.getConfiguration("jenkinsBuildStatus");
    const minPollWaitTime = config.get<number>("minPollWaitTime") ?? 5;
    const maxPollCount = config.get<number>("maxPollCount") ?? 60;

    pollCounter = maxPollCount;

    const disposable = vscode.commands.registerCommand(showBuildStatusCommand, async () => {
        try {
            const minWaitTimePromise = new Promise((resolve) => setTimeout(resolve, minPollWaitTime * 1000));
            const currentBranch = await gitService.getCurrentBranch();
            const buildStatus = await jenkinsService.getBuildStatus(currentBranch);
            const isInProgress = statusBarManager.updateStatus(buildStatus);
            if (isInProgress) {
                if (pollCounter > 0) {
                    pollCounter--;
                    await minWaitTimePromise;
                    vscode.commands.executeCommand(showBuildStatusCommand);
                } else {
                    pollCounter = maxPollCount;
                    // Update status to unknown
                    statusBarManager.updateStatus({ ...buildStatus, inProgress: false, building: false });
                }
            } else {
                pollCounter = maxPollCount;
            }
        } catch (error) {
            outputChannel.appendLine(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(statusBarManager.statusBarItem);

    // Initial status check
    vscode.commands.executeCommand(showBuildStatusCommand);
}

export function deactivate(): void {
    if (statusBarManager) {
        statusBarManager.dispose();
    }
}
