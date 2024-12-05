export interface JobInfo {
    actions: any[];
    buildable: boolean;
    builds: BuildStatus[];
    color: string;
    concurrentBuild: boolean;
    description: string;
    disabled: boolean;
    displayName: string;
    downstreamProjects: any[];
    firstBuild: BuildStatus;
    fullDisplayName: string;
    fullName: string;
    healthReport: {
        description: string;
        iconClassName: string;
        iconUrl: string;
        score: number;
    }[];
    inQueue: boolean;
    keepDependencies: boolean;
    lastBuild: BuildStatus;
    lastCompletedBuild: BuildStatus;
    lastFailedBuild: BuildStatus;
    lastStableBuild: BuildStatus;
    lastSuccessfulBuild: BuildStatus;
    lastUnstableBuild: BuildStatus;
    lastUnsuccessfulBuild: BuildStatus;
    name: string;
    nextBuildNumber: number;
    property: any[];
    queueItem: any;
    scm: any;
    upstreamProjects: any[];
    url: string;
}

export interface BuildStatus {
    number: number;
    url: string;
}

interface Revision {
    branch: { SHA1: string; name: string }[];
    SHA1: string;
}

type Action =
    | {
          causes: { shortDescription: string }[];
      }
    | {
          parameters: any[];
      }
    | {
          buildsByBranchName: Record<string, { buildNumber: number; buildResult: string | null; marked: Revision; revision: Revision }>;
          lastBuiltRevision: Revision;
          remoteUrls: string[];
      };

// Type guard for actions with `lastBuiltRevision`
export function hasLastBuiltRevision(action: Action): action is Extract<Action, { lastBuiltRevision: any }> {
    return "lastBuiltRevision" in action;
}

export interface BuildDetails {
    actions: Action[];
    artifacts: any[];
    building: boolean;
    builtOn: string;
    changeSet: {
        items: Array<{
            commitId: string;
            msg: string;
            author: {
                fullName: string;
            };
        }>;
    };
    culprits: { absoluteUrl: string; fullName: string }[];
    description: string | null;
    displayName: string;
    duration: number;
    estimatedDuration: number;
    executor: any;
    fullDisplayName: string;
    id: string;
    inProgress: boolean;
    keepLog: boolean;
    number: number;
    queueId: number;
    result: "SUCCESS" | "FAILURE" | "UNSTABLE" | "ABORTED" | null;
    timestamp: number;
    url: string;
}
