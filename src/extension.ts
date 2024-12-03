import * as vscode from 'vscode';
import { JenkinsService } from './services/jenkins-service';
import { GitService } from './services/git-service';
import { StatusBarManager } from './ui/status-bar-manager';

let statusBarManager: StatusBarManager;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const jenkinsService = new JenkinsService();
    const gitService = new GitService();
    statusBarManager = new StatusBarManager();

    let disposable = vscode.commands.registerCommand('jenkins-build-status.showBuildStatus', async () => {
        try {
            const currentBranch = await gitService.getCurrentBranch();
            const buildStatus = await jenkinsService.getBuildStatus(currentBranch);
            statusBarManager.updateStatus(buildStatus);
            
            vscode.window.showInformationMessage(`Build Status: ${buildStatus.status}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(statusBarManager.statusBarItem);

    // Initial status check
    vscode.commands.executeCommand('jenkins-build-status.showBuildStatus');
}

export function deactivate(): void {
    if (statusBarManager) {
        statusBarManager.dispose();
    }
}