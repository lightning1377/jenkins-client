import axios, { AxiosRequestConfig } from "axios";
import * as vscode from "vscode";
import { hasLastBuiltRevision, type BuildDetails, type JobInfo } from "../types/jenkins";

export class JenkinsService {
    private config: vscode.WorkspaceConfiguration;
    private authHeader: string;
    private jenkinsUrl?: string;
    private jobName?: string;
    private cache: { buildDetails: Record<number, BuildDetails> } = { buildDetails: {} };
    private outputChannel: vscode.OutputChannel;

    constructor(outputChannel: vscode.OutputChannel) {
        // Load Jenkins configuration from workspace settings
        this.config = vscode.workspace.getConfiguration("jenkinsBuildStatus");

        // Retrieve configuration settings
        this.jenkinsUrl = this.config.get<string>("jenkinsUrl");
        const username = this.config.get<string>("username");
        const apiToken = this.config.get<string>("apiToken");
        this.jobName = this.config.get<string>("jobName");

        // Prepare the Basic Authentication header
        const credentials = `${username}:${apiToken}`;
        this.authHeader = `Basic ${btoa(credentials)}`;

        this.outputChannel = outputChannel;
    }

    async getIsReady(): Promise<boolean> {
        this.outputChannel.appendLine("Checking if we're connected to Jenkins...");
        if (!this.jenkinsUrl || !this.authHeader) {
            return false;
        }
        try {
            // Test the connection by fetching a crumb or a lightweight endpoint
            await this.getCrumb();
            return true;
        } catch (error) {
            return false;
        }
    }

    async pollForCommitHash(params: { commitHash: string; minPollWaitTime: number; showBuildStatusCommand: string }, retryCount = 5): Promise<void> {
        const { commitHash, minPollWaitTime, showBuildStatusCommand } = params;
        const minWaitTimePromise = new Promise((resolve) => setTimeout(resolve, minPollWaitTime * 1000));
        const buildDetails = await this.getCommitBuild(commitHash);
        if (!buildDetails) {
            if (retryCount > 0) {
                await minWaitTimePromise;
                await this.pollForCommitHash(params, --retryCount);
            }
            return;
        }
        vscode.commands.executeCommand(showBuildStatusCommand);
    }

    /**
     * Fetch the Jenkins CSRF crumb required for API requests.
     */
    private async getCrumb(): Promise<{ crumb: string; crumbRequestField: string } | null> {
        if (!this.jenkinsUrl) {
            throw new Error("Jenkins URL is not configured.");
        }

        const url = `${this.jenkinsUrl}/crumbIssuer/api/json`;

        const { data, status } = await axios.get(url, {
            headers: {
                Authorization: this.authHeader
            }
        });

        if (status === 404) {
            console.log("CSRF protection is disabled or crumb endpoint not found.");
            return null;
        }

        if (!data || !data.crumbRequestField || !data.crumb) {
            throw new Error("Invalid crumb response from Jenkins.");
        }

        return data;
    }

    /**
     * Perform an authenticated API call to Jenkins.
     * Automatically includes CSRF crumb in the request headers.
     */
    private async apiRequest<T>(endpoint: string): Promise<T> {
        const crumb = await this.getCrumb();
        const url = `${this.jenkinsUrl}/${endpoint}/api/json`;
        const headers: AxiosRequestConfig["headers"] = {
            Authorization: this.authHeader,
            "Content-Type": "application/json"
        };
        if (crumb) {
            headers[crumb.crumbRequestField] = crumb.crumb;
        }
        const { data } = await axios.get<T>(url, { headers });
        return data;
    }

    /**
     * Fetch job information from Jenkins.
     */
    private async getJobInfo(): Promise<JobInfo> {
        this.outputChannel.appendLine(`Fetching JobInfo for ${this.jobName}...`);
        const jobInfo = await this.apiRequest<JobInfo>(`job/${this.jobName}`);
        return jobInfo;
    }

    /**
     * Fetch details of a specific build by its number.
     */
    private async getBuildDetails(buildNumber: number): Promise<BuildDetails> {
        // Check if cached details are available
        if (this.cache.buildDetails[buildNumber]) {
            return this.cache.buildDetails[buildNumber];
        }

        this.outputChannel.appendLine(`Fetching BuildDetails for ${this.jobName}#${buildNumber}...`);
        const buildDetails = await this.apiRequest<BuildDetails>(`job/${this.jobName}/${buildNumber}`);
        // Cache details if status exists (build is over)
        if (buildDetails.result) this.cache.buildDetails[buildNumber] = buildDetails;

        return buildDetails;
    }

    public async getCommitBuild(commitHash: string, maxJobCount = 5): Promise<BuildDetails | false> {
        const buildInfo = await this.getJobInfo();
        const builds = buildInfo.builds || [];

        for (let i = 0; i < Math.min(builds.length, maxJobCount); i++) {
            const build = builds[i];
            const buildDetails = await this.getBuildDetails(build.number);

            // Check if the build belongs to the specified commit hash
            const lastBuiltRevisionHash = buildDetails.actions?.find((action) => hasLastBuiltRevision(action))?.lastBuiltRevision.SHA1;

            if (commitHash === lastBuiltRevisionHash) {
                return buildDetails;
            }
        }

        return false;
    }
}
