import axios, { AxiosRequestConfig } from "axios";
import * as vscode from "vscode";
import { hasLastBuiltRevision, type BuildDetails, type BuildStatus, type JobInfo } from "../types/jenkins";

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

    /**
     * Get the build status of a branch.
     * @param branchName - The branch name for which the build status is required.
     */
    async getBuildStatus(branchName: string): Promise<BuildDetails> {
        const branchBuild = await this.getBranchBuild(branchName);

        if (!branchBuild) {
            throw new Error(`No builds found for branch: ${branchName}`);
        }

        return branchBuild;
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

    /**
     * Retrieve build details for a specific branch, searching recent builds.
     * @param branchName - The branch name to search for.
     * @param maxJobCount - Maximum number of recent builds to search.
     */
    private async getBranchBuild(branchName: string, maxJobCount = 5): Promise<BuildDetails | false> {
        const buildInfo = await this.getJobInfo();
        const builds = buildInfo.builds || [];

        for (let i = 0; i < Math.min(builds.length, maxJobCount); i++) {
            const build = builds[i];
            const buildDetails = await this.getBuildDetails(build.number);

            // Check if the build belongs to the specified branch
            const lastBuiltRevisionBranches = buildDetails.actions?.find((action) => hasLastBuiltRevision(action))?.lastBuiltRevision.branch;

            if (lastBuiltRevisionBranches?.some((branch: any) => branch?.name?.endsWith(branchName))) {
                return buildDetails;
            }
        }

        return false;
    }
}
