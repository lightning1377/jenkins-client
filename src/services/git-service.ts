import simpleGit, { SimpleGit } from 'simple-git';
import * as vscode from 'vscode';

export class GitService {
    private git: SimpleGit;

    constructor() {
        this.git = simpleGit(this.getWorkspacePath());
    }

    private getWorkspacePath(): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error('No workspace folder found');
        }
        return workspaceFolders[0].uri.fsPath;
    }

    async getCurrentBranch(): Promise<string> {
        try {
            const result = await this.git.branch();
            return result.current;
        } catch (error) {
            throw new Error(`Failed to get current git branch: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}