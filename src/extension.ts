import * as vscode from "vscode";
import { JenkinsService } from "./services/jenkins-service";
import { GitService } from "./services/git-service";
import { StatusBarManager } from "./ui/status-bar-manager";

let statusBarManager: StatusBarManager;
let pollingInterval: NodeJS.Timeout | null = null;

const apiTokenSecretKey = "jenkinsBuildStatus.apiToken";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const showBuildStatusCommand = "jenkins-client.showBuildStatus";
    const clearJenkinsServiceCacheCommand = "jenkins-client.clearJenkinsServiceCache";
    const setApiTokenCommand = "jenkins-client.setApiToken";
    const clearApiTokenCommand = "jenkins-client.clearApiToken";
    const openQuickPickCommand = "jenkins-client.openQuickPick";

    // Create an Output Channel for Jenkins Client
    const outputChannel = vscode.window.createOutputChannel("Jenkins Client");
    context.subscriptions.push(outputChannel);
    await migrateLegacyApiToken(context, outputChannel);
    let jenkinsService = new JenkinsService(outputChannel, await context.secrets.get(apiTokenSecretKey));
    let gitService: GitService | undefined;

    // Initialize status bar manager
    statusBarManager = new StatusBarManager(openQuickPickCommand, [
        { title: "Show Jenkins Client Status", command: showBuildStatusCommand },
        { title: "Clear Jenkins Service Cache", command: clearJenkinsServiceCacheCommand },
        { title: "Set Jenkins API Token", command: setApiTokenCommand },
        { title: "Clear Jenkins API Token", command: clearApiTokenCommand }
    ]);
    context.subscriptions.push(statusBarManager.statusBarItem);

    const config = vscode.workspace.getConfiguration("jenkinsBuildStatus");
    const minPollWaitTime = config.get<number>("minPollWaitTime") ?? 5;
    const maxPollCount = config.get<number>("maxPollCount") ?? 60;
    const excludeBranches = config.get<string[]>("excludeBranches") ?? [];

    // Register show build status command
    const showBuildStatusDisposable = vscode.commands.registerCommand(showBuildStatusCommand, async (showWarnings = true) => {
        try {
            const isJenkinsConnected = await jenkinsService.getIsReady();
            if (!isJenkinsConnected) {
                statusBarManager.setStatusToUnknown(false);
                if (showWarnings) {
                    await showSetupWarning(setApiTokenCommand);
                }
                return;
            }

            if (!gitService) gitService = new GitService(outputChannel);
            const branchName = await gitService.getCurrentBranch();
            if (!branchName || excludeBranches.includes(branchName)) {
                statusBarManager.setStatusToUnknown(false);
                return;
            }
            const commitHash = await gitService.getRemoteCommitHash(branchName);
            const buildDetails = await jenkinsService.getCommitBuild(commitHash, branchName);
            if (!buildDetails) {
                statusBarManager.setStatusToUnknown(false);
                return;
            }

            if (buildDetails == "FAILURE") {
                statusBarManager.updateStatus({ result: "FAILURE", fullDisplayName: jenkinsService.getBranchJobName(branchName), inProgress: false });
                return;
            }

            const isInProgress = statusBarManager.updateStatus(buildDetails);

            if (isInProgress) {
                let minWaitTimePromise = new Promise((resolve) => setTimeout(resolve, minPollWaitTime * 1000));
                let pollCounter = maxPollCount;
                let _isInProgress = true;
                let _buildDetails = buildDetails;
                while (_isInProgress && pollCounter > 0) {
                    pollCounter--;
                    await minWaitTimePromise;
                    minWaitTimePromise = new Promise((resolve) => setTimeout(resolve, minPollWaitTime * 1000));
                    _buildDetails = await jenkinsService.getBuildDetails(branchName, _buildDetails.number);
                    _isInProgress = statusBarManager.updateStatus(_buildDetails);
                }
            }
        } catch (error) {
            statusBarManager.setStatusToUnknown(false);
            outputChannel.appendLine(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    context.subscriptions.push(showBuildStatusDisposable);

    // Register clear jenkins service cache command
    const clearJenkinsServiceCacheDisposable = vscode.commands.registerCommand(clearJenkinsServiceCacheCommand, () => {
        jenkinsService.clearCache();
    });
    context.subscriptions.push(clearJenkinsServiceCacheDisposable);

    const setApiTokenDisposable = vscode.commands.registerCommand(setApiTokenCommand, async () => {
        const apiToken = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            password: true,
            placeHolder: "Jenkins API token",
            prompt: "Enter the Jenkins API token for the configured Jenkins username"
        });

        if (apiToken === undefined) return;

        const trimmedApiToken = apiToken.trim();
        if (!trimmedApiToken) {
            vscode.window.showWarningMessage("Jenkins API token was not saved because it was empty.");
            return;
        }

        await context.secrets.store(apiTokenSecretKey, trimmedApiToken);
        jenkinsService = new JenkinsService(outputChannel, trimmedApiToken);
        jenkinsService.clearCache();
        vscode.window.showInformationMessage("Jenkins API token saved.");
        await vscode.commands.executeCommand(showBuildStatusCommand);
    });
    context.subscriptions.push(setApiTokenDisposable);

    const clearApiTokenDisposable = vscode.commands.registerCommand(clearApiTokenCommand, async () => {
        await context.secrets.delete(apiTokenSecretKey);
        jenkinsService = new JenkinsService(outputChannel);
        jenkinsService.clearCache();
        statusBarManager.setStatusToUnknown(false);
        vscode.window.showInformationMessage("Jenkins API token cleared.");
    });
    context.subscriptions.push(clearApiTokenDisposable);

    // Register the quick pick command
    const showQuickPickMenuDisposable = vscode.commands.registerCommand(openQuickPickCommand, async () => {
        const selectedCommand = await statusBarManager.showQuickPickMenu();
        if (!selectedCommand) return;
        vscode.commands.executeCommand(selectedCommand);
    });
    context.subscriptions.push(showQuickPickMenuDisposable);

    // Initial status check
    vscode.commands.executeCommand(showBuildStatusCommand, false);

    try {
        if (!gitService) gitService = new GitService(outputChannel);
        pollingInterval = await gitService.startPollingForPushEvent({
            onPush: async (commitHash, branchName) => {
                if (excludeBranches.includes(branchName)) {
                    statusBarManager.setStatusToUnknown(false);
                    return;
                }
                const isJenkinsConnected = await jenkinsService.getIsReady();
                if (!isJenkinsConnected) {
                    statusBarManager.setStatusToUnknown(false);
                    return;
                }
                statusBarManager.setStatusToUnknown(true);
                await jenkinsService.pollForCommitHash({ commitHash, branchName, minPollWaitTime, showBuildStatusCommand });
            }
        });
    } catch (error) {
        outputChannel.appendLine(`Git polling was not started: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function migrateLegacyApiToken(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel): Promise<void> {
    const existingSecret = await context.secrets.get(apiTokenSecretKey);
    if (existingSecret) return;

    const legacyApiToken = vscode.workspace.getConfiguration("jenkinsBuildStatus").get<string>("apiToken");
    if (!legacyApiToken) return;

    await context.secrets.store(apiTokenSecretKey, legacyApiToken);
    outputChannel.appendLine("Migrated Jenkins API token from settings to VS Code Secret Storage.");
}

async function showSetupWarning(setApiTokenCommand: string): Promise<void> {
    const action = await vscode.window.showWarningMessage("Jenkins Client is not configured or cannot connect to Jenkins.", "Set API Token", "Open Settings");
    if (action === "Set API Token") {
        await vscode.commands.executeCommand(setApiTokenCommand);
    } else if (action === "Open Settings") {
        await vscode.commands.executeCommand("workbench.action.openSettings", "jenkinsBuildStatus");
    }
}

export function deactivate(): void {
    if (statusBarManager) {
        statusBarManager.dispose();
    }
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }
}
