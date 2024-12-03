import axios from 'axios';
import * as vscode from 'vscode';
import { BuildStatus, BuildDetails } from '../types/jenkins';

export class JenkinsService {
    private config: vscode.WorkspaceConfiguration;

    constructor() {
        this.config = vscode.workspace.getConfiguration('jenkinsBuildStatus');
    }

    private getAuthConfig() {
        const username = this.config.get<string>('username');
        const apiToken = this.config.get<string>('apiToken');
        
        if (!username || !apiToken) {
            throw new Error('Jenkins credentials are not configured');
        }

        return { username, password: apiToken };
    }

    private getJenkinsUrl() {
        const jenkinsUrl = this.config.get<string>('jenkinsUrl');
        const jobName = this.config.get<string>('jobName');

        if (!jenkinsUrl || !jobName) {
            throw new Error('Jenkins URL or job name is not configured');
        }

        return { jenkinsUrl, jobName };
    }

    async getBuildStatus(branchName: string): Promise<BuildStatus> {
        const { jenkinsUrl, jobName } = this.getJenkinsUrl();

        try {
            const response = await axios.get(
                `${jenkinsUrl}/job/${jobName}/job/${branchName}/lastBuild/api/json`,
                {
                    auth: this.getAuthConfig()
                }
            );

            return {
                status: response.data.result,
                url: response.data.url,
                timestamp: response.data.timestamp
            };
        } catch (error) {
            throw new Error(`Failed to fetch Jenkins build status: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async getBuildDetails(branchName: string, buildNumber: number): Promise<BuildDetails> {
        const { jenkinsUrl, jobName } = this.getJenkinsUrl();

        try {
            const response = await axios.get(
                `${jenkinsUrl}/job/${jobName}/job/${branchName}/${buildNumber}/api/json`,
                {
                    auth: this.getAuthConfig()
                }
            );

            return {
                number: response.data.number,
                status: response.data.result,
                url: response.data.url,
                timestamp: response.data.timestamp,
                duration: response.data.duration,
                changeSets: response.data.changeSets
            };
        } catch (error) {
            throw new Error(`Failed to fetch build details: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}