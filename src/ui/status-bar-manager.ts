import * as vscode from "vscode";
import type { BuildDetails } from "../types/jenkins";

export class StatusBarManager {
    public readonly statusBarItem: vscode.StatusBarItem;

    constructor(command: string) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBarItem.command = command;
        this.statusBarItem.show();
    }

    /**
     * Updates status bar item display based on passed buildDetails
     * @param buildDetails details of target build
     * @returns true if build is in progress, false otherwise
     */
    updateStatus(buildDetails: BuildDetails): boolean {
        const statusIcons = {
            SUCCESS: "$(check)",
            FAILURE: "$(x)",
            UNSTABLE: "$(warning)",
            ABORTED: "$(circle-slash)",
            IN_PROGRESS: "$(sync~spin)"
        };

        const buildStatus: keyof typeof statusIcons = buildDetails.inProgress || buildDetails.building ? "IN_PROGRESS" : buildDetails.result;

        const icon = statusIcons[buildStatus] || "$(question)";
        this.statusBarItem.text = `${icon} Jenkins`;
        this.statusBarItem.tooltip = `Build Status: ${buildStatus}\nLast Updated: ${new Date().toLocaleString()}`;

        if (buildStatus === "SUCCESS") {
            this.statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.successBackground");
        } else if (buildStatus === "FAILURE") {
            this.statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
        } else {
            this.statusBarItem.backgroundColor = undefined;
        }

        return buildStatus == "IN_PROGRESS";
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }
}
