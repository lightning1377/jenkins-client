import * as vscode from 'vscode';
import { BuildStatus } from '../types/jenkins';

export class StatusBarManager {
    public readonly statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.statusBarItem.command = 'jenkins-build-status.showBuildStatus';
        this.statusBarItem.show();
    }

    updateStatus(buildStatus: BuildStatus): void {
        const statusIcons = {
            SUCCESS: '$(check)',
            FAILURE: '$(x)',
            UNSTABLE: '$(warning)',
            ABORTED: '$(circle-slash)',
            IN_PROGRESS: '$(sync~spin)'
        };

        const icon = statusIcons[buildStatus.status] || '$(question)';
        this.statusBarItem.text = `${icon} Jenkins`;
        this.statusBarItem.tooltip = `Build Status: ${buildStatus.status}\nLast Updated: ${new Date(buildStatus.timestamp).toLocaleString()}`;
        
        if (buildStatus.status === 'SUCCESS') {
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.successBackground');
        } else if (buildStatus.status === 'FAILURE') {
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        } else {
            this.statusBarItem.backgroundColor = undefined;
        }
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }
}