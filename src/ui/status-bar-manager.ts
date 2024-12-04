import * as vscode from "vscode";
import { BuildDetails, BuildStatus } from "../types/jenkins";

export class StatusBarManager {
    public readonly statusBarItem: vscode.StatusBarItem;

    constructor(command: string) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBarItem.command = command;
        this.statusBarItem.show();
    }

    updateStatus(buildDetails: BuildDetails): void {
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
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }
}
