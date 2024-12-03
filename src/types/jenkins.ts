export interface BuildStatus {
    status: 'SUCCESS' | 'FAILURE' | 'UNSTABLE' | 'ABORTED' | 'IN_PROGRESS';
    url: string;
    timestamp: number;
}

export interface BuildDetails {
    number: number;
    status: BuildStatus['status'];
    url: string;
    timestamp: number;
    duration: number;
    changeSets: {
        items: Array<{
            commitId: string;
            msg: string;
            author: {
                fullName: string;
            };
        }>;
    }[];
}