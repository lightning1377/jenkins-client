import axios, { AxiosRequestConfig } from "axios";
import * as vscode from "vscode";
import { hasLastBuiltRevision, type BuildDetails, type JobInfo } from "../types/jenkins";

export class JenkinsService {
    private config: vscode.WorkspaceConfiguration;
    private authHeader: string;
    private jenkinsUrl?: string;
    private jobName: string;
    private branchSpecificJobs: Record<string, string>;
    private cache: {
        jobInfo: Record<string, JobInfo>;
        buildDetails: Record<string, Record<number, BuildDetails>>;
    } = {
        jobInfo: {},
        buildDetails: {}
    }; // First key is job name, second key is build number
    private outputChannel: vscode.OutputChannel;
    private isCsrfEnabled = true;

    constructor(outputChannel: vscode.OutputChannel) {
        // Load Jenkins configuration from workspace settings
        this.config = vscode.workspace.getConfiguration("jenkinsBuildStatus");

        // Retrieve configuration settings
        this.jenkinsUrl = this.config.get<string>("jenkinsUrl");
        const username = this.config.get<string>("username");
        const apiToken = this.config.get<string>("apiToken");
        this.jobName = this.config.get<string>("jobName") ?? "";
        this.branchSpecificJobs = this.config.get<Record<string, string>>("branchSpecificJobs") ?? {};

        // Prepare the Basic Authentication header
        const credentials = `${username}:${apiToken}`;
        this.authHeader = `Basic ${btoa(credentials)}`;

        this.outputChannel = outputChannel;
    }

    public getBranchJobName(branchName: string) {
        return branchName in this.branchSpecificJobs ? this.branchSpecificJobs[branchName] : this.jobName;
    }

    async getIsReady(): Promise<boolean> {
        this.outputChannel.appendLine("Checking if we're connected to Jenkins...");
        if (!this.jenkinsUrl || !this.authHeader || (!this.jobName && Object.keys(this.branchSpecificJobs).length == 0)) {
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

    async pollForCommitHash(params: { commitHash: string; branchName: string; minPollWaitTime: number; showBuildStatusCommand: string }, retryCount = 5): Promise<void> {
        const { commitHash, branchName, minPollWaitTime, showBuildStatusCommand } = params;
        const minWaitTimePromise = new Promise((resolve) => setTimeout(resolve, minPollWaitTime * 1000));
        const buildDetails = await this.getCommitBuild(commitHash, branchName);
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
     * Fetch details of a specific build by its number.
     */
    public async getBuildDetails(branchName: string, buildNumber: number): Promise<BuildDetails> {
        const jobName = this.getBranchJobName(branchName);

        // Check if cached details are available
        if (this.cache.buildDetails[jobName]?.[buildNumber]) {
            return this.cache.buildDetails[jobName][buildNumber];
        }

        this.outputChannel.appendLine(`Fetching BuildDetails for ${jobName}#${buildNumber}...`);
        const buildDetails = await this.apiRequest<BuildDetails>(`job/${jobName}/${buildNumber}`);
        // Cache details if status exists (build is over)
        if (buildDetails.result) {
            if (!this.cache.buildDetails[jobName]) this.cache.buildDetails[jobName] = {};
            this.cache.buildDetails[jobName][buildNumber] = buildDetails;
        }

        return buildDetails;
    }

    public async getCommitBuild(commitHash: string, branchName: string): Promise<BuildDetails | false | "FAILURE"> {
        const jobName = this.getBranchJobName(branchName);
        const jobInfo = await this.getJobInfo(jobName);

        if (!jobInfo.lastSuccessfulBuild?.number) return false;

        const lastSuccessfulBuildDetails = await this.getBuildDetails(branchName, jobInfo.lastSuccessfulBuild.number);

        const buildData = lastSuccessfulBuildDetails.actions?.find((action) => hasLastBuiltRevision(action));

        if (!buildData) return false;

        const { lastBuiltRevision, buildsByBranchName } = buildData;

        if (commitHash === lastBuiltRevision.SHA1) return lastSuccessfulBuildDetails;

        const targetBranchName = Object.keys(buildsByBranchName).find((_branchName) => _branchName.endsWith(branchName));

        if (!targetBranchName) return false;

        if (buildsByBranchName[targetBranchName].revision.SHA1 === commitHash) {
            return await this.getBuildDetails(branchName, buildsByBranchName[targetBranchName].buildNumber);
        }

        return "FAILURE";
    }

    /**
     * Fetch the Jenkins CSRF crumb required for API requests.
     */
    private async getCrumb(): Promise<{ crumb: string; crumbRequestField: string } | null> {
        if (!this.isCsrfEnabled) return null;

        const url = `${this.jenkinsUrl}/crumbIssuer/api/json`;

        const { data, status } = await axios.get(url, {
            headers: {
                Authorization: this.authHeader
            }
        });

        if (status === 404) {
            this.outputChannel.appendLine("[JenkinsService] CSRF protection is disabled or crumb endpoint not found.");
            this.isCsrfEnabled = false;
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
    private async apiRequest<T>(endpoint: string, tree?: string): Promise<T> {
        const crumb = await this.getCrumb();
        const url = `${this.jenkinsUrl}/${endpoint}/api/json` + (tree ? `?tree=${tree}` : "");
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
    private async getJobInfo(jobName: string): Promise<JobInfo> {
        const lastBuildNumber = (await this.apiRequest<{ lastBuild: { number: number } }>(`job/${jobName}`, "lastBuild[number]"))?.lastBuild.number;
        if (this.cache.jobInfo[jobName] && lastBuildNumber === this.cache.jobInfo[jobName].lastBuild.number) {
            return this.cache.jobInfo[jobName];
        }
        this.outputChannel.appendLine(`Fetching JobInfo for ${jobName}...`);
        const jobInfo = await this.apiRequest<JobInfo>(`job/${jobName}`);
        this.cache.jobInfo[jobName] = jobInfo;
        return jobInfo;
    }
}
