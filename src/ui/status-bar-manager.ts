import * as vscode from "vscode";
import type { BuildDetails } from "../types/jenkins";

export class StatusBarManager {
    public readonly statusBarItem: vscode.StatusBarItem;

    constructor(command: string) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBarItem.command = command;
        this.setStatusToUnknown(true);
        this.statusBarItem.show();
    }

    public setStatusToUnknown(inProgress: boolean) {
        this.updateStatus({ result: null, inProgress: inProgress, isChecking: inProgress });
    }

    /**
     * Updates status bar item display based on passed buildDetails
     * @param buildDetails details of target build
     * @returns true if build is in progress, false otherwise
     */
    public updateStatus(buildDetails: Partial<BuildDetails> & { inProgress: BuildDetails["inProgress"]; result: BuildDetails["result"]; isChecking?: boolean }): boolean {
        const statusIcons = {
            SUCCESS: "$(check)",
            FAILURE: "$(x)",
            UNSTABLE: "$(warning)",
            ABORTED: "$(circle-slash)",
            IN_PROGRESS: "$(sync~spin)"
        };

        const buildStatus: keyof typeof statusIcons | null = buildDetails.inProgress || buildDetails.building ? "IN_PROGRESS" : buildDetails.result;
        const isInProgress = buildStatus == "IN_PROGRESS";

        const icon = buildStatus ? statusIcons[buildStatus] : "$(question)";
        this.statusBarItem.text = `${icon} Jenkins`;
        this.statusBarItem.tooltip = `Job Name: ${buildDetails.fullDisplayName?.split(" ")[0] ?? "?"}\nBuild Number: ${buildDetails.number ?? "?"}\nBuild Status: ${buildDetails.isChecking ? "Checking..." : buildStatus ?? "?"}\nLast Updated: ${new Date().toLocaleString()}`;
        if (isInProgress && buildDetails.estimatedDuration) {
            this.statusBarItem.tooltip += `\nEstimated Duration: ${(buildDetails.estimatedDuration / 1000).toFixed(1)}s`;
        } else if (!isInProgress && buildDetails.duration) {
            this.statusBarItem.tooltip += `\nDuration: ${(buildDetails.duration / 1000).toFixed(1)}s`;
        }

        return isInProgress;
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }
}
