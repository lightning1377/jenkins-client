export interface JobInfo {
    builds: BuildStatus[];
}

export interface BuildStatus {
    number: number;
    status: "SUCCESS" | "FAILURE" | "UNSTABLE" | "ABORTED";
    url: string;
    timestamp: number;
}

type Action =
    | {
          causes: { shortDescription: string }[];
      }
    | {
          parameters: any[];
      }
    | {
          buildsByBranchName: Record<string, { buildNumber: number; buildResult: string | null }>;
          lastBuiltRevision: { branch: { SHA1: string; name: string }[]; SHA1: string };
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
    result: BuildStatus["status"];
    timestamp: number;
    url: string;
}
