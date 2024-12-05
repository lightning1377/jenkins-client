import simpleGit, { SimpleGit } from "simple-git";
import * as vscode from "vscode";

export class GitService {
    private git: SimpleGit;

    constructor(private outputChannel: vscode.OutputChannel) {
        this.git = simpleGit(this.getWorkspacePath());
    }

    public async getCurrentBranch(): Promise<string> {
        try {
            const result = await this.git.branch();
            return result.current;
        } catch (error) {
            throw new Error(`Failed to get current git branch: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async startPollingForPushEvent(params: { onPush: (commitHash: string, currentBranch: string) => void }): Promise<NodeJS.Timeout> {
        // Initial local commit hash
        let lastLocalCommitHash = await this.getLocalCommitHash();
        let isCheckForPush = false;

        // Start polling every 5 seconds
        return setInterval(async () => {
            try {
                const currentLocalHash = await this.getLocalCommitHash();

                if (lastLocalCommitHash !== currentLocalHash) {
                    isCheckForPush = true;

                    // Update the last known local hash
                    lastLocalCommitHash = currentLocalHash;
                }

                if (!isCheckForPush) return;

                const currentBranch = await this.getCurrentBranch();
                const currentRemoteHash = await this.getRemoteCommitHash(currentBranch);

                if (currentLocalHash === currentRemoteHash) {
                    isCheckForPush = false;
                    params.onPush(currentRemoteHash, currentBranch);
                }
            } catch (error) {
                this.outputChannel.appendLine("[GitService] Error during polling: " + (error instanceof Error ? error.message : String(error)));
            }
        }, 5000);
    }

    public async getLocalCommitHash() {
        try {
            const log = await this.git.log(["-1"]);
            return log.latest?.hash || "";
        } catch (error) {
            this.outputChannel.appendLine("[GitService] Failed to get local commit hash: " + (error instanceof Error ? error.message : String(error)));
            return "";
        }
    }

    public async getRemoteCommitHash(branch: string) {
        try {
            await this.git.fetch(); // Ensure the remote data is up-to-date
            const log = await this.git.log([`origin/${branch}`, "-1"]);
            return log.latest?.hash || "";
        } catch (error) {
            this.outputChannel.appendLine("[GitService] Failed to get remote commit hash: " + (error instanceof Error ? error.message : String(error)));
            return "";
        }
    }

    private getWorkspacePath(): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error("No workspace folder found");
        }
        return workspaceFolders[0].uri.fsPath;
    }
}
