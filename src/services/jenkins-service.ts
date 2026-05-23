import * as vscode from "vscode";
import { hasLastBuiltRevision, type BuildDetails, type JobInfo } from "../types/jenkins";

export class JenkinsService {
    private config: vscode.WorkspaceConfiguration;
    private jenkinsUrl?: string;
    private username?: string;
    private apiToken?: string;
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

    constructor(outputChannel: vscode.OutputChannel, apiToken?: string) {
        // Load Jenkins configuration from workspace settings
        this.config = vscode.workspace.getConfiguration("jenkinsBuildStatus");

        // Retrieve configuration settings
        this.jenkinsUrl = this.config.get<string>("jenkinsUrl")?.replace(/\/+$/, "");
        this.username = this.config.get<string>("username");
        this.apiToken = apiToken;
        this.jobName = this.config.get<string>("jobName") ?? "";
        this.branchSpecificJobs = this.config.get<Record<string, string>>("branchSpecificJobs") ?? {};

        this.outputChannel = outputChannel;
    }

    public getBranchJobName(branchName: string) {
        return branchName in this.branchSpecificJobs ? this.branchSpecificJobs[branchName] : this.jobName;
    }

    async getIsReady(): Promise<boolean> {
        this.outputChannel.appendLine("Checking if we're connected to Jenkins...");
        if (!this.jenkinsUrl || !this.username || !this.apiToken || (!this.jobName && Object.keys(this.branchSpecificJobs).length == 0)) {
            return false;
        }
        try {
            // Test the connection by fetching a crumb or a lightweight endpoint
            await this.getCrumb();
            return true;
        } catch (error) {
            this.outputChannel.appendLine(`[JenkinsService] Jenkins readiness check failed: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    async pollForCommitHash(params: { commitHash: string; branchName: string; minPollWaitTime: number; showBuildStatusCommand: string }, retryCount = 5): Promise<void> {
        const { commitHash, branchName, minPollWaitTime, showBuildStatusCommand } = params;
        const minWaitTimePromise = new Promise((resolve) => setTimeout(resolve, minPollWaitTime * 1000));
        const buildDetails = await this.getCommitBuild(commitHash, branchName);
        if (!buildDetails || buildDetails == "FAILURE") {
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
        const buildDetails = await this.apiRequest<BuildDetails>(`${this.getJobPath(jobName)}/${buildNumber}`);

        // Cache details if status exists (build is over)
        if (buildDetails.result) {
            if (!this.cache.buildDetails[jobName]) this.cache.buildDetails[jobName] = {};
            this.cache.buildDetails[jobName][buildNumber] = buildDetails;
        }

        return buildDetails;
    }

    public async getCommitBuild(commitHash: string, branchName: string): Promise<BuildDetails | false | "FAILURE"> {
        // Get branch related job info
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

        // Try to find commit build in ongoing jobs
        if (jobInfo.lastBuild.number > buildsByBranchName[targetBranchName].buildNumber) {
            const startBuildNumber = Math.max(buildsByBranchName[targetBranchName].buildNumber + 1, jobInfo.lastBuild.number - 4); // Fetch build details for up to 5 builds before last build and after last successful build of branch based on job info
            for (let buildNumber = jobInfo.lastBuild.number; buildNumber >= startBuildNumber; buildNumber--) {
                const _buildDetails = await this.getBuildDetails(branchName, buildNumber);
                if (_buildDetails.actions?.find((action) => hasLastBuiltRevision(action))?.lastBuiltRevision?.SHA1 === commitHash) return _buildDetails;
                if (_buildDetails.result) break;
            }
        }

        return "FAILURE";
    }

    /**
     * Clears cache of this service
     */
    public clearCache() {
        this.cache = { jobInfo: {}, buildDetails: {} };
    }

    /**
     * Fetch the Jenkins CSRF crumb required for API requests.
     */
    private async getCrumb(): Promise<{ crumb: string; crumbRequestField: string } | null> {
        if (!this.isCsrfEnabled) return null;

        const url = `${this.jenkinsUrl}/crumbIssuer/api/json`;
        const response = await fetch(url, {
            headers: { Authorization: this.getAuthHeader() }
        });

        if (response.status === 404) {
            this.outputChannel.appendLine("[JenkinsService] CSRF protection is disabled or crumb endpoint not found.");
            this.isCsrfEnabled = false;
            return null;
        }

        if (!response.ok) {
            throw new Error(`Failed to fetch crumb: ${response.statusText}`);
        }

        const data = (await response.json()) as { crumb: string; crumbRequestField: string } | null;
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
        const headers: RequestInit["headers"] = {
            Authorization: this.getAuthHeader(),
            "Content-Type": "application/json"
        };

        if (crumb) {
            headers[crumb.crumbRequestField] = crumb.crumb;
        }

        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`Request failed: ${response.statusText}`);
        }

        return response.json() as T;
    }

    /**
     * Fetch job information from Jenkins.
     * Reads from cache if both last build number and last successful build number are unchanged
     */
    private async getJobInfo(jobName: string): Promise<JobInfo> {
        const buildInfo = await this.apiRequest<{
            lastBuild: { number: number };
            lastSuccessfulBuild: { number: number };
        }>(this.getJobPath(jobName), "lastBuild[number],lastSuccessfulBuild[number]");

        const lastBuildNumber = buildInfo?.lastBuild?.number;
        const lastSuccessfulBuildNumber = buildInfo?.lastSuccessfulBuild?.number;

        if (this.cache.jobInfo[jobName] && lastBuildNumber == this.cache.jobInfo[jobName].lastBuild?.number && lastSuccessfulBuildNumber == this.cache.jobInfo[jobName].lastSuccessfulBuild?.number) {
            return this.cache.jobInfo[jobName];
        }

        this.outputChannel.appendLine(`Fetching JobInfo for ${jobName}...`);
        const jobInfo = await this.apiRequest<JobInfo>(this.getJobPath(jobName));
        this.cache.jobInfo[jobName] = jobInfo;
        return jobInfo;
    }

    private getAuthHeader(): string {
        const credentials = `${this.username}:${this.apiToken}`;
        return `Basic ${Buffer.from(credentials).toString("base64")}`;
    }

    private getJobPath(jobName: string): string {
        return jobName
            .split("/")
            .filter(Boolean)
            .map((segment) => `job/${encodeURIComponent(segment)}`)
            .join("/");
    }
}
